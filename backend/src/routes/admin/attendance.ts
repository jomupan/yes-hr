import { Router } from "express";
import { z } from "zod";
import { db } from "../../db/knex";
import { asyncHandler, badRequest, notFound, parse } from "../../lib/errors";
import { fmtDate, isValidDate, localDateTimeToISO, todayISO } from "../../lib/time";
import { logAudit } from "../../services/audit";
import { createNotification } from "../../services/notifications";
import { sendAttendanceToSheet } from "../../services/sheets";
import { sendStored } from "../../lib/files";
import { attendanceDto, attendanceStatusOf } from "../../services/records";
import { toProfiles, UserRow } from "../../services/users";

export const attendanceRouter = Router();

/* Build the per-employee rows for one date. Active employees with no record
   appear as "Not Clocked In"; inactive employees only appear if they have a
   record that day (same rule as the frontend admin attendance page). */
export async function attendanceForDate(date: string) {
  const users = await db<UserRow>("users").where({auth_role: "staff"}).orderBy("full_name");
  const profiles = await toProfiles(users);
  const records = await db("attendance").where({ date });
  const byUser = new Map(records.map((r: any) => [r.user_id, r]));
  const rows = [];
  for (let i = 0; i < users.length; i++) {
    const u = users[i];
    const rec = byUser.get(u.id);
    if (!rec && u.account_status === "inactive") continue;
    const p = profiles[i];
    rows.push({
      username: u.username,
      fullName: u.full_name,
      employeeId: u.employee_id,
      department: p.department,
      company: p.company,
      status: attendanceStatusOf(rec),
      record: rec ? attendanceDto(rec, "admin") : null,
      hours: rec ? attendanceDto(rec, "admin").hours : null,
    });
  }
  const summary = {
    totalActive: users.filter((u) => u.account_status === "active").length,
    present: rows.filter((r) => r.status === "Present").length,
    late: rows.filter((r) => r.status === "Late").length,
    notClockedIn: rows.filter((r) => r.status === "Not Clocked In").length,
    clockedOut: rows.filter((r) => r.record?.clockOut).length,
    currentlyWorking: rows.filter((r) => r.status === "Currently Working").length,
  };
  return { rows, summary };
}

/* GET /attendance?date=YYYY-MM-DD (default today) → rows + summary */
attendanceRouter.get(
  "/attendance",
  asyncHandler(async (req, res) => {
    const date = typeof req.query.date === "string" ? req.query.date : todayISO();
    if (!isValidDate(date)) throw badRequest("Invalid date.");
    const { rows, summary } = await attendanceForDate(date);
    const status = req.query.status;
    res.json({ ok: true, date, summary, rows: typeof status === "string" ? rows.filter((r) => r.status === status) : rows });
  }),
);

/* GET /attendance/records?from=&to=&username= → historical records */
attendanceRouter.get(
  "/attendance/records",
  asyncHandler(async (req, res) => {
    const { from, to, username } = req.query as Record<string, string | undefined>;
    const q = db("attendance as a")
      .join("users as u", "u.id", "a.user_id")
      .leftJoin("departments as d", "d.id", "u.department_id")
      .leftJoin("companies as c", "c.id", "u.company_id")
      .select("a.*", "u.username", "u.full_name", "u.employee_id", "d.name as department_name", "c.name as company_name")
      .orderBy("a.date", "desc")
      .limit(5000);
    if (from && isValidDate(from)) q.where("a.date", ">=", from);
    if (to && isValidDate(to)) q.where("a.date", "<=", to);
    if (username) q.where("u.username", username);
    const rows = await q;
    res.json({
      ok: true,
      rows: rows.map((r) => {
        const rec = attendanceDto(r, "admin");
        return {
          username: r.username,
          fullName: r.full_name,
          employeeId: r.employee_id,
          department: r.department_name || "Unassigned",
          company: r.company_name || "YES EMPIRE Group",
          status: attendanceStatusOf(r),
          hours: rec.hours,
          record: rec,
        };
      }),
    });
  }),
);

/* GET /attendance/employee/:username → one employee's history + stats */
attendanceRouter.get(
  "/attendance/employee/:username",
  asyncHandler(async (req, res) => {
    const u = await db<UserRow>("users").where({ username: req.params.username }).first();
    if (!u) throw notFound("Employee not found.");
    const [profile] = await toProfiles([u]);
    const recs = await db("attendance").where({ user_id: u.id }).orderBy("date", "desc");
    const rows = recs.map((r) => ({ status: attendanceStatusOf(r), record: attendanceDto(r, "admin") }));
    const completed = rows.filter((r) => r.record.hours !== null);
    res.json({
      ok: true,
      profile,
      stats: {
        days: rows.length,
        late: rows.filter((r) => r.status === "Late").length,
        onTime: rows.filter((r) => r.status === "Present").length,
        avgHours: completed.length ? completed.reduce((s, r) => s + (r.record.hours || 0), 0) / completed.length : 0,
      },
      rows,
    });
  }),
);

attendanceRouter.get(
  "/attendance/:id/selfie/:kind(in|out)",
  asyncHandler(async (req, res) => {
    const rec = await db("attendance").where({ id: req.params.id }).first();
    const rel = req.params.kind === "out" ? rec?.clock_out_selfie : rec?.clock_in_selfie;
    if (!rec || !rel) throw notFound("Selfie not found.");
    await sendStored(res, rel, `selfie-${rec.date}-${req.params.kind}${rel.slice(rel.lastIndexOf("."))}`, rel.endsWith(".png") ? "image/png" : "image/jpeg", true);
  }),
);

/* PATCH /attendance/:id/clock-out { time: "HH:MM" }
   For staff who forgot to clock out: HR fills in (or corrects) the
   clock-out time. The record is marked as set by that admin. */
attendanceRouter.patch(
  "/attendance/:id/clock-out",
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({ time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Please enter a time like 17:30.") }),
      req.body,
    );
    const rec = await db("attendance").where({ id: req.params.id }).first();
    if (!rec) throw notFound("Attendance record not found.");
    const clockOut = localDateTimeToISO(rec.date, body.time);
    if (clockOut <= rec.clock_in) throw badRequest("Clock-out time must be after the clock-in time.");
    if (clockOut > new Date().toISOString()) throw badRequest("Clock-out time can't be in the future.");
    const patch = {
      clock_out: clockOut,
      clock_out_location: rec.clock_out_location || "Set by HR",
      clock_out_by: req.user!.username,
    };
    await db("attendance").where({ id: rec.id }).update(patch);
    const user = await db<UserRow>("users").where({ id: rec.user_id }).first();
    const updated = { ...rec, ...patch };
    if (user) {
      await createNotification({
        userId: user.id,
        category: "attendance",
        title: "Clock-Out Time Added",
        message: `HR set your clock-out time for ${fmtDate(rec.date)} to ${body.time}.`,
        actionLabel: "View Attendance",
        actionModule: "attendance",
      });
      sendAttendanceToSheet(user, updated);
    }
    await logAudit({
      action: "attendance_clock_out_set",
      actor: req.user!.username,
      target: user?.username || rec.user_id,
      detail: `Set clock-out ${body.time} for ${rec.date}.`,
    });
    res.json({ ok: true, row: { status: attendanceStatusOf(updated), record: attendanceDto(updated, "admin") } });
  }),
);
