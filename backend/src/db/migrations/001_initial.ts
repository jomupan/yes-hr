import type { Knex } from "knex";

/*
 * Initial schema. Mirrors the localStorage data model used by the frontend
 * (see src/lib/hr-types.ts) but normalised into relational tables.
 *
 * Conventions
 *  - Primary keys are string ids (UUIDs, or slugs for companies/departments
 *    so they stay identical to the ids the frontend already uses).
 *  - Timestamps are ISO-8601 strings, calendar dates are "YYYY-MM-DD"
 *    strings. This keeps the API output identical to the frontend types and
 *    works the same on SQLite, MySQL and PostgreSQL.
 *  - Files are stored on disk (UPLOAD_DIR); tables keep metadata + path.
 */
export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("companies", (t) => {
    t.string("id", 80).primary();
    t.string("name", 160).notNullable();
    t.string("code", 20);
    t.string("type", 20).notNullable().defaultTo("subsidiary"); // parent | subsidiary
    t.string("parent_company_id", 80).references("id").inTable("companies").onDelete("SET NULL");
    t.boolean("active").notNullable().defaultTo(true);
    t.string("created_at", 40).notNullable();
  });

  await knex.schema.createTable("departments", (t) => {
    t.string("id", 80).primary();
    t.string("name", 160).notNullable();
    t.string("code", 20);
    t.string("company_id", 80).notNullable().references("id").inTable("companies").onDelete("RESTRICT");
    t.boolean("active").notNullable().defaultTo(true);
    t.string("created_at", 40).notNullable();
    t.index(["company_id"]);
  });

  await knex.schema.createTable("users", (t) => {
    t.string("id", 40).primary();
    t.string("username", 80).notNullable().unique();
    t.string("full_name", 160).notNullable();
    t.string("job_title", 120).notNullable().defaultTo("Staff");
    t.string("email", 190).notNullable().unique();
    t.string("employee_id", 40).notNullable().unique();
    t.string("auth_role", 10).notNullable().defaultTo("staff"); // staff | admin
    t.string("password_hash", 100).notNullable();
    t.string("account_status", 10).notNullable().defaultTo("active"); // active | inactive
    t.string("company_id", 80).references("id").inTable("companies").onDelete("SET NULL");
    t.string("department_id", 80).references("id").inTable("departments").onDelete("SET NULL");
    t.integer("leave_annual").notNullable().defaultTo(14);
    t.integer("leave_medical").notNullable().defaultTo(14);
    t.integer("leave_emergency").notNullable().defaultTo(3);
    t.string("joined_at", 40).notNullable();
    t.string("updated_at", 40).notNullable();
  });

  await knex.schema.createTable("dope_results", (t) => {
    t.string("id", 40).primary();
    t.string("user_id", 40).notNullable().references("id").inTable("users").onDelete("CASCADE");
    t.string("date", 10).notNullable();
    t.string("status", 10).notNullable().defaultTo("Pass");
    t.text("answers").notNullable(); // JSON
    t.text("scores").notNullable(); // JSON
    t.string("personality_type", 40).notNullable();
    t.text("summary").notNullable();
    t.string("created_at", 40).notNullable();
    t.index(["user_id"]);
  });

  await knex.schema.createTable("attendance", (t) => {
    t.string("id", 40).primary();
    t.string("user_id", 40).notNullable().references("id").inTable("users").onDelete("CASCADE");
    t.string("date", 10).notNullable();
    t.string("clock_in", 40).notNullable();
    t.string("clock_out", 40);
    t.string("location", 255).notNullable().defaultTo("");
    t.string("clock_out_location", 255).notNullable().defaultTo("");
    t.string("clock_in_selfie", 255); // relative path in UPLOAD_DIR
    t.string("clock_out_selfie", 255);
    t.unique(["user_id", "date"]);
    t.index(["date"]);
  });

  await knex.schema.createTable("leave_applications", (t) => {
    t.string("id", 40).primary();
    t.string("user_id", 40).notNullable().references("id").inTable("users").onDelete("CASCADE");
    t.string("type", 20).notNullable(); // Annual | Medical | Emergency
    t.string("date_from", 10).notNullable();
    t.string("date_to", 10).notNullable();
    t.integer("days").notNullable();
    t.text("reason").notNullable();
    t.string("status", 20).notNullable().defaultTo("Pending");
    t.string("applied_at", 40).notNullable();
    t.string("attachment_name", 120);
    t.string("attachment_type", 60);
    t.integer("attachment_size");
    t.string("attachment_path", 255);
    t.text("rejection_reason");
    t.string("reviewed_by", 80);
    t.string("reviewed_at", 40);
    t.index(["user_id"]);
    t.index(["status"]);
  });

  await knex.schema.createTable("claims", (t) => {
    t.string("id", 40).primary();
    t.string("user_id", 40).notNullable().references("id").inTable("users").onDelete("CASCADE");
    t.string("type", 20).notNullable(); // Travel | Medical | Equipment | Others
    t.decimal("amount", 12, 2).notNullable();
    t.string("date", 10).notNullable();
    t.text("description").notNullable();
    t.string("status", 20).notNullable().defaultTo("Pending");
    t.text("rejection_reason");
    t.string("created_at", 40).notNullable();
    t.string("reviewed_by", 80);
    t.string("reviewed_at", 40);
    t.index(["user_id"]);
    t.index(["status"]);
  });

  await knex.schema.createTable("evaluations", (t) => {
    t.string("id", 40).primary();
    t.string("user_id", 40).notNullable().references("id").inTable("users").onDelete("CASCADE");
    t.string("period", 40).notNullable();
    t.integer("overall").notNullable();
    t.text("categories").notNullable(); // JSON Record<string, number>
    t.text("comments").notNullable().defaultTo("");
    t.string("created_by", 80);
    t.string("created_at", 40).notNullable();
    t.index(["user_id"]);
  });

  await knex.schema.createTable("payslips", (t) => {
    t.string("id", 40).primary();
    t.string("user_id", 40).notNullable().references("id").inTable("users").onDelete("CASCADE");
    t.integer("month").notNullable();
    t.integer("year").notNullable();
    t.string("file_name", 120).notNullable();
    t.string("file_type", 60).notNullable();
    t.integer("file_size").notNullable();
    t.string("file_path", 255).notNullable();
    t.text("note");
    t.string("status", 10).notNullable().defaultTo("active"); // active | removed
    t.string("uploaded_by", 80).notNullable();
    t.string("created_at", 40).notNullable();
    t.string("updated_at", 40).notNullable();
    t.index(["user_id", "year", "month"]);
  });

  await knex.schema.createTable("notifications", (t) => {
    t.string("id", 40).primary();
    t.string("user_id", 40).notNullable().references("id").inTable("users").onDelete("CASCADE");
    t.string("category", 20).notNullable();
    t.string("title", 160).notNullable();
    t.text("message").notNullable();
    t.boolean("is_read").notNullable().defaultTo(false);
    t.string("created_at", 40).notNullable();
    t.string("related_id", 80);
    t.string("action_label", 60);
    t.string("action_module", 30);
    t.string("admin_path", 120);
    t.string("priority", 10);
    t.index(["user_id", "is_read"]);
  });

  await knex.schema.createTable("password_reset_tokens", (t) => {
    t.string("token_hash", 64).primary();
    t.string("user_id", 40).notNullable().references("id").inTable("users").onDelete("CASCADE");
    t.bigInteger("expires_at").notNullable();
  });

  await knex.schema.createTable("audit_log", (t) => {
    t.string("id", 40).primary();
    t.string("action", 60).notNullable();
    t.string("actor", 80).notNullable();
    t.string("target", 120).notNullable();
    t.text("detail").notNullable();
    t.string("created_at", 40).notNullable();
    t.index(["created_at"]);
  });

  await knex.schema.createTable("settings", (t) => {
    t.string("key", 80).primary();
    t.text("value").notNullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  for (const table of [
    "settings",
    "audit_log",
    "password_reset_tokens",
    "notifications",
    "payslips",
    "evaluations",
    "claims",
    "leave_applications",
    "attendance",
    "dope_results",
    "users",
    "departments",
    "companies",
  ]) {
    await knex.schema.dropTableIfExists(table);
  }
}
