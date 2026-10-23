import { Router } from "express";
import { z } from "zod";
import { db } from "../../db/knex";
import { asyncHandler, parse } from "../../lib/errors";
import { daysBetween, isValidDate, nowISO, todayISO } from "../../lib/time";
import { logAudit } from "../../services/audit";
import { defaultLeaveBalances, toProfiles, UserRow } from "../../services/users";
import { leaveDto } from "../../services/records";
import { attendanceForDate } from "./attendance";
import { attendanceStatusOf } from "../../services/records";

export const systemRouter = Router();

/* ───────────── Dashboard ───────────── */

systemRouter.get(
  "/dashboard",
  asyncHandler(async (_req, res) => {
    const today = todayISO();
    const [users, pendingLeave, pendingClaims, onLeave, recent, att] = await Promise.all([
      db("users").select("account_status", "auth_role"),
      db("leave_applications").where({ status: "Pending" }).count({ n: "*" }).first(),
      db("claims").where({ status: "Pending" }).count({ n: "*" }).first(),
      db("leave_applications as l")
        .join("users as u", "u.id", "l.user_id")
        .where("l.status", "Approved")
        .where("l.date_from", "<=", today)
        .where("l.date_to", ">=", today)
        .select("l.*", "u.username", "u.full_name"),
      db("leave_applications as l")
        .join("users as u", "u.id", "l.user_id")
        .select("l.*", "u.username", "u.full_name")
        .orderBy("l.applied_at", "desc")
        .limit(5),
      attendanceForDate(today),
    ]);
    res.json({
      ok: true,
      date: today,
      employees: {
        total: users.length,
        active: users.filter((u: any) => u.account_status === "active").length,
        inactive: users.filter((u: any) => u.account_status === "inactive").length,
        admins: users.filter((u: any) => u.auth_role === "admin").length,
      },
      pendingLeave: Number(pendingLeave?.n ?? 0),
      pendingClaims: Number(pendingClaims?.n ?? 0),
      onLeaveToday: onLeave.map((r: any) => ({ ...leaveDto(r, "admin"), username: r.username, fullName: r.full_name })),
      attendanceToday: att.summary,
      recentLeave: recent.map((r: any) => ({ ...leaveDto(r, "admin"), username: r.username, fullName: r.full_name })),
    });
  }),
);

/* ───────────── Reports ─────────────
   GET /reports?from=YYYY-MM-DD&to=YYYY-MM-DD (default: current month) */
systemRouter.get(
  "/reports",
  asyncHandler(async (req, res) => {
    const today = todayISO();
    const from = isValidDate(String(req.query.from)) ? String(req.query.from) : `${today.slice(0, 7)}-01`;
    const to = isValidDate(String(req.query.to)) ? String(req.query.to) : today;

    const users = await db<UserRow>("users");
    const profiles = await toProfiles(users);
    const deptOf = new Map(users.map((u, i) => [u.id, profiles[i].department]));
    const companyOf = new Map(users.map((u, i) => [u.id, profiles[i].company]));

    const [leaves, claims, attendance, dope] = await Promise.all([
      db("leave_applications").where("date_from", "<=", to).where("date_to", ">=", from),
      db("claims").where("date", ">=", from).where("date", "<=", to),
      db("attendance").where("date", ">=", from).where("date", "<=", to),
      db("dope_results").select("user_id", "personality_type", "date").orderBy("date", "asc"),
    ]);

    const tally = <T>(items: T[], key: (t: T) => string, val: (t: T) => number = () => 1) =>
      items.reduce<Record<string, number>>((acc, t) => {
        const k = key(t);
        acc[k] = (acc[k] || 0) + val(t);
        return acc;
      }, {});

    const approved = leaves.filter((l: any) => l.status === "Approved");
    const attStatus = attendance.map((a: any) => ({ ...a, status: attendanceStatusOf(a) }));
    const completed = attendance.filter((a: any) => a.clock_out);
    const avgHours = completed.length
      ? completed.reduce((s: number, a: any) => s + (Date.parse(a.clock_out) - Date.parse(a.clock_in)) / 3600000, 0) / completed.length
      : 0;
    const latestDope = new Map<string, string>();
    dope.forEach((d: any) => latestDope.set(d.user_id, d.personality_type));
    const active = users.filter((u) => u.account_status === "active");

    res.json({
      ok: true,
      range: { from, to, days: daysBetween(from, to) + 1 },
      headcount: {
        active: active.length,
        inactive: users.length - active.length,
        byDepartment: tally(active, (u) => deptOf.get(u.id) || "Unassigned"),
        byCompany: tally(active, (u) => companyOf.get(u.id) || "YES EMPIRE Group"),
      },
      leave: {
        applications: leaves.length,
        byStatus: tally(leaves, (l: any) => l.status),
        byType: tally(leaves, (l: any) => l.type),
        approvedDaysByType: tally(approved, (l: any) => l.type, (l: any) => l.days),
        approvedDaysByDepartment: tally(approved, (l: any) => deptOf.get(l.user_id) || "Unassigned", (l: any) => l.days),
      },
      attendance: {
        records: attendance.length,
        byStatus: tally(attStatus, (a: any) => a.status),
        lateByDepartment: tally(attStatus.filter((a: any) => a.status === "Late"), (a: any) => deptOf.get(a.user_id) || "Unassigned"),
        averageHours: Math.round(avgHours * 100) / 100,
      },
      claims: {
        count: claims.length,
        byStatus: tally(claims, (c: any) => c.status),
        amountByStatus: tally(claims, (c: any) => c.status, (c: any) => Number(c.amount)),
        approvedAmountByType: tally(claims.filter((c: any) => c.status === "Approved"), (c: any) => c.type, (c: any) => Number(c.amount)),
      },
      personality: {
        completed: latestDope.size,
        notTaken: active.filter((u) => !latestDope.has(u.id)).length,
        byType: tally([...latestDope.values()], (t) => t),
      },
    });
  }),
);

/* ───────────── Add leave days to chosen staff ─────────────
   POST /leave-balances/add { type: Annual|Medical|Emergency, days, usernames }
   Adds (or, with a minus number, removes) days for each chosen staff member. */
systemRouter.post(
  "/leave-balances/add",
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        type: z.enum(["Annual", "Medical", "Emergency"]),
        days: z.coerce.number().int("Days must be a whole number.").min(-365).max(365).refine((n) => n !== 0, "Days can't be 0."),
        usernames: z.array(z.string()).min(1, "Please tick at least one staff member."),
      }),
      req.body,
    );
    const col = ({ Annual: "leave_annual", Medical: "leave_medical", Emergency: "leave_emergency" } as const)[body.type];
    const staff = await db<UserRow>("users").where({ auth_role: "staff" }).whereIn("username", body.usernames);
    for (const u of staff) {
      await db("users").where({ id: u.id }).update({ [col]: Math.max(0, u[col] + body.days), updated_at: nowISO() });
    }
    await logAudit({
      action: "leave_days_added",
      actor: req.user!.username,
      target: body.type,
      detail: `${body.days > 0 ? "Added" : "Removed"} ${Math.abs(body.days)} ${body.type} day(s) for ${staff.length} staff.`,
    });
    res.json({ ok: true, updatedStaff: staff.length });
  }),
);

/* ───────────── Settings ───────────── */

systemRouter.get(
  "/settings",
  asyncHandler(async (_req, res) => {
    const name = await db("settings").where({ key: "companyName" }).first();
    res.json({
      ok: true,
      settings: { companyName: name ? JSON.parse(name.value) : "YES Empire Group", defaultLeave: await defaultLeaveBalances() },
    });
  }),
);

systemRouter.put(
  "/settings",
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        companyName: z.string().trim().min(1).max(160).optional(),
        defaultLeave: z
          .object({
            Annual: z.coerce.number().int().min(0).max(365),
            Medical: z.coerce.number().int().min(0).max(365),
            Emergency: z.coerce.number().int().min(0).max(365),
          })
          .optional(),
        /** Existing staff whose balances should move by the same change. */
        applyTo: z.array(z.string()).optional(),
      }),
      req.body,
    );
    const before = await defaultLeaveBalances();
    const upsert = async (key: string, value: unknown) => {
      const v = JSON.stringify(value);
      if (await db("settings").where({ key }).first()) await db("settings").where({ key }).update({ value: v });
      else await db("settings").insert({ key, value: v });
    };
    if (body.companyName) await upsert("companyName", body.companyName);
    if (body.defaultLeave) await upsert("defaultLeave", body.defaultLeave);
    // New staff simply start with the new defaults. For chosen existing staff,
    // add the difference (e.g. Annual 14 → 16 gives +2), so leave they have
    // already taken still counts. Balances never go below 0.
    let updatedStaff = 0;
    if (body.defaultLeave && body.applyTo?.length) {
      const diff = {
        leave_annual: body.defaultLeave.Annual - before.Annual,
        leave_medical: body.defaultLeave.Medical - before.Medical,
        leave_emergency: body.defaultLeave.Emergency - before.Emergency,
      };
      if (diff.leave_annual || diff.leave_medical || diff.leave_emergency) {
        const staff = await db<UserRow>("users").where({ auth_role: "staff" }).whereIn("username", body.applyTo);
        for (const u of staff) {
          await db("users").where({ id: u.id }).update({
            leave_annual: Math.max(0, u.leave_annual + diff.leave_annual),
            leave_medical: Math.max(0, u.leave_medical + diff.leave_medical),
            leave_emergency: Math.max(0, u.leave_emergency + diff.leave_emergency),
            updated_at: nowISO(),
          });
        }
        updatedStaff = staff.length;
      }
    }
    await logAudit({
      action: "settings_updated",
      actor: req.user!.username,
      target: "settings",
      detail: updatedStaff ? `Updated system settings and leave balances for ${updatedStaff} staff.` : "Updated system settings.",
    });
    const name = await db("settings").where({ key: "companyName" }).first();
    res.json({
      ok: true,
      updatedStaff,
      settings: { companyName: JSON.parse(name?.value ?? '"YES Empire Group"'), defaultLeave: await defaultLeaveBalances() },
    });
  }),
);
