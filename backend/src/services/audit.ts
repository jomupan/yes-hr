import type { Knex } from "knex";
import { db } from "../db/knex";
import { nowISO } from "../lib/time";
import { newId } from "./users";

/** Append-only trail of privileged admin actions. */
export async function logAudit(
  entry: { action: string; actor: string; target: string; detail: string },
  trx: Knex = db,
): Promise<void> {
  await trx("audit_log").insert({ id: newId(), ...entry, created_at: nowISO() });
}

export async function getAuditLog(limit = 50) {
  const rows = await db("audit_log").orderBy("created_at", "desc").limit(Math.min(Math.max(limit, 1), 500));
  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    actor: r.actor,
    target: r.target,
    detail: r.detail,
    createdAt: r.created_at,
  }));
}
