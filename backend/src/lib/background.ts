/* Work that should finish after the reply is sent (Google Sheet copy,
   phone notifications). On a normal server it just runs. On Vercel the
   function could be paused once the reply is sent, so we tell Vercel to
   wait for it (waitUntil). */
import { waitUntil } from "@vercel/functions";

export function background(task: Promise<unknown>): void {
  const safe = task.catch((e) => console.error("Background task failed:", e instanceof Error ? e.message : e));
  if (process.env.VERCEL) waitUntil(safe);
}
