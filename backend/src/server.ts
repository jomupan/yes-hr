import { createApp } from "./app";
import { config } from "./config";
import { db, migrateLatest } from "./db/knex";
import { seed } from "./db/seed";
import { startSelfieCleanup } from "./services/selfie-cleanup";
import { startReminders } from "./services/reminders";

async function main() {
  // Bring the schema up to date and make sure the default accounts exist.
  await migrateLatest();
  await seed();
  const app = createApp();
  const server = app.listen(config.port, () => {
    console.log(`✔ YES Elevate API running on http://localhost:${config.port}/api  (db: ${config.dbClient}, tz: ${config.timezone})`);
  });
  // Delete selfies older than 24 hours (times and locations are kept).
  startSelfieCleanup();
  // Clock-in / clock-out reminders on staff phones.
  startReminders();
  const shutdown = () => {
    server.close(() => db.destroy().then(() => process.exit(0)));
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  console.error("Failed to start server:", e);
  process.exit(1);
});
