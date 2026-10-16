import fs from "fs";
import path from "path";
import knexFactory, { Knex } from "knex";
import { config } from "../config";
import { migrationSource } from "./migrations";
import { NodeSqliteClient } from "./node-sqlite-client";

function buildConfig(): Knex.Config {
  if (config.dbClient === "mysql") {
    return { client: "mysql2", connection: config.databaseUrl, pool: { min: 0, max: 10 } };
  }
  if (config.dbClient === "pg") {
    // Works with any PostgreSQL, including Neon's free plan. Neon's URL ends
    // in ?sslmode=require, which turns on encryption. Neon pauses when idle,
    // so allow time for the first connection and don't hold idle ones.
    // "sslmode=require" (Neon's default link) already means full certificate
    // checking in this driver; spelling it "verify-full" keeps that strict
    // behaviour in future versions and avoids a warning in the logs.
    const connection = config.databaseUrl.replace(/([?&])sslmode=require\b/, "$1sslmode=verify-full");
    return {
      client: "pg",
      connection,
      pool: { min: 0, max: 5, idleTimeoutMillis: 30_000 },
      acquireConnectionTimeout: 60_000,
    };
  }
  const file = config.sqliteFile === ":memory:" ? ":memory:" : path.resolve(config.sqliteFile);
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  // Node's built-in SQLite: nothing to install or compile (see node-sqlite-client.ts).
  // Foreign keys + WAL are switched on per connection inside the client.
  return {
    client: NodeSqliteClient as unknown as Knex.Config["client"],
    connection: { filename: file },
    useNullAsDefault: true,
  };
}

export const db: Knex = knexFactory({
  ...buildConfig(),
  migrations: { migrationSource, tableName: "knex_migrations" },
});

export async function migrateLatest(): Promise<void> {
  await db.migrate.latest();
}
