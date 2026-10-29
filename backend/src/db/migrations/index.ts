import type { Knex } from "knex";
import * as m001 from "./001_initial";
import * as m002 from "./002_stored_files";
import * as m003 from "./003_calendar_events";
import * as m004 from "./004_replacement_leave";
import * as m005 from "./005_attendance_admin_clockout";

/* Migrations are registered in code (not discovered from disk) so they run
   the same way under `tsx` in development and from compiled `dist/`. Add new
   migrations to this list in order. */
const migrations: Record<string, Knex.Migration> = {
  "001_initial": m001,
  "002_stored_files": m002,
  "003_calendar_events": m003,
  "004_replacement_leave": m004,
  "005_attendance_admin_clockout": m005,
};

export const migrationSource: Knex.MigrationSource<string> = {
  getMigrations: async () => Object.keys(migrations),
  getMigrationName: (name) => name,
  getMigration: async (name) => migrations[name],
};
