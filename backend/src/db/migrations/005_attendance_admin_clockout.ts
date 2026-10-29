import type { Knex } from "knex";

/* When staff forget to clock out, HR can fill in the clock-out time.
   clock_out_by remembers which admin did it (null = the staff member). */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("attendance", (t) => {
    t.string("clock_out_by", 80);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("attendance", (t) => {
    t.dropColumn("clock_out_by");
  });
}
