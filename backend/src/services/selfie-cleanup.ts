import { config } from "../config";
import { db } from "../db/knex";
import { deleteStored } from "../lib/files";


export async function deleteOldSelfies(): Promise<number> {
  const cutoff = new Date(Date.now() - config.selfieKeepHours * 60 * 60 * 1000).toISOString();
  let removed = 0;

  const ins = await db("attendance")
    .whereNotNull("clock_in_selfie")
    .where("clock_in", "<", cutoff)
    .select("id", "clock_in_selfie");
  for (const r of ins) {
    await deleteStored(r.clock_in_selfie);
    await db("attendance").where({ id: r.id }).update({ clock_in_selfie: null });
    removed++;
  }

  const outs = await db("attendance")
    .whereNotNull("clock_out_selfie")
    .whereNotNull("clock_out")
    .where("clock_out", "<", cutoff)
    .select("id", "clock_out_selfie");
  for (const r of outs) {
    await deleteStored(r.clock_out_selfie);
    await db("attendance").where({ id: r.id }).update({ clock_out_selfie: null });
    removed++;
  }
  return removed;
}

/** Run now, then every 15 minutes while the server is running. */
export function startSelfieCleanup(): void {
  const run = () =>
    deleteOldSelfies()
      .then((n) => {
        if (n) console.log(`Deleted ${n} selfie(s) older than ${config.selfieKeepHours} hours.`);
      })
      .catch((e) => console.error("Selfie clean-up failed:", e));
  void run();
  setInterval(run, 15 * 60 * 1000).unref();
}