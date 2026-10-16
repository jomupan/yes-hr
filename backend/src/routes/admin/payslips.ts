import { Router } from "express";
import { z } from "zod";
import { db } from "../../db/knex";
import { asyncHandler, badRequest, conflict, notFound, parse } from "../../lib/errors";
import { nowISO } from "../../lib/time";
import { deleteStored, sendStored, storeUpload } from "../../lib/files";
import { upload } from "../../middleware/upload";
import { notify } from "../../services/notifications";
import { payslipDto } from "../../services/records";
import { newId, UserRow } from "../../services/users";
import { logAudit } from "../../services/audit";

export const payslipsRouter = Router();

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const periodLabel = (m: number, y: number) => `${MONTHS[m - 1]} ${y}`;

/* GET /payslips?status=active|removed|all&username=&year=&month= */
payslipsRouter.get(
  "/payslips",
  asyncHandler(async (req, res) => {
    const { status = "active", username, year, month } = req.query as Record<string, string | undefined>;
    const q = db("payslips as p")
      .join("users as u", "u.id", "p.user_id")
      .select("p.*", "u.username", "u.full_name", "u.employee_id")
      .orderBy("p.created_at", "desc");
    if (status !== "all") q.where("p.status", status);
    if (username) q.where("u.username", username);
    if (year) q.where("p.year", Number(year));
    if (month) q.where("p.month", Number(month));
    const rows = await q;
    res.json({
      ok: true,
      payslips: rows.map((r) => ({
        ...payslipDto(r, r.username, "admin"),
        fullName: r.full_name,
        employeeId: r.employee_id,
        period: periodLabel(r.month, r.year),
      })),
    });
  }),
);

/* Active employees for the upload dropdown. */
payslipsRouter.get(
  "/payslips/employees",
  asyncHandler(async (_req, res) => {
    const rows = await db("users").where({ account_status: "active" }).select("username", "full_name", "employee_id").orderBy("full_name");
    res.json({ ok: true, employees: rows.map((r) => ({ username: r.username, fullName: r.full_name, employeeId: r.employee_id })) });
  }),
);

/* POST /payslips (multipart): username, month, year, note?, file */
payslipsRouter.post(
  "/payslips",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        username: z.string().min(1, "Please select an employee."),
        month: z.coerce.number().int().min(1).max(12),
        year: z.coerce.number().int().min(2000).max(2100),
        note: z.string().trim().max(500).optional().default(""),
      }),
      req.body,
    );
    if (!req.file) throw badRequest("Please choose a payslip file.");
    const user = await db<UserRow>("users").where({ username: body.username }).first();
    if (!user) throw badRequest("Employee not found.");
    if (await db("payslips").where({ user_id: user.id, month: body.month, year: body.year, status: "active" }).first())
      throw conflict(`A payslip already exists for this employee for ${periodLabel(body.month, body.year)}.`);
    const file = await storeUpload("payslips", req.file);
    const now = nowISO();
    const row = {
      id: newId(),
      user_id: user.id,
      month: body.month,
      year: body.year,
      file_name: file.name,
      file_type: file.type,
      file_size: file.size,
      file_path: file.path,
      note: body.note || null,
      status: "active",
      uploaded_by: req.user!.username,
      created_at: now,
      updated_at: now,
    };
    try {
      await db.transaction(async (trx) => {
        await trx("payslips").insert(row);
        await notify.payslipAvailable(user.id, periodLabel(body.month, body.year), row.id, trx);
      });
    } catch (e) {
      await deleteStored(file.path);
      throw e;
    }
    res.status(201).json({ ok: true, payslip: payslipDto(row, user.username, "admin") });
  }),
);

/* PUT /payslips/:id/file (multipart: file) — replace the document. */
payslipsRouter.put(
  "/payslips/:id/file",
  upload.single("file"),
  asyncHandler(async (req, res) => {
    const p = await db("payslips").where({ id: req.params.id }).first();
    if (!p) throw notFound("Payslip not found.");
    if (!req.file) throw badRequest("Please choose a payslip file.");
    const file = await storeUpload("payslips", req.file);
    const patch = { file_name: file.name, file_type: file.type, file_size: file.size, file_path: file.path, updated_at: nowISO() };
    await db("payslips").where({ id: p.id }).update(patch);
    await deleteStored(p.file_path);
    const u = await db("users").where({ id: p.user_id }).first();
    res.json({ ok: true, payslip: payslipDto({ ...p, ...patch }, u.username, "admin") });
  }),
);

/* DELETE /payslips/:id — soft remove (staff can no longer see it). */
payslipsRouter.delete(
  "/payslips/:id",
  asyncHandler(async (req, res) => {
    const p = await db("payslips").where({ id: req.params.id }).first();
    if (!p) throw notFound("Payslip not found.");
    await db("payslips").where({ id: p.id }).update({ status: "removed", updated_at: nowISO() });
    await logAudit({ action: "payslip_removed", actor: req.user!.username, target: p.id, detail: `Removed payslip ${periodLabel(p.month, p.year)}.` });
    res.json({ ok: true });
  }),
);

payslipsRouter.get(
  "/payslips/:id/file",
  asyncHandler(async (req, res) => {
    const p = await db("payslips").where({ id: req.params.id }).first();
    if (!p) throw notFound("Payslip not found.");
    await sendStored(res, p.file_path, p.file_name, p.file_type, req.query.inline === "1");
  }),
);
