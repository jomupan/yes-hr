import { Router } from "express";
import { z } from "zod";
import { db } from "../../db/knex";
import { asyncHandler, badRequest, conflict, notFound, parse } from "../../lib/errors";
import { dopeStatus } from "../../lib/dope";
import { daysBetween, fmtDate, isValidDate, nowISO, todayISO } from "../../lib/time";
import { sendStored } from "../../lib/files";
import { logAudit } from "../../services/audit";
import { notify } from "../../services/notifications";
import {
  attendanceDto,
  claimDto,
  dopeDto,
  evaluationDto,
  leaveBalance,
  leaveDto,
  payslipDto,
} from "../../services/records";
import { findUserByUsername, newId, toProfiles, UserRow } from "../../services/users";

export const employeesRouter = Router();

async function getEmployeeOr404(username: string): Promise<UserRow> {
  const u = await findUserByUsername(username);
  if (!u) throw notFound("Employee not found.");
  return u;
}

/* ───────────── Employee list ─────────────
   Query: search, status=active|inactive, role=staff|admin, companyId, departmentId */
employeesRouter.get(
  "/employees",
  asyncHandler(async (req, res) => {
    const q = db<UserRow>("users").orderBy("full_name");
    const { search, status, role, companyId, departmentId } = req.query as Record<string, string | undefined>;
    if (status === "active" || status === "inactive") q.where({ account_status: status });
    if (role === "staff" || role === "admin") q.where({ auth_role: role });
    if (companyId) q.where({ company_id: companyId });
    if (departmentId) q.where({ department_id: departmentId });
    if (search) {
      const s = `%${search.toLowerCase()}%`;
      q.where((w) =>
        w
          .whereRaw("lower(full_name) like ?", [s])
          .orWhereRaw("lower(username) like ?", [s])
          .orWhereRaw("lower(email) like ?", [s])
          .orWhereRaw("lower(employee_id) like ?", [s]),
      );
    }
    const users = await q;
    const profiles = await toProfiles(users);
    const ids = users.map((u) => u.id);
    const [dopeRows, pending] = await Promise.all([
      ids.length ? db("dope_results").whereIn("user_id", ids).orderBy("date", "asc") : [],
      ids.length
        ? db("leave_applications").whereIn("user_id", ids).where({ status: "Pending" }).select("user_id").count({ n: "*" }).groupBy("user_id")
        : [],
    ]);
    const dopeBy = new Map<string, any[]>();
    dopeRows.forEach((r: any) => dopeBy.set(r.user_id, [...(dopeBy.get(r.user_id) || []), dopeDto(r)]));
    const pendingBy = new Map(pending.map((r: any) => [r.user_id, Number(r.n)]));
    res.json({
      ok: true,
      employees: users.map((u, i) => {
        const history = dopeBy.get(u.id) || [];
        return {
          username: u.username,
          profile: profiles[i],
          leaveBalance: leaveBalance(u),
          pendingLeave: pendingBy.get(u.id) || 0,
          dope: { history, status: dopeStatus(history) },
        };
      }),
    });
  }),
);

/* Full record for one employee (mirrors frontend AdminEmployee). */
employeesRouter.get(
  "/employees/:username",
  asyncHandler(async (req, res) => {
    const u = await getEmployeeOr404(req.params.username);
    const [profile] = await toProfiles([u]);
    const [dope, att, leave, claims, evals, payslips] = await Promise.all([
      db("dope_results").where({ user_id: u.id }).orderBy("date", "asc"),
      db("attendance").where({ user_id: u.id }).orderBy("date", "desc"),
      db("leave_applications").where({ user_id: u.id }).orderBy("applied_at", "desc"),
      db("claims").where({ user_id: u.id }).orderBy("date", "desc"),
      db("evaluations").where({ user_id: u.id }).orderBy("created_at", "asc"),
      db("payslips").where({ user_id: u.id }).orderBy([{ column: "year", order: "desc" }, { column: "month", order: "desc" }]),
    ]);
    const history = dope.map(dopeDto);
    res.json({
      ok: true,
      employee: {
        username: u.username,
        profile,
        dope: { history, status: dopeStatus(history) },
        attendance: { records: att.map((r) => attendanceDto(r, "admin")) },
        leave: { balance: leaveBalance(u), applications: leave.map((r) => leaveDto(r, "admin")) },
        claim: { claims: claims.map(claimDto) },
        evaluation: { evaluations: evals.map(evaluationDto) },
        payslips: payslips.map((r) => payslipDto(r, u.username, "admin")),
      },
    });
  }),
);

/* Update an employee's profile / org assignment / leave balances. */
employeesRouter.patch(
  "/employees/:username",
  asyncHandler(async (req, res) => {
    const u = await getEmployeeOr404(req.params.username);
    const body = parse(
      z.object({
        fullName: z.string().trim().min(1).max(160).optional(),
        role: z.string().trim().max(120).optional(),
        email: z.string().trim().email("A valid email is required.").optional(),
        employeeId: z.string().trim().min(1).max(40).optional(),
        companyId: z.string().nullable().optional(),
        departmentId: z.string().nullable().optional(),
        leaveBalance: z
          .object({
            Annual: z.number().int().min(0).max(365).optional(),
            Medical: z.number().int().min(0).max(365).optional(),
            Emergency: z.number().int().min(0).max(365).optional(),
          })
          .optional(),
      }),
      req.body,
    );
    const patch: Partial<UserRow> = { updated_at: nowISO() };
    if (body.fullName) patch.full_name = body.fullName;
    if (body.role !== undefined) patch.job_title = body.role || "Staff";
    if (body.email) {
      const email = body.email.toLowerCase();
      if (await db("users").whereRaw("lower(email) = ?", [email]).whereNot({ id: u.id }).first())
        throw conflict("That email is already in use.");
      patch.email = email;
    }
    if (body.employeeId) {
      if (await db("users").where({ employee_id: body.employeeId }).whereNot({ id: u.id }).first())
        throw conflict("That employee ID is already in use.");
      patch.employee_id = body.employeeId;
    }
    const companyId = body.companyId !== undefined ? body.companyId : u.company_id;
    const departmentId = body.departmentId !== undefined ? body.departmentId : u.department_id;
    if (body.companyId !== undefined || body.departmentId !== undefined) {
      if (companyId && !(await db("companies").where({ id: companyId }).first())) throw badRequest("Company not found.");
      if (departmentId) {
        const dept = await db("departments").where({ id: departmentId }).first();
        if (!dept) throw badRequest("Department not found.");
        if (companyId && dept.company_id !== companyId)
          throw badRequest("The selected department does not belong to the selected company.");
      }
      patch.company_id = companyId || null;
      patch.department_id = departmentId || null;
    }
    if (body.leaveBalance) {
      if (body.leaveBalance.Annual !== undefined) patch.leave_annual = body.leaveBalance.Annual;
      if (body.leaveBalance.Medical !== undefined) patch.leave_medical = body.leaveBalance.Medical;
      if (body.leaveBalance.Emergency !== undefined) patch.leave_emergency = body.leaveBalance.Emergency;
    }
    await db("users").where({ id: u.id }).update(patch);
    await logAudit({ action: "employee_updated", actor: req.user!.username, target: u.username, detail: `Updated profile for ${u.full_name}.` });
    const [profile] = await toProfiles([{ ...u, ...patch } as UserRow]);
    res.json({ ok: true, profile });
  }),
);

/* Soft delete / restore staff. Admin accounts are managed under /admins. */
employeesRouter.post(
  "/employees/:username/:action(deactivate|reactivate)",
  asyncHandler(async (req, res) => {
    const u = await getEmployeeOr404(req.params.username);
    const deactivate = req.params.action === "deactivate";
    if (deactivate) {
      if (u.auth_role === "admin") throw badRequest("Admin accounts cannot be deactivated here. Use Admin Accounts.");
      if (u.id === req.user!.id) throw badRequest("You cannot deactivate your own account.");
    }
    await db("users").where({ id: u.id }).update({ account_status: deactivate ? "inactive" : "active", updated_at: nowISO() });
    await logAudit({
      action: deactivate ? "staff_deactivated" : "staff_reactivated",
      actor: req.user!.username,
      target: u.username,
      detail: `${deactivate ? "Deactivated" : "Reactivated"} staff account ${u.full_name}.`,
    });
    res.json({ ok: true });
  }),
);

/* ───────────── Evaluations ───────────── */

employeesRouter.post(
  "/employees/:username/evaluations",
  asyncHandler(async (req, res) => {
    const u = await getEmployeeOr404(req.params.username);
    const body = parse(
      z.object({
        period: z.string().trim().min(1, "Period is required.").max(40),
        overall: z.number().int().min(0).max(100),
        categories: z.record(z.number().min(0).max(100)),
        comments: z.string().trim().max(4000).default(""),
      }),
      req.body,
    );
    const row = {
      id: newId(),
      user_id: u.id,
      period: body.period,
      overall: body.overall,
      categories: JSON.stringify(body.categories),
      comments: body.comments,
      created_by: req.user!.username,
      created_at: nowISO(),
    };
    await db.transaction(async (trx) => {
      await trx("evaluations").insert(row);
      await notify.evaluationAdded(u.id, body.period, row.id, trx);
    });
    res.status(201).json({ ok: true, evaluation: evaluationDto(row) });
  }),
);

employeesRouter.delete(
  "/evaluations/:id",
  asyncHandler(async (req, res) => {
    const n = await db("evaluations").where({ id: req.params.id }).del();
    if (!n) throw notFound("Evaluation not found.");
    res.json({ ok: true });
  }),
);

/* ───────────── Leave management ───────────── */

/* Query: status, type, username, from, to (overlap), departmentId */
employeesRouter.get(
  "/leave",
  asyncHandler(async (req, res) => {
    const { status, type, username, from, to, departmentId } = req.query as Record<string, string | undefined>;
    const q = db("leave_applications as l")
      .join("users as u", "u.id", "l.user_id")
      .leftJoin("departments as d", "d.id", "u.department_id")
      .select("l.*", "u.username", "u.full_name", "u.employee_id", "d.name as department_name")
      .orderBy("l.applied_at", "desc");
    if (status) q.where("l.status", status);
    if (type) q.where("l.type", type);
    if (username) q.where("u.username", username);
    if (departmentId) q.where("u.department_id", departmentId);
    if (from && isValidDate(from)) q.where("l.date_to", ">=", from);
    if (to && isValidDate(to)) q.where("l.date_from", "<=", to);
    const rows = await q;
    res.json({
      ok: true,
      applications: rows.map((r) => ({
        ...leaveDto(r, "admin"),
        appId: r.id,
        username: r.username,
        fullName: r.full_name,
        employeeId: r.employee_id,
        department: r.department_name || "Unassigned",
      })),
    });
  }),
);

/* Approve / reject (or move back to Pending). Balance is deducted on approval
   and restored if a previously approved leave is changed, same as frontend. */
employeesRouter.patch(
  "/leave/:id/status",
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({ status: z.enum(["Pending", "Approved", "Rejected"]), rejectionReason: z.string().trim().max(1000).optional() }),
      req.body,
    );
    const result = await db.transaction(async (trx) => {
      const app = await trx("leave_applications").where({ id: req.params.id }).first();
      if (!app) throw notFound("Leave application not found.");
      const user = await trx<UserRow>("users").where({ id: app.user_id }).first();
      if (!user) throw notFound("Employee not found.");
      const prev = app.status;
      if (prev === body.status) return { app, changed: false };

      const col = ({ Annual: "leave_annual", Medical: "leave_medical", Emergency: "leave_emergency" } as const)[
        app.type as "Annual" | "Medical" | "Emergency"
      ];
      if (body.status === "Approved") {
        if (user[col] < app.days)
          throw badRequest(`${user.full_name} only has ${user[col]} ${app.type} day(s) left.`, "INSUFFICIENT_BALANCE");
        await trx("users").where({ id: user.id }).update({ [col]: user[col] - app.days });
      } else if (prev === "Approved") {
        await trx("users").where({ id: user.id }).update({ [col]: user[col] + app.days });
      }
      const patch = {
        status: body.status,
        rejection_reason: body.status === "Rejected" ? body.rejectionReason || null : null,
        reviewed_by: req.user!.username,
        reviewed_at: nowISO(),
      };
      await trx("leave_applications").where({ id: app.id }).update(patch);
      const f = fmtDate(app.date_from);
      const t = fmtDate(app.date_to);
      if (body.status === "Approved") await notify.leaveApproved(user.id, app.type, f, t, app.id, trx);
      if (body.status === "Rejected") await notify.leaveRejected(user.id, app.type, f, t, app.id, body.rejectionReason, trx);
      await logAudit(
        { action: `leave_${body.status.toLowerCase()}`, actor: req.user!.username, target: user.username, detail: `${body.status} ${app.type} leave ${app.date_from} to ${app.date_to}.` },
        trx,
      );
      return { app: { ...app, ...patch }, changed: true };
    });
    res.json({ ok: true, changed: result.changed, application: leaveDto(result.app, "admin") });
  }),
);

employeesRouter.get(
  "/leave/:id/attachment",
  asyncHandler(async (req, res) => {
    const app = await db("leave_applications").where({ id: req.params.id }).first();
    if (!app?.attachment_path) throw notFound("Attachment not found.");
    await sendStored(res, app.attachment_path, app.attachment_name, app.attachment_type, req.query.inline === "1");
  }),
);

/* Approved (and optionally pending) leave overlapping a month, for the
   calendar view. Query: month=YYYY-MM (default current), includePending=1 */
employeesRouter.get(
  "/leave-calendar",
  asyncHandler(async (req, res) => {
    const month = /^\d{4}-\d{2}$/.test(String(req.query.month)) ? String(req.query.month) : todayISO().slice(0, 7);
    const start = `${month}-01`;
    const [y, m] = month.split("-").map(Number);
    const end = `${month}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, "0")}`;
    const statuses = req.query.includePending === "1" ? ["Approved", "Pending"] : ["Approved"];
    const rows = await db("leave_applications as l")
      .join("users as u", "u.id", "l.user_id")
      .leftJoin("departments as d", "d.id", "u.department_id")
      .whereIn("l.status", statuses)
      .where("l.date_from", "<=", end)
      .where("l.date_to", ">=", start)
      .select("l.*", "u.username", "u.full_name", "d.name as department_name")
      .orderBy("l.date_from");
    const today = todayISO();
    res.json({
      ok: true,
      month,
      range: { start, end },
      onLeaveToday: rows.filter((r) => r.status === "Approved" && r.date_from <= today && r.date_to >= today).length,
      entries: rows.map((r) => ({
        ...leaveDto(r, "admin"),
        username: r.username,
        fullName: r.full_name,
        department: r.department_name || "Unassigned",
        daysInMonth: daysBetween(r.date_from > start ? r.date_from : start, r.date_to < end ? r.date_to : end) + 1,
      })),
    });
  }),
);

/* ───────────── Claims management ───────────── */

employeesRouter.get(
  "/claims",
  asyncHandler(async (req, res) => {
    const { status, type, username } = req.query as Record<string, string | undefined>;
    const q = db("claims as c")
      .join("users as u", "u.id", "c.user_id")
      .leftJoin("departments as d", "d.id", "u.department_id")
      .select("c.*", "u.username", "u.full_name", "d.name as department_name")
      .orderBy("c.created_at", "desc");
    if (status) q.where("c.status", status);
    if (type) q.where("c.type", type);
    if (username) q.where("u.username", username);
    const rows = await q;
    res.json({
      ok: true,
      claims: rows.map((r) => ({
        ...claimDto(r),
        username: r.username,
        fullName: r.full_name,
        department: r.department_name || "Unassigned",
        reviewedBy: r.reviewed_by ?? undefined,
        reviewedAt: r.reviewed_at ?? undefined,
      })),
    });
  }),
);

employeesRouter.patch(
  "/claims/:id/status",
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({ status: z.enum(["Pending", "Approved", "Rejected"]), rejectionReason: z.string().trim().max(1000).optional() }),
      req.body,
    );
    const claim = await db("claims").where({ id: req.params.id }).first();
    if (!claim) throw notFound("Claim not found.");
    if (claim.status === body.status) return res.json({ ok: true, changed: false, claim: claimDto(claim) });
    const patch = {
      status: body.status,
      rejection_reason: body.status === "Rejected" ? body.rejectionReason || null : null,
      reviewed_by: req.user!.username,
      reviewed_at: nowISO(),
    };
    await db.transaction(async (trx) => {
      await trx("claims").where({ id: claim.id }).update(patch);
      if (body.status === "Approved") await notify.claimApproved(claim.user_id, claim.id, trx);
      if (body.status === "Rejected") await notify.claimRejected(claim.user_id, claim.id, body.rejectionReason, trx);
    });
    res.json({ ok: true, changed: true, claim: claimDto({ ...claim, ...patch }) });
  }),
);
