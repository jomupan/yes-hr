import { Router } from "express";
import { z } from "zod";
import { db } from "../db/knex";
import { asyncHandler, badRequest, conflict, notFound, parse } from "../lib/errors";
import { daysBetween, fmtDate, isValidDate, nowISO, todayISO } from "../lib/time";
import { deleteStored, sendStored, storeDataUrlImage, storeUpload } from "../lib/files";
import { dopeStatus, scoreDope } from "../lib/dope";
import { upload } from "../middleware/upload";
import { notify } from "../services/notifications";
import {
  attendanceDto,
  buildSessionBundle,
  claimDto,
  dopeDto,
  evaluationDto,
  leaveBalance,
  leaveDto,
  payslipDto,
  replacementBalances,
} from "../services/records";
import { newId, toProfile, UserRow } from "../services/users";
import { sendAttendanceToSheet } from "../services/sheets";

/* Staff self-service. Every query is scoped to req.user.id, so a user can
   only ever read or change their own records. Admins use these too for
   their own attendance/leave/etc. */
export const meRouter = Router();

meRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    res.json({ ok: true, session: await buildSessionBundle(req.user!) });
  }),
);

meRouter.get(
  "/profile",
  asyncHandler(async (req, res) => {
    res.json({ ok: true, profile: await toProfile(req.user!) });
  }),
);

/* ───────────── Dope personality test ───────────── */
/* Staff update their own name, email and position. Company and department
   stay admin-only. */
meRouter.patch(
  "/profile",
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        fullName: z.string().trim().min(1, "Please enter your full name.").max(160),
        email: z.string().trim().email("Please enter a valid email.").max(190),
        role: z.string().trim().max(120).optional().default(""),
      }),
      req.body,
    );
    const user = req.user!;
    const email = body.email.toLowerCase();
    if (await db("users").whereRaw("lower(email) = ?", [email]).whereNot({ id: user.id }).first())
      throw conflict("That email is already used by another account.");
    const patch = { full_name: body.fullName, email, job_title: body.role || "Staff", updated_at: nowISO() };
    await db("users").where({ id: user.id }).update(patch);
    res.json({ ok: true, profile: await toProfile({ ...user, ...patch } as UserRow) });
  }),
);
meRouter.get(
  "/dope",
  asyncHandler(async (req, res) => {
    const rows = await db("dope_results").where({ user_id: req.user!.id }).orderBy("date", "asc");
    const history = rows.map(dopeDto);
    res.json({ ok: true, history, status: dopeStatus(history) });
  }),
);

meRouter.post(
  "/dope",
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        answers: z.array(z.object({ questionId: z.string(), optionId: z.string() })).min(1),
        declarationsAccepted: z.literal(true, { errorMap: () => ({ message: "Please accept all declarations." }) }),
      }),
      req.body,
    );
    const user = req.user!;
    const { scores, personalityType, summary } = scoreDope(body.answers);
    const row = {
      id: newId(),
      user_id: user.id,
      date: todayISO(),
      status: "Pass",
      answers: JSON.stringify(body.answers),
      scores: JSON.stringify(scores),
      personality_type: personalityType,
      summary,
      created_at: nowISO(),
    };
    await db.transaction(async (trx) => {
      await trx("dope_results").insert(row);
      await notify.adminDopeCompleted(user.full_name, personalityType, trx);
    });
    const history = (await db("dope_results").where({ user_id: user.id }).orderBy("date", "asc")).map(dopeDto);
    res.status(201).json({ ok: true, result: dopeDto(row), status: dopeStatus(history) });
  }),
);

/* ───────────── Attendance ───────────── */

meRouter.get(
  "/attendance",
  asyncHandler(async (req, res) => {
    const rows = await db("attendance").where({ user_id: req.user!.id }).orderBy("date", "desc");
    const today = rows.find((r) => r.date === todayISO());
    res.json({
      ok: true,
      today: today ? attendanceDto(today, "me") : null,
      records: rows.map((r) => attendanceDto(r, "me")),
    });
  }),
);

const clockSchema = z.object({
  location: z.string().trim().min(1, "Location is required.").max(255),
  selfie: z.string().min(1, "A selfie is required."),
});

meRouter.post(
  "/attendance/clock-in",
  asyncHandler(async (req, res) => {
    const body = parse(clockSchema, req.body);
    const user = req.user!;
    const date = todayISO();
    if (await db("attendance").where({ user_id: user.id, date }).first())
      throw conflict("You have already clocked in today.");
    const selfiePath = await storeDataUrlImage("selfies", body.selfie);
    const row = {
      id: newId(),
      user_id: user.id,
      date,
      clock_in: nowISO(),
      clock_out: null,
      location: body.location,
      clock_out_location: "",
      clock_in_selfie: selfiePath,
      clock_out_selfie: null,
    };
    try {
      await db("attendance").insert(row);
    } catch (e) {
      await deleteStored(selfiePath);
      throw e;
    }
    sendAttendanceToSheet(user, row);
    res.status(201).json({ ok: true, record: attendanceDto(row, "me") });
  }),
);

meRouter.post(
  "/attendance/clock-out",
  asyncHandler(async (req, res) => {
    const body = parse(clockSchema, req.body);
    const user = req.user!;
    const rec = await db("attendance").where({ user_id: user.id, date: todayISO() }).first();
    if (!rec) throw badRequest("You have not clocked in today.", "NOT_CLOCKED_IN");
    if (rec.clock_out) throw conflict("You have already clocked out today.");
    const selfiePath = await storeDataUrlImage("selfies", body.selfie);
    const patch = { clock_out: nowISO(), clock_out_location: body.location, clock_out_selfie: selfiePath };
    await db("attendance").where({ id: rec.id }).update(patch);
    sendAttendanceToSheet(user, { ...rec, ...patch });
    res.json({ ok: true, record: attendanceDto({ ...rec, ...patch }, "me") });
  }),
);

meRouter.get(
  "/attendance/:id/selfie/:kind",
  asyncHandler(async (req, res) => {
    const rec = await db("attendance").where({ id: req.params.id, user_id: req.user!.id }).first();
    const rel = req.params.kind === "out" ? rec?.clock_out_selfie : rec?.clock_in_selfie;
    if (!rec || !rel) throw notFound("Selfie not found.");
    await sendStored(res, rel, `selfie-${rec.date}-${req.params.kind}${rel.slice(rel.lastIndexOf("."))}`, rel.endsWith(".png") ? "image/png" : "image/jpeg", true);
  }),
);

/* ───────────── Leave ───────────── */

const LEAVE_TYPES = ["Annual", "Medical", "Emergency", "Replacement"] as const;

meRouter.get(
  "/leave",
  asyncHandler(async (req, res) => {
    const rows = await db("leave_applications").where({ user_id: req.user!.id }).orderBy("applied_at", "desc");
    res.json({
      ok: true,
      balance: leaveBalance(req.user!),
      replacement: await replacementBalances(req.user!.id),
      applications: rows.map((r) => leaveDto(r, "me")),
    });
  }),
);

/* multipart/form-data: type, from, to, reason, attachment (file, optional;
   required for Medical leave). */
meRouter.post(
  "/leave",
  upload.single("attachment"),
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        type: z.enum(LEAVE_TYPES),
        from: z.string().refine(isValidDate, "Invalid start date."),
        to: z.string().refine(isValidDate, "Invalid end date."),
        reason: z.string().trim().max(2000).optional().default(""),
        replacementId: z.string().optional(),
      }),
      req.body,
    );
    const user = req.user!;
    // Replacement leave needs no reason or document; other leave needs a reason.
    if (body.type !== "Replacement" && !body.reason) throw badRequest("Please complete all fields.");
    if (body.to < body.from) throw badRequest("End date must be after the start date.");
    if (body.type === "Medical" && !req.file)
      throw badRequest("A supporting document is required for Medical leave.", "ATTACHMENT_REQUIRED");
    const days = daysBetween(body.from, body.to) + 1;
    let typeLabel: string | null = null;
    if (body.type === "Replacement") {
      // Replacement leave uses the staff member's own grant for that entry.
      const grant = await db("replacement_grants as g")
        .join("replacement_leaves as r", "r.id", "g.replacement_id")
        .where({ "g.user_id": user.id, "g.replacement_id": body.replacementId || "" })
        .select("r.name", "r.expires_on", "g.balance")
        .first();
      if (!grant) throw badRequest("Please choose which replacement leave to use.");
      if (grant.expires_on && (todayISO() > grant.expires_on || body.to > grant.expires_on))
        throw badRequest(`${grant.name} must be used by ${fmtDate(grant.expires_on)}.`, "REPLACEMENT_EXPIRED");
      if (days > Number(grant.balance)) throw badRequest(`Insufficient ${grant.name} balance.`, "INSUFFICIENT_BALANCE");
      typeLabel = grant.name;
    } else {
      const balance = leaveBalance(user)[body.type];
      if (days > balance) throw badRequest(`Insufficient ${body.type} leave balance.`, "INSUFFICIENT_BALANCE");
    }

    const overlap = await db("leave_applications")
      .where({ user_id: user.id })
      .whereIn("status", ["Pending", "Approved"])
      .andWhere("date_from", "<=", body.to)
      .andWhere("date_to", ">=", body.from)
      .first();
    if (overlap) throw conflict("You already have a leave application covering these dates.");

    const file = req.file ? await storeUpload("leave", req.file) : null;
    const row = {
      id: newId(),
      user_id: user.id,
      type: body.type,
      date_from: body.from,
      date_to: body.to,
      days,
      reason: body.reason,
      status: "Pending",
      applied_at: nowISO(),
      attachment_name: file?.name ?? null,
      attachment_type: file?.type ?? null,
      attachment_size: file?.size ?? null,
      attachment_path: file?.path ?? null,
      replacement_id: body.type === "Replacement" ? body.replacementId : null,
      type_label: typeLabel,
    };
    try {
      await db.transaction(async (trx) => {
        await trx("leave_applications").insert(row);
        const f = fmtDate(body.from);
        const t = fmtDate(body.to);
        await notify.leaveSubmitted(user.id, typeLabel || body.type, f, t, row.id, trx);
        await notify.adminLeaveSubmitted(user.full_name, typeLabel || body.type, f, t, row.id, trx);
      });
    } catch (e) {
      await deleteStored(file?.path);
      throw e;
    }
    res.status(201).json({ ok: true, application: leaveDto(row, "me") });
  }),
);

/* Staff may withdraw a leave that is still Pending. */
meRouter.delete(
  "/leave/:id",
  asyncHandler(async (req, res) => {
    const app = await db("leave_applications").where({ id: req.params.id, user_id: req.user!.id }).first();
    if (!app) throw notFound("Leave application not found.");
    if (app.status !== "Pending") throw badRequest("Only pending applications can be withdrawn.");
    await db("leave_applications").where({ id: app.id }).del();
    await deleteStored(app.attachment_path);
    res.json({ ok: true });
  }),
);

meRouter.get(
  "/leave/:id/attachment",
  asyncHandler(async (req, res) => {
    const app = await db("leave_applications").where({ id: req.params.id, user_id: req.user!.id }).first();
    if (!app?.attachment_path) throw notFound("Attachment not found.");
    await sendStored(res, app.attachment_path, app.attachment_name, app.attachment_type);
  }),
);

/* ───────────── Claims ───────────── */

meRouter.get(
  "/claims",
  asyncHandler(async (req, res) => {
    const rows = await db("claims").where({ user_id: req.user!.id }).orderBy("date", "desc");
    const claims = rows.map(claimDto);
    const approvedTotal = claims.filter((c) => c.status === "Approved").reduce((s, c) => s + c.amount, 0);
    res.json({ ok: true, claims, approvedTotal });
  }),
);

meRouter.post(
  "/claims",
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        type: z.enum(["Travel", "Medical", "Equipment", "Others"]),
        amount: z.coerce.number().positive("Amount must be more than 0.").max(1_000_000),
        date: z.string().refine(isValidDate, "Invalid date."),
        desc: z.string().trim().min(1, "Please complete all fields.").max(1000),
      }),
      req.body,
    );
    if (body.date > todayISO()) throw badRequest("Claim date cannot be in the future.");
    const user = req.user!;
    const row = {
      id: newId(),
      user_id: user.id,
      type: body.type,
      amount: Math.round(body.amount * 100) / 100,
      date: body.date,
      description: body.desc,
      status: "Pending",
      created_at: nowISO(),
    };
    await db.transaction(async (trx) => {
      await trx("claims").insert(row);
      await notify.claimSubmitted(user.id, row.id, trx);
      await notify.adminClaimSubmitted(user.full_name, row.amount, row.id, trx);
    });
    res.status(201).json({ ok: true, claim: claimDto(row) });
  }),
);

/* ───────────── Evaluations (read-only for staff) ───────────── */

meRouter.get(
  "/evaluations",
  asyncHandler(async (req, res) => {
    const rows = await db("evaluations").where({ user_id: req.user!.id }).orderBy("created_at", "asc");
    res.json({ ok: true, evaluations: rows.map(evaluationDto) });
  }),
);

/* ───────────── Payslips (own, active only) ───────────── */

meRouter.get(
  "/payslips",
  asyncHandler(async (req, res) => {
    const user = req.user! as UserRow;
    const rows = await db("payslips")
      .where({ user_id: user.id, status: "active" })
      .orderBy([{ column: "year", order: "desc" }, { column: "month", order: "desc" }]);
    res.json({ ok: true, payslips: rows.map((r) => payslipDto(r, user.username, "me")) });
  }),
);

meRouter.get(
  "/payslips/:id/file",
  asyncHandler(async (req, res) => {
    const p = await db("payslips").where({ id: req.params.id, user_id: req.user!.id, status: "active" }).first();
    if (!p) throw notFound("Payslip not found.");
    await sendStored(res, p.file_path, p.file_name, p.file_type, req.query.inline === "1");
  }),
);
