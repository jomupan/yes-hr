import type { UserProfile } from "./hr-types";
import { getUser, getUserIndex } from "./hr-store";
import { api } from "./api";
import { syncAdminDirectory } from "./api-admin";

/* ──────────────────────────────────────────────────────────────
   Admin account management, saved on the server.

   An "admin account" is a user whose authRole is "admin". Every change
   here goes to the backend (which checks the caller is an admin and
   writes the audit log), then the local copy of the user list is
   refreshed so the Admin Accounts page shows the new state.
   ────────────────────────────────────────────────────────────── */

/** Result type reused by every privileged admin operation. */
export interface AdminMgmtResult {
  ok: boolean;
  error?: string;
}

/* ---------- role helpers (read the synced local copy) ---------- */

/** Is this profile an admin account? */
export function isAdminProfile(p: UserProfile | null | undefined): boolean {
  return !!p && (p.authRole === "admin" || p.isAdmin === true);
}

/** Count active admin accounts (shown on the page; the server enforces the rule). */
export function activeAdminCount(): number {
  return getUserIndex().filter((u) => {
    const p = getUser(u);
    return isAdminProfile(p) && (p?.accountStatus ?? "active") === "active";
  }).length;
}

/** Send a change to the server, then refresh the local copy and audit log. */
async function run(fn: () => Promise<unknown>, fallback: string): Promise<AdminMgmtResult> {
  try {
    await fn();
  } catch (e) {
    return { ok: false, error: e instanceof Error && e.message ? e.message : fallback };
  }
  await Promise.all([syncAdminDirectory(), loadAuditLog()]);
  return { ok: true };
}

/* ---------- create ---------- */

export interface CreateAdminInput {
  fullName: string;
  username: string;
  email: string;
  password: string;
  role: string; // job title, e.g. "HR Administrator"
  companyId?: string;
  departmentId?: string;
}

/** Create a brand-new admin account on the server. */
export function createAdminAccount(input: CreateAdminInput, _createdBy?: string): Promise<AdminMgmtResult> {
  void _createdBy; // the server records who is logged in
  return run(
    () =>
      api("/admin/admins", {
        body: {
          fullName: input.fullName.trim(),
          username: input.username.trim().toLowerCase().replace(/\s+/g, "."),
          email: input.email.trim().toLowerCase(),
          password: input.password,
          role: input.role || "Administrator",
          companyId: input.companyId || undefined,
          departmentId: input.departmentId || undefined,
        },
      }),
    "Unable to create the admin account.",
  );
}

/* ---------- password ---------- */

/** Change your OWN password (needs the current password). */
export function changeAdminPassword(
  _username: string,
  currentPassword: string,
  newPassword: string,
  _actor?: string,
): Promise<AdminMgmtResult> {
  void _username;
  void _actor;
  return run(
    () => api("/auth/change-password", { body: { currentPassword, newPassword } }),
    "Unable to change the password.",
  );
}

/** Set a new password for another admin (no current password needed). */
export function resetAdminPassword(username: string, newPassword: string, _actor?: string): Promise<AdminMgmtResult> {
  void _actor;
  return run(
    () => api(`/admin/admins/${encodeURIComponent(username)}/reset-password`, { body: { newPassword } }),
    "Unable to reset the password.",
  );
}

/* ---------- deactivate / reactivate ---------- */

export function deactivateAdmin(username: string, _actor?: string): Promise<AdminMgmtResult> {
  void _actor;
  return run(
    () => api(`/admin/admins/${encodeURIComponent(username)}/deactivate`, { method: "POST" }),
    "Unable to deactivate the admin.",
  );
}

export function reactivateAdmin(username: string, _actor?: string): Promise<AdminMgmtResult> {
  void _actor;
  return run(
    () => api(`/admin/admins/${encodeURIComponent(username)}/reactivate`, { method: "POST" }),
    "Unable to reactivate the admin.",
  );
}

/* ---------- audit log (from the server) ---------- */

export interface AuditEntry {
  id: string;
  action: string;
  actor: string;
  target: string;
  detail: string;
  createdAt: string;
}

let auditCache: AuditEntry[] = [];

/** Fetch the latest audit entries from the server. */
export async function loadAuditLog(): Promise<void> {
  try {
    const res = await api<{ entries: AuditEntry[] }>("/admin/audit-log?limit=50");
    auditCache = res.entries;
  } catch {
    /* keep what we have */
  }
}

export function getAuditLog(limit = 50): AuditEntry[] {
  return auditCache.slice(0, limit);
}