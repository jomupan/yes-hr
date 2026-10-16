import type { UserProfile } from "./hr-types";
import {
  getJSON,
  getUser,
  getUserIndex,
  setJSON,
  hashPassword,
} from "./hr-store";
import { validatePassword } from "./hr-store";

const RESET_TOKENS = "hr:reset-tokens";
const RESET_TTL_MS = 30 * 60 * 1000; // 30 minutes
const USER_KEY = (u: string) => `hr:user:${u}`;

interface ResetTokenRecord {
  token: string;
  username: string;
  expiresAt: number;
}

function getResetTokens(): ResetTokenRecord[] {
  return getJSON<ResetTokenRecord[]>(RESET_TOKENS, []);
}
function setResetTokens(list: ResetTokenRecord[]): void {
  setJSON(RESET_TOKENS, list);
}

function genToken(): string {
  return (
    Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  );
}

/**
 * Create a single-use reset token for the account matching `identifier`
 * (email / employee ID / username). Returns the token on success, or null if
 * no account matches. Callers must never reveal which case occurred.
 */
export function requestPasswordReset(identifier: string): string | null {
  const id = identifier.trim().toLowerCase();
  if (!id) return null;
  const index = getUserIndex();
  const match = index.find((u) => {
    const p = getUser(u);
    if (!p) return false;
    return (
      u === id ||
      (p.email || "").toLowerCase() === id ||
      (p.employeeId || "").toLowerCase() === id
    );
  });
  if (!match) return null;
  const token = genToken();
  const list = getResetTokens().filter((t) => t.username !== match);
  list.push({ token, username: match, expiresAt: Date.now() + RESET_TTL_MS });
  setResetTokens(list);
  return token;
}

/** Validate a reset token without consuming it (used by the reset page). */
export function isValidResetToken(token: string): boolean {
  if (!token) return false;
  const list = getResetTokens();
  const rec = list.find((t) => t.token === token);
  if (!rec) return false;
  if (rec.expiresAt < Date.now()) {
    setResetTokens(list.filter((t) => t.token !== token));
    return false;
  }
  return true;
}

/**
 * Consume a reset token and set a new password. The token becomes invalid
 * immediately after use (single-use). Returns true on success.
 */
export function resetPassword(token: string, newPassword: string): boolean {
  if (!token) return false;
  const v = validatePassword(newPassword);
  if (!v.ok) return false;
  const list = getResetTokens();
  const rec = list.find((t) => t.token === token);
  if (!rec || rec.expiresAt < Date.now()) {
    setResetTokens(list.filter((t) => t.token !== token));
    return false;
  }
  const profile = getUser(rec.username);
  if (!profile) {
    setResetTokens(list.filter((t) => t.token !== token));
    return false;
  }
  setJSON<UserProfile>(USER_KEY(rec.username), {
    ...profile,
    passwordHash: hashPassword(newPassword),
  });
  setResetTokens(list.filter((t) => t.token !== token));
  return true;
}
