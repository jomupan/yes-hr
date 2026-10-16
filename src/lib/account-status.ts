import { getUser, getUserIndex, setJSON } from "./hr-store";
import type { UserProfile, AccountStatus } from "./hr-types";

const USER_KEY = (u: string) => `hr:user:${u}`;

/**
 * Normalize every stored accountStatus value to the canonical lowercase
 * "active" / "inactive" form. This repairs records left inconsistent by
 * earlier bugs (e.g. "Active", "ACTIVE", " true", or a missing field) WITHOUT
 * flipping intent: a value that normalizes to "inactive" stays "inactive"
 * (an intentional admin removal), and anything else becomes "active". Run
 * once during boot so the Employee List and login stay in lock-step, since
 * both read through normalizeAccountStatus().
 */
export function canonicalizeAccountStatuses(): void {
  for (const u of getUserIndex()) {
    const p = getUser(u);
    if (!p) continue;
    const raw = (p.accountStatus ?? "active").toString().toLowerCase().trim();
    const canonical: AccountStatus = raw === "inactive" ? "inactive" : "active";
    if ((p.accountStatus ?? "active") !== canonical) {
      setJSON<UserProfile>(USER_KEY(u), { ...p, accountStatus: canonical });
    }
  }
}

/**
 * Single source of truth for account status. Anything that is not exactly
 * "inactive" (case-insensitive) is treated as active, and an undefined value
 * defaults to active. Both the login flow (authenticate) and the Admin
 * Employee List (isAccountActive) must go through this so their status checks
 * can never diverge — which previously caused a staff member to show "Active"
 * in the admin list while being blocked at login.
 */
export function normalizeAccountStatus(
  profile: UserProfile | null,
): AccountStatus {
  const raw = (profile?.accountStatus ?? "active")
    .toString()
    .toLowerCase()
    .trim();
  return raw === "inactive" ? "inactive" : "active";
}

/** True when the account may log in / access the portal. Defaults to active. */
export function isAccountActive(profile: UserProfile | null): boolean {
  return normalizeAccountStatus(profile) === "active";
}

/** Low-level setter — used by the higher-level guards below. */
export function setAccountStatus(
  username: string,
  status: AccountStatus,
): void {
  const profile = getUser(username);
  if (!profile) return;
  setJSON<UserProfile>(USER_KEY(username), {
    ...profile,
    accountStatus: status,
  });
}

export interface StaffActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Soft-delete a staff member. The account becomes inactive (cannot log in)
 * but all HR history is preserved. Guards prevent deactivating admin accounts
 * or the currently-logged-in admin's own account.
 */
export function deactivateStaff(
  username: string,
  currentAdminUsername: string,
): StaffActionResult {
  const profile = getUser(username);
  if (!profile) return { ok: false, error: "Employee not found." };
  if (profile.authRole === "admin" || profile.isAdmin) {
    return { ok: false, error: "Admin accounts cannot be deactivated." };
  }
  if (username === currentAdminUsername) {
    return { ok: false, error: "You cannot deactivate your own account." };
  }
  setAccountStatus(username, "inactive");
  return { ok: true };
}

/** Reactivate a previously deactivated staff account. */
export function reactivateStaff(username: string): StaffActionResult {
  const profile = getUser(username);
  if (!profile) return { ok: false, error: "Employee not found." };
  setAccountStatus(username, "active");
  return { ok: true };
}
