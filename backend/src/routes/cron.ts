import { Router } from "express";
import { config } from "../config";
import { asyncHandler, unauthorized } from "../lib/errors";
import { deleteOldSelfies } from "../services/selfie-cleanup";
import { checkReminders } from "../services/reminders";

/* Scheduled jobs called by Vercel Cron (see vercel.json).
   Vercel sends "Authorization: Bearer <CRON_SECRET>"; anything else is
   refused, so nobody else can trigger them.
   GET /api/cron/reminders  clock-in / clock-out reminders
   GET /api/cron/cleanup    delete selfies older than 24 hours */
export const cronRouter = Router();

cronRouter.use((req, _res, next) => {
  if (!config.cronSecret || req.headers.authorization !== `Bearer ${config.cronSecret}`) return next(unauthorized());
  next();
});

cronRouter.get(
  "/reminders",
  asyncHandler(async (_req, res) => {
    await checkReminders();
    res.json({ ok: true });
  }),
);

cronRouter.get(
  "/cleanup",
  asyncHandler(async (_req, res) => {
    res.json({ ok: true, deleted: await deleteOldSelfies() });
  }),
);
