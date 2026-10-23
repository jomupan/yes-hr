import type { Knex } from "knex";

/* Replacement leave (cuti ganti), e.g. "Replacement Leave SUKMA – 1 day".
   An admin creates an entry and chooses which staff get it; each chosen
   staff member gets their own balance (a grant). Leave applications for it
   remember which entry they used, so approving deducts from that grant. */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("replacement_leaves", (t) => {
    t.string("id", 40).primary();
    t.string("name", 120).notNullable();
    t.integer("days").notNullable();
    t.string("expires_on", 10); // YYYY-MM-DD, last day it can be used (optional)
    t.string("created_by", 80).notNullable();
    t.string("created_at", 40).notNullable();
  });
  await knex.schema.createTable("replacement_grants", (t) => {
    t.string("id", 40).primary();
    t.string("replacement_id", 40).notNullable().references("id").inTable("replacement_leaves").onDelete("CASCADE");
    t.string("user_id", 40).notNullable().references("id").inTable("users").onDelete("CASCADE");
    t.integer("balance").notNullable(); // days left
    t.unique(["replacement_id", "user_id"]);
    t.index(["user_id"]);
  });
  await knex.schema.alterTable("leave_applications", (t) => {
    t.string("replacement_id", 40); // set when type = "Replacement"
    t.string("type_label", 160); // e.g. "Replacement Leave SUKMA" (kept if the entry is deleted)
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("leave_applications", (t) => {
    t.dropColumn("replacement_id");
    t.dropColumn("type_label");
  });
  await knex.schema.dropTableIfExists("replacement_grants");
  await knex.schema.dropTableIfExists("replacement_leaves");
}
