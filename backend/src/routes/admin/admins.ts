import { Router } from "express";
import { z } from "zod";
import { db } from "../../db/knex";
import { asyncHandler, badRequest, conflict, notFound, parse } from "../../lib/errors";
import { nowISO } from "../../lib/time";
import { getAuditLog, logAudit } from "../../services/audit";
import {
  activeAdminCount,
  createUser,
  hashPassword,
  normalizeUsername,
  passwordPolicyError,
  toProfiles,
  UserRow,
} from "../../services/users";

/* Admin account management (multiple admins supported). Every privileged
   action is written to the audit log. */
export const adminsRouter = Router();

async function getAdminOr404(username: string): Promise<UserRow> {
  const u = await db<UserRow>("users").where({ username }).first();
  if (!u) throw notFound("Admin account not found.");
  if (u.auth_role !== "admin") throw badRequest("That account is not an admin.");
  return u;
}

adminsRouter.get(
  "/admins",
  asyncHandler(async (_req, res) => {
    const rows = await db<UserRow>("users").where({ auth_role: "admin" }).orderBy("full_name");
    res.json({ ok: true, admins: await toProfiles(rows) });
  }),
);

adminsRouter.post(
  "/admins",
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        fullName: z.string().trim().min(1, "Full name is required."),
        username: z.string().trim().min(1, "Username is required."),
        email: z.string().trim().email("A valid email is required."),
        password: z.string(),
        role: z.string().trim().max(120).optional(),
        companyId: z.string().optional(),
        departmentId: z.string().optional(),
      }),
      req.body,
    );
    const pwErr = passwordPolicyError(body.password);
    if (pwErr) throw badRequest(pwErr, "WEAK_PASSWORD");
    const username = normalizeUsername(body.username);
    if (await db("users").where({ username }).first()) throw conflict("That username already exists.");
    if (await db("users").whereRaw("lower(email) = ?", [body.email.toLowerCase()]).first())
      throw conflict("That email is already in use.");
    const user = await createUser({
      username,
      fullName: body.fullName,
      jobTitle: body.role || "Administrator",
      email: body.email,
      password: body.password,
      authRole: "admin",
      companyId: body.companyId,
      departmentId: body.departmentId,
    });
    await logAudit({ action: "admin_created", actor: req.user!.username, target: username, detail: `Created admin account ${user.full_name} (${user.email}).` });
    res.status(201).json({ ok: true, admin: (await toProfiles([user]))[0] });
  }),
);

adminsRouter.patch(
  "/admins/:username",
  asyncHandler(async (req, res) => {
    const u = await getAdminOr404(req.params.username);
    const body = parse(
      z.object({
        fullName: z.string().trim().min(1).optional(),
        role: z.string().trim().max(120).optional(),
        email: z.string().trim().email("A valid email is required.").optional(),
        companyId: z.string().nullable().optional(),
        departmentId: z.string().nullable().optional(),
      }),
      req.body,
    );
    const patch: Partial<UserRow> = { updated_at: nowISO() };
    if (body.fullName) patch.full_name = body.fullName;
    if (body.role !== undefined) patch.job_title = body.role;
    if (body.email) {
      const email = body.email.toLowerCase();
      if (await db("users").whereRaw("lower(email) = ?", [email]).whereNot({ id: u.id }).first())
        throw conflict("That email is already in use.");
      patch.email = email;
    }
    if (body.companyId !== undefined) patch.company_id = body.companyId;
    if (body.departmentId !== undefined) patch.department_id = body.departmentId;
    await db("users").where({ id: u.id }).update(patch);
    await logAudit({ action: "admin_updated", actor: req.user!.username, target: u.username, detail: `Updated admin profile for ${u.full_name}.` });
    res.json({ ok: true, admin: (await toProfiles([{ ...u, ...patch } as UserRow]))[0] });
  }),
);

/* Admin-initiated password reset for another admin (no current password). */
adminsRouter.post(
  "/admins/:username/reset-password",
  asyncHandler(async (req, res) => {
    const u = await getAdminOr404(req.params.username);
    const body = parse(z.object({ newPassword: z.string() }), req.body);
    const pwErr = passwordPolicyError(body.newPassword);
    if (pwErr) throw badRequest(pwErr, "WEAK_PASSWORD");
    await db("users").where({ id: u.id }).update({ password_hash: await hashPassword(body.newPassword), updated_at: nowISO() });
    await logAudit({ action: "admin_password_reset", actor: req.user!.username, target: u.username, detail: `Password reset for admin ${u.full_name}.` });
    res.json({ ok: true });
  }),
);

adminsRouter.post(
  "/admins/:username/:action(deactivate|reactivate)",
  asyncHandler(async (req, res) => {
    const u = await getAdminOr404(req.params.username);
    const deactivate = req.params.action === "deactivate";
    if (deactivate) {
      if (u.id === req.user!.id) throw badRequest("You cannot deactivate your own account.");
      if (u.account_status === "active" && (await activeAdminCount()) <= 1)
        throw badRequest("Cannot deactivate the last active administrator account.");
    }
    await db("users").where({ id: u.id }).update({ account_status: deactivate ? "inactive" : "active", updated_at: nowISO() });
    await logAudit({
      action: deactivate ? "admin_deactivated" : "admin_reactivated",
      actor: req.user!.username,
      target: u.username,
      detail: `${deactivate ? "Deactivated" : "Reactivated"} admin account ${u.full_name}.`,
    });
    res.json({ ok: true });
  }),
);

/* Promote a staff member to admin, or demote an admin to staff. */
adminsRouter.post(
  "/users/:username/role",
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ role: z.enum(["staff", "admin"]) }), req.body);
    const u = await db<UserRow>("users").where({ username: req.params.username }).first();
    if (!u) throw notFound("User not found.");
    if (u.auth_role === body.role) return res.json({ ok: true, changed: false });
    if (body.role === "staff") {
      if (u.id === req.user!.id) throw badRequest("You cannot remove your own admin access.");
      if (u.account_status === "active" && (await activeAdminCount()) <= 1)
        throw badRequest("Cannot demote the last active administrator account.");
    }
    await db("users").where({ id: u.id }).update({ auth_role: body.role, updated_at: nowISO() });
    await logAudit({ action: `role_set_${body.role}`, actor: req.user!.username, target: u.username, detail: `Changed role of ${u.full_name} to ${body.role}.` });
    res.json({ ok: true, changed: true });
  }),
);

adminsRouter.get(
  "/audit-log",
  asyncHandler(async (req, res) => {
    res.json({ ok: true, entries: await getAuditLog(Number(req.query.limit) || 50) });
  }),
);
