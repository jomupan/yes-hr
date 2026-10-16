import { Router } from "express";
import { db } from "../db/knex";
import { asyncHandler, notFound } from "../lib/errors";
import { toNotificationDto } from "../services/notifications";

/* Per-user notifications (staff and admins alike). Scoped to req.user. */
export const notificationsRouter = Router();

notificationsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const user = req.user!;
    const q = db("notifications").where({ user_id: user.id }).orderBy("created_at", "desc");
    if (req.query.unread === "1") q.andWhere({ is_read: false });
    if (typeof req.query.category === "string") q.andWhere({ category: req.query.category });
    const rows = await q;
    const unread = rows.filter((r) => !r.is_read).length;
    res.json({ ok: true, unread, notifications: rows.map((r) => toNotificationDto(r, user.username)) });
  }),
);

notificationsRouter.get(
  "/unread-count",
  asyncHandler(async (req, res) => {
    const r = await db("notifications").where({ user_id: req.user!.id, is_read: false }).count({ n: "*" }).first();
    res.json({ ok: true, unread: Number(r?.n ?? 0) });
  }),
);

notificationsRouter.patch(
  "/:id/read",
  asyncHandler(async (req, res) => {
    const n = await db("notifications").where({ id: req.params.id, user_id: req.user!.id }).update({ is_read: true });
    if (!n) throw notFound("Notification not found.");
    res.json({ ok: true });
  }),
);

notificationsRouter.post(
  "/read-all",
  asyncHandler(async (req, res) => {
    await db("notifications").where({ user_id: req.user!.id, is_read: false }).update({ is_read: true });
    res.json({ ok: true });
  }),
);

notificationsRouter.delete(
  "/:id",
  asyncHandler(async (req, res) => {
    const n = await db("notifications").where({ id: req.params.id, user_id: req.user!.id }).del();
    if (!n) throw notFound("Notification not found.");
    res.json({ ok: true });
  }),
);
