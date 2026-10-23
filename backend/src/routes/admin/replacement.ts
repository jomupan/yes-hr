import { Router } from "express";
import type { Knex } from "knex";
import { z } from "zod";
import { db } from "../../db/knex";
import { asyncHandler, badRequest, notFound, parse } from "../../lib/errors";
import { isValidDate, nowISO } from "../../lib/time";
import { logAudit } from "../../services/audit";
import { createNotification } from "../../services/notifications";
import { newId } from "../../services/users";

/* Replacement leave managed by admins (Settings page).
   GET    /replacement-leaves              list with the staff who have it
   POST   /replacement-leaves              { name, days, expiresOn?, usernames? }  (no usernames = all active staff)
   PUT    /replacement-leaves/:id          { name, days, expiresOn?, usernames }
   DELETE /replacement-leaves/:id */
export const replacementRouter = Router();

const bodySchema = z.object({
  name: z.string().trim().min(1, "Please enter a name, e.g. Replacement Leave SUKMA.").max(120),
  days: z.coerce.number().int("Days must be a whole number.").min(1, "Days must be at least 1.").max(60),
  expiresOn: z.union([z.literal(""), z.null(), z.string().refine(isValidDate, "Invalid expiry date.")]).optional(),
  usernames: z.array(z.string()).optional(),
});

async function listAll() {
  const [rows, grants] = await Promise.all([
    db("replacement_leaves").orderBy("created_at", "desc"),
    db("replacement_grants as g")
      .join("users as u", "u.id", "g.user_id")
      .select("g.replacement_id", "g.balance", "u.username", "u.full_name"),
  ]);
  return rows.map((r) => {
    const staff = grants
      .filter((g) => g.replacement_id === r.id)
      .map((g) => ({ username: g.username, fullName: g.full_name, balance: Number(g.balance) }))
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
    return {
      id: r.id,
      name: r.name,
      days: Number(r.days),
      expiresOn: r.expires_on ?? null,
      createdAt: r.created_at,
      staff,
    };
  });
}

/** Active staff to give it to: the chosen usernames, or everyone. */
async function targetStaff(usernames: string[] | undefined, trx: Knex): Promise<{ id: string; username: string }[]> {
  if (usernames && usernames.length === 0) return [];
  const q = trx("users").where({ auth_role: "staff", account_status: "active" }).select("id", "username");
  if (usernames) q.whereIn("username", usernames);
  return q;
}

async function notifyGranted(userIds: string[], name: string, days: number, expiresOn: string | null, trx: Knex) {
  for (const userId of userIds) {
    await createNotification(
      {
        userId,
        category: "leave",
        title: "Replacement Leave Added",
        message: `You received ${days} day(s) of ${name}${expiresOn ? `. Use it by ${expiresOn}` : ""}.`,
        actionLabel: "View Leave",
        actionModule: "leave",
      },
      trx,
    );
  }
}

replacementRouter.get(
  "/replacement-leaves",
  asyncHandler(async (_req, res) => {
    res.json({ ok: true, replacementLeaves: await listAll() });
  }),
);

replacementRouter.post(
  "/replacement-leaves",
  asyncHandler(async (req, res) => {
    const parsed = parse(bodySchema, req.body);
    const body = { ...parsed, expiresOn: parsed.expiresOn || null };
    const row = {
      id: newId(),
      name: body.name,
      days: body.days,
      expires_on: body.expiresOn,
      created_by: req.user!.username,
      created_at: nowISO(),
    };
    await db.transaction(async (trx) => {
      await trx("replacement_leaves").insert(row);
      const staff = await targetStaff(body.usernames, trx);
      for (const s of staff) {
        await trx("replacement_grants").insert({ id: newId(), replacement_id: row.id, user_id: s.id, balance: body.days });
      }
      await notifyGranted(staff.map((s) => s.id), body.name, body.days, body.expiresOn, trx);
    });
    await logAudit({ action: "replacement_leave_created", actor: req.user!.username, target: row.id, detail: `Created ${body.name} (${body.days} day(s)).` });
    res.status(201).json({ ok: true, replacementLeaves: await listAll() });
  }),
);

replacementRouter.put(
  "/replacement-leaves/:id",
  asyncHandler(async (req, res) => {
    const parsed = parse(bodySchema, req.body);
    const body = { ...parsed, expiresOn: parsed.expiresOn || null };
    const existing = await db("replacement_leaves").where({ id: req.params.id }).first();
    if (!existing) throw notFound("Replacement leave not found.");
    await db.transaction(async (trx) => {
      await trx("replacement_leaves")
        .where({ id: existing.id })
        .update({ name: body.name, days: body.days, expires_on: body.expiresOn });
      // Changing the number of days moves everyone's balance by the same amount.
      const diff = body.days - Number(existing.days);
      if (diff !== 0) {
        const grants = await trx("replacement_grants").where({ replacement_id: existing.id });
        for (const g of grants) {
          await trx("replacement_grants").where({ id: g.id }).update({ balance: Math.max(0, Number(g.balance) + diff) });
        }
      }
      if (body.usernames) {
        const wanted = await targetStaff(body.usernames, trx);
        const wantedIds = new Set(wanted.map((s) => s.id));
        const current = await trx("replacement_grants").where({ replacement_id: existing.id }).select("user_id");
        const currentIds = new Set(current.map((g) => g.user_id));
        const removed = [...currentIds].filter((id) => !wantedIds.has(id));
        if (removed.length) {
          await trx("replacement_grants").where({ replacement_id: existing.id }).whereIn("user_id", removed).del();
        }
        const added = wanted.filter((s) => !currentIds.has(s.id));
        for (const s of added) {
          await trx("replacement_grants").insert({ id: newId(), replacement_id: existing.id, user_id: s.id, balance: body.days });
        }
        await notifyGranted(added.map((s) => s.id), body.name, body.days, body.expiresOn, trx);
      }
    });
    await logAudit({ action: "replacement_leave_updated", actor: req.user!.username, target: existing.id, detail: `Updated ${body.name}.` });
    res.json({ ok: true, replacementLeaves: await listAll() });
  }),
);

replacementRouter.delete(
  "/replacement-leaves/:id",
  asyncHandler(async (req, res) => {
    const existing = await db("replacement_leaves").where({ id: req.params.id }).first();
    if (!existing) throw notFound("Replacement leave not found.");
    const pending = await db("leave_applications").where({ replacement_id: existing.id, status: "Pending" }).first();
    if (pending)
      throw badRequest("Some staff have a pending application for this replacement leave. Approve or reject it first.");
    await db("replacement_leaves").where({ id: existing.id }).del();
    await logAudit({ action: "replacement_leave_deleted", actor: req.user!.username, target: existing.id, detail: `Deleted ${existing.name}.` });
    res.json({ ok: true, replacementLeaves: await listAll() });
  }),
);
