import { Router } from "express";
import { z } from "zod";
import { config } from "../config";
import { db } from "../db/knex";
import { asyncHandler, parse } from "../lib/errors";
import { nowISO } from "../lib/time";
import { pushEnabled } from "../services/push";
import { newId } from "../services/users";

/* Turning phone notifications on/off for the logged-in user.
   GET  /api/me/push/key          { enabled, publicKey }
   POST /api/me/push/subscribe    { endpoint, keys: { p256dh, auth } }
   POST /api/me/push/unsubscribe  { endpoint } */
export const pushRouter = Router();

pushRouter.get(
  "/key",
  asyncHandler(async (_req, res) => {
    res.json({ ok: true, enabled: pushEnabled(), publicKey: pushEnabled() ? config.vapidPublicKey : null });
  }),
);

pushRouter.post(
  "/subscribe",
  asyncHandler(async (req, res) => {
    const body = parse(
      z.object({
        endpoint: z.string().url().max(1000),
        keys: z.object({ p256dh: z.string().min(1).max(255), auth: z.string().min(1).max(255) }),
      }),
      req.body,
    );
    // The same phone may be re-used by someone else later: the newest login owns it.
    await db("push_subscriptions").where({ endpoint: body.endpoint }).del();
    await db("push_subscriptions").insert({
      id: newId(),
      user_id: req.user!.id,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      created_at: nowISO(),
    });
    res.status(201).json({ ok: true });
  }),
);

pushRouter.post(
  "/unsubscribe",
  asyncHandler(async (req, res) => {
    const body = parse(z.object({ endpoint: z.string().max(1000) }), req.body);
    await db("push_subscriptions").where({ endpoint: body.endpoint, user_id: req.user!.id }).del();
    res.json({ ok: true });
  }),
);
