import type { Knex } from "knex";
import * as m001 from "./001_initial";
import * as m002 from "./002_stored_files";

/* Migrations are registered in code (not discovered from disk) so they run
   the same way under `tsx` in development and from compiled `dist/`. Add new
   migrations to this list in order. */
const migrations: Record<string, Knex.Migration> = {
  "001_initial": m001,
  "002_stored_files": m002,
};

export const migrationSource: Knex.MigrationSource<string> = {
  getMigrations: async () => Object.keys(migrations),
  getMigrationName: (name) => name,
  getMigration: async (name) => migrations[name],
};
