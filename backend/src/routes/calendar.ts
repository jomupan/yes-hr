import { Router } from "express";
import { z } from "zod";
import { db } from "../db/knex";
import { asyncHandler, badRequest, notFound, parse } from "../lib/errors";
import { fmtDate, isValidDate, nowISO, todayISO } from "../lib/time";
import { newId } from "../services/users";
import { notifyEveryone } from "../services/notifications";
import { logAudit } from "../services/audit";

/* Company calendar notes. Everyone logged in can read them (GET
   /api/calendar); only admins add, edit or delete (/api/admin/calendar). */

export function calendarDto(r: any) {
  return {
    id: r.id,
    from: r.date_from,
    to: r.date_to,
    title: r.title,
    note: r.note,
    category: r.category,
    createdBy: r.created_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/* GET /api/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD (overlapping notes).
   Without dates: today onwards plus the last 31 days. */
export const calendarRouter = Router();
calendarRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const from = isValidDate(String(req.query.from)) ? String(req.query.from) : null;
    const to = isValidDate(String(req.query.to)) ? String(req.query.to) : null;
    const q = db("calendar_events").orderBy([{ column: "date_from" }, { column: "title" }]);
    if (from) q.where("date_to", ">=", from);
    if (to) q.where("date_from", "<=", to);
    if (!from && !to) {
      const d = new Date(`${todayISO()}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() - 31);
      q.where("date_to", ">=", d.toISOString().slice(0, 10));
    }
    const rows = await q.limit(500);
    res.json({ ok: true, events: rows.map(calendarDto) });
  }),
);

const CATEGORIES = ["event", "holiday", "reminder"] as const;
const eventSchema = z.object({
  title: z.string().trim().min(1, "Please enter a title.").max(120),
  note: z.string().trim().max(2000).optional().default(""),
  from: z.string().refine(isValidDate, "Please choose a valid date."),
  to: z.string().refine(isValidDate, "Please choose a valid end date.").optional(),
  category: z.enum(CATEGORIES).optional().default("event"),
  notifyStaff: z.boolean().optional().default(true),
});

function when(from: string, to: string) {
  return from === to ? fmtDate(from) : `${fmtDate(from)}–${fmtDate(to)}`;
}

/* Admin: /api/admin/calendar */
export const adminCalendarRouter = Router();

adminCalendarRouter.post(
  "/calendar",
  asyncHandler(async (req, res) => {
    const body = parse(eventSchema, req.body);
    const to = body.to || body.from;
    if (to < body.from) throw badRequest("End date must be on or after the start date.");
    const now = nowISO();
    const row = {
      id: newId(),
      date_from: body.from,
      date_to: to,
      title: body.title,
      note: body.note,
      category: body.category,
      created_by: req.user!.username,
      created_at: now,
      updated_at: now,
    };
    await db.transaction(async (trx) => {
      await trx("calendar_events").insert(row);
      if (body.notifyStaff) {
        await notifyEveryone(
          {
            category: "system",
            title: "New Calendar Note",
            message: `${body.title} (${when(body.from, to)})`,
            relatedId: row.id,
            actionLabel: "View calendar",
            actionModule: "calendar",
          },
          req.user!.id,
          trx,
        );
      }
    });
    await logAudit({ action: "calendar_created", actor: req.user!.username, target: row.id, detail: `Added calendar note "${row.title}" for ${when(row.date_from, row.date_to)}.` });
    res.status(201).json({ ok: true, event: calendarDto(row) });
  }),
);

adminCalendarRouter.put(
  "/calendar/:id",
  asyncHandler(async (req, res) => {
    const existing = await db("calendar_events").where({ id: req.params.id }).first();
    if (!existing) throw notFound("Calendar note not found.");
    const body = parse(eventSchema, req.body);
    const to = body.to || body.from;
    if (to < body.from) throw badRequest("End date must be on or after the start date.");
    const patch = { date_from: body.from, date_to: to, title: body.title, note: body.note, category: body.category, updated_at: nowISO() };
    await db("calendar_events").where({ id: existing.id }).update(patch);
    res.json({ ok: true, event: calendarDto({ ...existing, ...patch }) });
  }),
);

adminCalendarRouter.delete(
  "/calendar/:id",
  asyncHandler(async (req, res) => {
    const existing = await db("calendar_events").where({ id: req.params.id }).first();
    if (!existing) throw notFound("Calendar note not found.");
    await db("calendar_events").where({ id: existing.id }).del();
    await logAudit({ action: "calendar_deleted", actor: req.user!.username, target: existing.id, detail: `Deleted calendar note "${existing.title}".` });
    res.json({ ok: true });
  }),
);
