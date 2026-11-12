import webpush from "web-push";
import { config } from "../config";
import { db } from "../db/knex";
import { background } from "../lib/background";

/* Phone notifications (Web Push). Every in-app notification is also sent
   to the person's phones that allowed notifications. Nothing happens when
   the VAPID keys aren't set, so the app works the same without them. */

export interface PushMessage {
  title: string;
  body: string;
  /** Page to open when the notification is tapped. */
  url?: string;
  /** Same tag replaces an older notification instead of stacking. */
  tag?: string;
}

let ready: boolean | null = null;
export function pushEnabled(): boolean {
  if (ready === null) {
    ready = !!(config.vapidPublicKey && config.vapidPrivateKey);
    if (ready) webpush.setVapidDetails(config.vapidSubject, config.vapidPublicKey, config.vapidPrivateKey);
  }
  return ready;
}

/** Send to every phone of these users. Dead subscriptions are removed. */
export async function sendPush(userIds: string[], msg: PushMessage): Promise<number> {
  if (!pushEnabled() || !userIds.length) return 0;
  const subs = await db("push_subscriptions").whereIn("user_id", userIds);
  const payload = JSON.stringify({ title: msg.title, body: msg.body, url: msg.url || "/", tag: msg.tag });
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
          TTL: 60 * 60,
        });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        // 404/410 = the phone unsubscribed or the app was removed.
        if (code === 404 || code === 410) await db("push_subscriptions").where({ id: s.id }).del();
        else console.error("Push failed:", code ?? (e instanceof Error ? e.message : e));
      }
    }),
  );
  return sent;
}

/** Fire-and-forget, a moment later (after the change that caused it is saved). */
export function queuePush(userIds: string[], msg: PushMessage): void {
  if (!pushEnabled() || !userIds.length) return;
  background(new Promise((r) => setTimeout(r, 300)).then(() => sendPush(userIds, msg)));
}
