/*
 * Knex client for Node's built-in SQLite (`node:sqlite`, Node 22.13+).
 *
 * Why: the usual driver, better-sqlite3, is a native addon. On Windows it has
 * to be compiled with Visual Studio whenever no prebuilt binary exists for the
 * installed Node version, which breaks `npm install` for most students. The
 * built-in module needs nothing installed, so the backend works on any recent
 * Node out of the box.
 *
 * It reuses Knex's better-sqlite3 client (same SQL dialect, same query
 * compiler) and only swaps how connections are opened and statements are run.
 */
import "./quiet-sqlite-warning";
// @ts-expect-error knex ships no types for its internal dialect modules
import Client_BetterSQLite3 from "knex/lib/dialects/better-sqlite3";

type Statement = {
  columns?: () => unknown[];
  all(...params: unknown[]): unknown[];
  run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
};
type Connection = { prepare(sql: string): Statement; exec(sql: string): void; close(): void };
type SqliteModule = { DatabaseSync: new (filename: string) => unknown };

// Used only on older Node 22 releases where statement.columns() is missing.
const READ_SQL = /^\s*(select|pragma|with|explain|values)\b|\breturning\b/i;

export class NodeSqliteClient extends Client_BetterSQLite3 {
  // Set by Knex's base client at runtime.
  declare driver: SqliteModule;
  declare connectionSettings: { filename: string };

  _driver(): SqliteModule {
    // Loaded lazily (only when SQLite is actually used) so MySQL/Postgres
    // setups never touch it and the warning filter is already in place.
    return process.getBuiltinModule("node:sqlite") as SqliteModule;
  }

  async acquireRawConnection(): Promise<Connection> {
    const conn = new this.driver.DatabaseSync(this.connectionSettings.filename) as Connection;
    conn.exec("PRAGMA foreign_keys = ON");
    if (this.connectionSettings.filename !== ":memory:") conn.exec("PRAGMA journal_mode = WAL");
    return conn;
  }

  async destroyRawConnection(connection: Connection) {
    connection.close();
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async _query(connection: Connection, obj: any) {
    if (!obj.sql) throw new Error("The query is empty");
    if (!connection) throw new Error("No connection provided");
    const statement = connection.prepare(obj.sql);
    const bindings = this._formatBindings(obj.bindings);
    // A statement that returns columns is a read (SELECT, PRAGMA, RETURNING).
    const isRead = typeof statement.columns === "function" ? statement.columns().length > 0 : READ_SQL.test(obj.sql);
    if (isRead) {
      // Rows come back with a null prototype; make them plain objects.
      obj.response = statement.all(...bindings).map((r) => ({ ...(r as object) }));
      return obj;
    }
    const response = statement.run(...bindings);
    obj.response = response;
    obj.context = { lastID: Number(response.lastInsertRowid), changes: Number(response.changes) };
    return obj;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _formatBindings(bindings: any[] | undefined) {
    if (!bindings) return [];
    return bindings.map((b) => {
      if (b instanceof Date) return b.valueOf();
      if (typeof b === "boolean") return Number(b);
      if (b === undefined) return null;
      return b;
    });
  }
}

Object.assign(NodeSqliteClient.prototype, { driverName: "node:sqlite" });
