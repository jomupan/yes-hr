import type { Knex } from "knex";

/*
 * Uploaded files kept inside the database (FILE_STORAGE=db).
 *
 * Used on hosts without a permanent disk (e.g. Render's free plan), where
 * anything written to the filesystem disappears when the app restarts.
 * Records point here with a path like "db:<uuid>.jpg".
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("stored_files", (t) => {
    t.string("id", 60).primary(); // "<uuid>.<ext>"
    t.string("mime", 60).notNullable();
    t.integer("size").notNullable();
    t.binary("data").notNullable();
    t.string("created_at", 40).notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("stored_files");
}
