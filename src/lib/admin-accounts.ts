import type { UserProfile, UserRole } from "./hr-types";
import {
  getJSON,
  setJSON,
  getUser,
  getUserIndex,
  hashPassword,
  verifyPassword,
} from "./hr-store";

/* ──────────────────────────────────────────────────────────────
   Admin account management.

   An "admin account" is simply a UserProfile whose authRole is
   "admin" (or isAdmin === true for legacy records). This store adds
   the privileged operations an authenticated admin may perform:

     • create a brand-new admin account
     • update permitted profile fields
     • change / reset an admin's password
     • deactivate / reactivate an admin (soft delete)
     • guard the last active admin from being deactivated

   Privileged ops also write an immutable audit-log entry so there is a
   trail of who did what to whom and when.

   SECURITY NOTE — this project has no server/backend. Every call below
   runs in the browser, so it cannot be considered true server-side
   authorization. When Supabase is connected later, these functions must
   be reimplemented as RLS-protected server actions. The function signatures
   and return shapes are designed to map cleanly onto that future backend.
   ────────────────────────────────────────────────────────────── */

const USER_KEY = (u: string) => `hr:user:${u}`;

/** Result type reused by every privileged admin operation. */
export interface AdminMgmtResult {
  ok: boolean;
  error?: string;
}

/* ---------- role helpers ---------- */

/** Is this profile an admin account? */
export function isAdminProfile(p: UserProfile | null | undefined): boolean {
  return !!p && (p.authRole === "admin" || p.isAdmin === true);
}

/** Set a profile's role. Mutates the stored record in place. */
export function setProfileRole(username: string, role: UserRole): void {
  const p = getUser(username);
  if (!p) return;
  setJSON<UserProfile>(USER_KEY(username), {
    ...p,
    authRole: role,
    isAdmin: role === "admin",
  });
}

/** Count active admin accounts (used by the last-admin guard). */
export function activeAdminCount(): number {
  return getUserIndex().filter((u) => {
    const p = getUser(u);
    return isAdminProfile(p) && (p?.accountStatus ?? "active") === "active";
  }).length;
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

/** Create a brand-new admin account. The caller MUST be an authenticated admin. */
export function createAdminAccount(
  input: CreateAdminInput,
  createdBy: string,
): AdminMgmtResult {
  const fullName = input.fullName.trim();
  const username = input.username.trim().toLowerCase().replace(/\s+/g, ".");
  const email = input.email.trim().toLowerCase();

  if (!fullName) return { ok: false, error: "Full name is required." };
  if (!username) return { ok: false, error: "Username is required." };
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return { ok: false, error: "A valid email is required." };
  if (!input.password || input.password.length < 8)
    return { ok: false, error: "Password must be at least 8 characters." };

  const index = getUserIndex();
  if (index.includes(username))
    return { ok: false, error: "That username already exists." };
  if (index.some((u) => (getUser(u)?.email || "").toLowerCase() === email))
    return { ok: false, error: "That email is already in use." };

  index.push(username);
  setJSON("hr:index", index);

  setJSON<UserProfile>(USER_KEY(username), {
    username,
    fullName,
    role: input.role || "Administrator",
    joinedAt: new Date().toISOString(),
    email,
    employeeId: `ADM${String(index.length).padStart(3, "0")}`,
    authRole: "admin",
    isAdmin: true,
    passwordHash: hashPassword(input.password),
    accountStatus: "active",
    ...(input.companyId ? { companyId: input.companyId } : {}),
    ...(input.departmentId ? { departmentId: input.departmentId } : {}),
  });

  // Seed the standard per-user datasets so the new admin can use the portal.
  setJSON(`hr:dopetest:${username}`, { history: [] });
  setJSON(`hr:attendance:${username}`, { records: [] });
  setJSON(`hr:leave:${username}`, {
    balance: { Annual: 14, Medical: 14, Emergency: 3 },
    applications: [],
  });
  setJSON(`hr:claim:${username}`, { claims: [] });
  setJSON(`hr:evaluation:${username}`, { evaluations: [] });

  logAudit({
    action: "admin_created",
    actor: createdBy,
    target: username,
    detail: `Created admin account ${fullName} (${email}).`,
  });

  return { ok: true };
}

/* ---------- update profile ---------- */

export interface UpdateAdminInput {
  fullName?: string;
  role?: string;
  email?: string;
  companyId?: string;
  departmentId?: string;
}

/** Update permitted (non-credential, non-role) fields on an admin account. */
export function updateAdminAccount(
  username: string,
  input: UpdateAdminInput,
  actor: string,
): AdminMgmtResult {
  const p = getUser(username);
  if (!p) return { ok: false, error: "Admin account not found." };
  if (!isAdminProfile(p))
    return { ok: false, error: "That account is not an admin." };

  const next: UserProfile = { ...p };
  if (input.fullName?.trim()) next.fullName = input.fullName.trim();
  if (input.role !== undefined) next.role = input.role;
  if (input.email !== undefined) {
    const email = input.email.trim().toLowerCase();
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
      return { ok: false, error: "A valid email is required." };
    next.email = email;
  }
  if (input.companyId !== undefined) next.companyId = input.companyId;
  if (input.departmentId !== undefined) next.departmentId = input.departmentId;

  setJSON<UserProfile>(USER_KEY(username), next);
  logAudit({
    action: "admin_updated",
    actor,
    target: username,
    detail: `Updated admin profile for ${p.fullName}.`,
  });
  return { ok: true };
}

/* ---------- password ---------- */

/** Change an admin's password. Verifies the current password first. */
export function changeAdminPassword(
  username: string,
  currentPassword: string,
  newPassword: string,
  actor: string,
): AdminMgmtResult {
  const p = getUser(username);
  if (!p) return { ok: false, error: "Admin account not found." };
  if (!isAdminProfile(p))
    return { ok: false, error: "That account is not an admin." };
  if (!p.passwordHash || !verifyPassword(currentPassword, p.passwordHash))
    return { ok: false, error: "Current password is incorrect." };
  if (!newPassword || newPassword.length < 8)
    return { ok: false, error: "New password must be at least 8 characters." };

  setJSON<UserProfile>(USER_KEY(username), {
    ...p,
    passwordHash: hashPassword(newPassword),
  });
  logAudit({
    action: "admin_password_changed",
    actor,
    target: username,
    detail: `Password changed for admin ${p.fullName}.`,
  });
  return { ok: true };
}

/** Admin-initiated reset — sets a new password without the current one. */
export function resetAdminPassword(
  username: string,
  newPassword: string,
  actor: string,
): AdminMgmtResult {
  const p = getUser(username);
  if (!p) return { ok: false, error: "Admin account not found." };
  if (!isAdminProfile(p))
    return { ok: false, error: "That account is not an admin." };
  if (!newPassword || newPassword.length < 8)
    return { ok: false, error: "New password must be at least 8 characters." };

  setJSON<UserProfile>(USER_KEY(username), {
    ...p,
    passwordHash: hashPassword(newPassword),
  });
  logAudit({
    action: "admin_password_reset",
    actor,
    target: username,
    detail: `Password reset for admin ${p.fullName}.`,
  });
  return { ok: true };
}

/* ---------- deactivate / reactivate ---------- */

/** Deactivate an admin account. Guards the last active admin + self. */
export function deactivateAdmin(
  username: string,
  actor: string,
): AdminMgmtResult {
  const p = getUser(username);
  if (!p) return { ok: false, error: "Admin account not found." };
  if (!isAdminProfile(p))
    return { ok: false, error: "That account is not an admin." };
  if (username === actor)
    return { ok: false, error: "You cannot deactivate your own account." };
  if (activeAdminCount() <= 1)
    return {
      ok: false,
      error: "Cannot deactivate the last active administrator account.",
    };

  setJSON<UserProfile>(USER_KEY(username), {
    ...p,
    accountStatus: "inactive",
  });
  logAudit({
    action: "admin_deactivated",
    actor,
    target: username,
    detail: `Deactivated admin account ${p.fullName}.`,
  });
  return { ok: true };
}

/** Reactivate a previously deactivated admin account. */
export function reactivateAdmin(
  username: string,
  actor: string,
): AdminMgmtResult {
  const p = getUser(username);
  if (!p) return { ok: false, error: "Admin account not found." };
  if (!isAdminProfile(p))
    return { ok: false, error: "That account is not an admin." };

  setJSON<UserProfile>(USER_KEY(username), {
    ...p,
    accountStatus: "active",
  });
  logAudit({
    action: "admin_reactivated",
    actor,
    target: username,
    detail: `Reactivated admin account ${p.fullName}.`,
  });
  return { ok: true };
}

/* ──────────────────────────────────────────────────────────────
   Audit log — append-only record of privileged admin actions.
   ────────────────────────────────────────────────────────────── */

export interface AuditEntry {
  id: string;
  action: string;
  actor: string;
  target: string;
  detail: string;
  createdAt: string;
}

const AUDIT_KEY = "hr:admin-audit-log";

function auditId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function logAudit(entry: {
  action: string;
  actor: string;
  target: string;
  detail: string;
}): void {
  const list = getJSON<AuditEntry[]>(AUDIT_KEY, []);
  list.unshift({
    id: auditId(),
    action: entry.action,
    actor: entry.actor,
    target: entry.target,
    detail: entry.detail,
    createdAt: new Date().toISOString(),
  });
  setJSON(AUDIT_KEY, list.slice(0, 500));
}

export function getAuditLog(limit = 50): AuditEntry[] {
  return getJSON<AuditEntry[]>(AUDIT_KEY, []).slice(0, limit);
}
