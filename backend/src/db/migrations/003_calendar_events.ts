import type { Knex } from "knex";

/* Company calendar notes created by admins and shown to every staff member
   (e.g. "Town hall 3pm", "Office closed for renovation"). A note can cover
   one day or a range of days. */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("calendar_events", (t) => {
    t.string("id", 40).primary();
    t.string("date_from", 10).notNullable(); // YYYY-MM-DD
    t.string("date_to", 10).notNullable();
    t.string("title", 120).notNullable();
    t.text("note").notNullable().defaultTo("");
    t.string("category", 20).notNullable().defaultTo("event"); // event | holiday | reminder
    t.string("created_by", 80).notNullable();
    t.string("created_at", 40).notNullable();
    t.string("updated_at", 40).notNullable();
    t.index(["date_from"]);
    t.index(["date_to"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("calendar_events");
}
