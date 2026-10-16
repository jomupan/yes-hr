import { db, migrateLatest } from "./knex";
import { seed } from "./seed";

/* npm run migrate | seed | db:reset */
async function main() {
  const cmd = process.argv[2];
  if (cmd === "migrate") {
    await migrateLatest();
    console.log("✔ Database migrated.");
  } else if (cmd === "seed") {
    await migrateLatest();
    await seed();
    console.log("✔ Seed data ready. Login: admin / admin123 (admin), aina / staff123 (staff).");
  } else if (cmd === "reset") {
    await db.migrate.rollback(undefined, true);
    await migrateLatest();
    await seed();
    console.log("✔ Database reset and re-seeded.");
  } else {
    console.log("Usage: tsx src/db/cli.ts <migrate|seed|reset>");
  }
  await db.destroy();
}

main().catch(async (e) => {
  console.error(e);
  await db.destroy();
  process.exit(1);
});
