import crypto from "crypto";
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { db } from "../db/knex";
import { config } from "../config";
import { asyncHandler, badRequest, conflict, forbidden, parse, unauthorized } from "../lib/errors";
import { requireAuth, signToken } from "../middleware/auth";
import { buildSessionBundle } from "../services/records";
import {
  createUser,
  findUserByIdentifier,
  hashPassword,
  normalizeUsername,
  passwordPolicyError,
  UserRow,
  verifyPassword,
} from "../services/users";
import { notify } from "../services/notifications";
import { logAudit } from "../services/audit";
import { nowISO } from "../lib/time";

export const authRouter = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: () => config.isTest,
  message: { ok: false, error: "Too many login attempts. Please try again in a few minutes.", code: "RATE_LIMIT" },
});

const INVALID = "Invalid email, Staff ID, or password.";

/* POST /api/auth/login — identifier = username, email or employee ID. */
authRouter.post(
  "/login",
  loginLimiter,
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        identifier: z.string().trim().min(1, "Required"),
        password: z.string().min(1, "Required"),
        remember: z.boolean().optional().default(false),
      }),
      req.body,
    );
    const user = await findUserByIdentifier(body.identifier);
    // Same message whether the account exists or not.
    if (!user || !(await verifyPassword(body.password, user.password_hash))) throw unauthorized(INVALID, "INVALID_CREDENTIALS");
    if (user.account_status === "inactive")
      throw forbidden("This account is no longer active. Please contact HR for assistance.", "ACCOUNT_INACTIVE");
    res.json({ ok: true, token: signToken(user, body.remember), session: await buildSessionBundle(user) });
  }),
);

/* POST /api/auth/register — public staff self-registration (always role=staff). */
authRouter.post(
  "/register",
  loginLimiter,
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        name: z.string().trim().min(1, "Please complete your name and username.").max(160),
        username: z.string().trim().min(1, "Please complete your name and username.").max(60),
        role: z.string().trim().max(120).optional().default("Staff"),
        password: z.string(),
        email: z.union([z.literal(""), z.string().trim().email("A valid email is required.").max(190)]).optional(),
        departmentId: z.string().optional().default(''),
        companyId: z.string().min(1, "Please select your company."),
      }),
      req.body,
    );
    const username = normalizeUsername(body.username);
    if (!/^[a-z0-9._-]{3,60}$/.test(username))
      throw badRequest("Username must be 3+ characters using letters, numbers, dot, dash or underscore.");
    const pwErr = passwordPolicyError(body.password);
    if (pwErr) throw badRequest(pwErr, "WEAK_PASSWORD");

    const company = await db("companies").where({ id: body.companyId }).first();
    if (!company) throw badRequest("Please select your company.");
    if (!company.active) throw badRequest("The selected company is no longer available.");
    const hasDepartments = await db("departments").where({ company_id: company.id, active: true }).first();
    let dept: { id: string } | undefined;
    if (hasDepartments) {
      dept = await db("departments").where({ id: body.departmentId }).first();
      if (!body.departmentId || dept) throw badRequest("Please select your department.");
      const d = dept as { id: string; active: boolean; company_id: string };
      if (!d.active) throw badRequest("The selected department is no longer available.");
      if (d.company_id !== company.id)
        throw badRequest("The selected department does not belong to the selected company.") 
    }

    if (await db("users").where({ username }).first()) throw conflict("Username already exists. Please log in.");
    // Email is optional on the form; default matches the frontend.
    const email = (body.email || `${username}@yesempire.com`).toLowerCase();
    if (await db("users").whereRaw("lower(email) = ?", [email]).first())
      throw conflict("That email is already registered. Please log in.");

    const user = await db.transaction(async (trx) => {
      const u = await createUser(
        {
          username,
          fullName: body.name,
          jobTitle: body.role || "Staff",
          email,
          password: body.password,
          authRole: "staff",
          companyId: company.id,
          departmentId: dept?.id ?? null,
        },
        trx,
      );
      await notify.adminStaffRegistered(u.full_name, u.username, trx);
      return u;
    });
    // New staff are on their own phone: keep them logged in.
    res.status(201).json({ ok: true, token: signToken(user, true), session: await buildSessionBundle(user) });
  }),
);

/* GET /api/auth/me — current user's full session bundle. */
authRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ ok: true, session: await buildSessionBundle(req.user!) });
  }),
);

/* POST /api/auth/change-password — any logged-in user. */
authRouter.post(
  "/change-password",
  requireAuth,
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ currentPassword: z.string(), newPassword: z.string() }), req.body);
    const user = req.user!;
    if (!(await verifyPassword(body.currentPassword, user.password_hash)))
      throw badRequest("Current password is incorrect.", "WRONG_PASSWORD");
    const pwErr = passwordPolicyError(body.newPassword);
    if (pwErr) throw badRequest(pwErr, "WEAK_PASSWORD");
    await db("users").where({ id: user.id }).update({ password_hash: await hashPassword(body.newPassword), updated_at: nowISO() });
    if (user.auth_role === "admin")
      await logAudit({ action: "admin_password_changed", actor: user.username, target: user.username, detail: `Password changed for admin ${user.full_name}.` });
    res.json({ ok: true });
  }),
);

/* ---------- password reset ---------- */

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

/* POST /api/auth/forgot-password — never reveals whether the account exists.
   TODO for production: email `resetUrl` to the user instead of returning it. */
authRouter.post(
  "/forgot-password",
  loginLimiter,
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ identifier: z.string().trim().min(1, "Required") }), req.body);
    const user = await findUserByIdentifier(body.identifier);
    const response: Record<string, unknown> = {
      ok: true,
      message: "If an account matches, a password reset link has been issued.",
    };
    if (user && user.account_status === "active") {
      const token = crypto.randomBytes(32).toString("hex");
      await db.transaction(async (trx) => {
        await trx("password_reset_tokens").where({ user_id: user.id }).del();
        await trx("password_reset_tokens").insert({
          token_hash: sha256(token),
          user_id: user.id,
          expires_at: Date.now() + config.rules.resetTokenTtlMs,
        });
      });
      // No email service yet — expose the link outside production only,
      // matching how the current frontend demo shows it on screen.
      if (!config.isProd) {
        response.devToken = token;
        response.resetUrl = `${config.frontendUrl}/reset-password?token=${token}`;
      }
    }
    res.json(response);
  }),
);

/* GET /api/auth/reset-password/:token — check a token without using it. */
authRouter.get(
  "/reset-password/:token",
  asyncHandler(async (req, res) => {
    const rec = await db("password_reset_tokens").where({ token_hash: sha256(req.params.token) }).first();
    res.json({ ok: true, valid: !!rec && Number(rec.expires_at) > Date.now() });
  }),
);

/* POST /api/auth/reset-password — single-use token + new password. */
authRouter.post(
  "/reset-password",
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ token: z.string().min(1), newPassword: z.string() }), req.body);
    const pwErr = passwordPolicyError(body.newPassword);
    if (pwErr) throw badRequest(pwErr, "WEAK_PASSWORD");
    const hash = sha256(body.token);
    const rec = await db("password_reset_tokens").where({ token_hash: hash }).first();
    if (!rec || Number(rec.expires_at) < Date.now()) {
      if (rec) await db("password_reset_tokens").where({ token_hash: hash }).del();
      throw badRequest("This reset link is invalid or has expired.", "TOKEN_INVALID");
    }
    await db.transaction(async (trx) => {
      await trx<UserRow>("users")
        .where({ id: rec.user_id })
        .update({ password_hash: await hashPassword(body.newPassword), updated_at: nowISO() });
      await trx("password_reset_tokens").where({ user_id: rec.user_id }).del();
    });
    res.json({ ok: true });
  }),
);
