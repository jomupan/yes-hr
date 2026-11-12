import type { Knex } from "knex";

/* Phones / browsers that said "Allow" to notifications. One person can
   have several (phone + laptop). */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("push_subscriptions", (t) => {
    t.string("id", 40).primary();
    t.string("user_id", 40).notNullable().references("id").inTable("users").onDelete("CASCADE");
    t.string("endpoint", 1000).notNullable().unique();
    t.string("p256dh", 255).notNullable();
    t.string("auth", 255).notNullable();
    t.string("created_at", 40).notNullable();
    t.index(["user_id"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("push_subscriptions");
}
