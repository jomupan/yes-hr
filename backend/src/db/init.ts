import { migrateLatest } from "./knex";
import { seed } from "./seed";

/* Bring the database up to date once per running copy of the app.
   (On Vercel there's no long-running server start, so the first request
   to each copy does this.) */
let ready: Promise<void> | null = null;

export function ensureDatabase(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await migrateLatest();
      await seed();
    })().catch((e) => {
      ready = null; // try again on the next request
      throw e;
    });
  }
  return ready;
}
