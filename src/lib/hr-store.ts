import type {
  AttendanceData,
  ClaimData,
  DopeData,
  EvalData,
  LeaveData,
  UserProfile,
  UserRole,
} from "./hr-types";
import { canonicalizeAccountStatuses } from "./account-status";
import { ensureDepartmentsSeeded } from "./departments";
import {
  ensureCompaniesSeeded,
  getCompanyById,
  PARENT_COMPANY_ID,
} from "./companies";
import { migrateEmployeeCompanyIds } from "./registration";

/* Persistent localStorage-backed store with in-memory fallback. */
const memStore: Record<string, string> = {};

function rawGet(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return Object.prototype.hasOwnProperty.call(memStore, key)
      ? memStore[key]
      : null;
  }
}

function rawSet(key: string, value: string): void {
  memStore[key] = value;
  try {
    localStorage.setItem(key, value);
  } catch {
    /* fall back silently to memory */
  }
}

export function getJSON<T>(key: string, fallback: T): T {
  const raw = rawGet(key);
  if (raw === null || raw === undefined) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function setJSON<T>(key: string, value: T): void {
  rawSet(key, JSON.stringify(value));
}

export function removeKey(key: string): void {
  delete memStore[key];
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/* ---------- storage keys ---------- */
const K = {
  index: "hr:index",
  session: "hr:session",
  user: (u: string) => `hr:user:${u}`,
  dope: (u: string) => `hr:dopetest:${u}`,
  attendance: (u: string) => `hr:attendance:${u}`,
  leave: (u: string) => `hr:leave:${u}`,
  claim: (u: string) => `hr:claim:${u}`,
  eval: (u: string) => `hr:evaluation:${u}`,
};

/* ---------- auth helpers ---------- */
const SEED_FLAG = "hr:seeded";
const DEFAULT_ADMIN = {
  username: "admin",
  fullName: "System Administrator",
  role: "Administrator",
  email: "admin@yesempire.com",
  employeeId: "EMP001",
  password: "admin123",
};
const DEFAULT_STAFF = {
  username: "aina",
  fullName: "Aina",
  role: "Marketing Executive",
  email: "aina@yesempire.com",
  employeeId: "EMP023",
  password: "staff123",
};

/* Lightweight reversible hash — demo only, NOT real security. */
export function hashPassword(pw: string): string {
  try {
    return btoa(unescape(encodeURIComponent(`yes:${pw}`)));
  } catch {
    return `yes:${pw}`;
  }
}

export function verifyPassword(pw: string, hash: string): boolean {
  return hashPassword(pw || "") === hash;
}

export function roleOf(profile: UserProfile | null): UserRole {
  if (!profile) return "staff";
  if (profile.authRole) return profile.authRole;
  return profile.isAdmin ? "admin" : "staff";
}

/* Seed default admin + staff accounts once so the login page is usable. */
export function ensureSeedUsers(): void {
  // Always run the one-time repairs so legacy/inconsistent records are
  // normalized regardless of whether seeding has already happened.
  ensureCompaniesSeeded();
  repairSeededStaffRole();
  canonicalizeAccountStatuses();
  migrateEmployeeCompanyIds();
  if (getJSON<boolean>(SEED_FLAG, false)) {
    return;
  }
  const index = getUserIndex();
  if (!index.includes(DEFAULT_ADMIN.username)) {
    seedUser(DEFAULT_ADMIN, "admin");
  }
  if (!index.includes(DEFAULT_STAFF.username)) {
    seedUser(DEFAULT_STAFF, "staff");
  }
  setJSON(SEED_FLAG, true);
}

/**
 * Keep the seeded sample-staff account (DEFAULT_STAFF) on the "staff" role.
 * Unlike the previous global repair, this does NOT touch any other admin
 * account — multiple admins are now supported and may be created/managed
 * from the Admin Portal. Public registration already hard-codes the role
 * to "staff" (see registerUser), so self-registered accounts can never
 * self-promote; no broad demotion pass is required.
 */
function repairSeededStaffRole(): void {
  const p = getUser(DEFAULT_STAFF.username);
  if (!p) return;
  if (p.authRole !== "staff" || p.isAdmin) {
    setJSON<UserProfile>(K.user(DEFAULT_STAFF.username), {
      ...p,
      authRole: "staff",
      isAdmin: false,
    });
  }
}

function seedUser(
  u: {
    username: string;
    fullName: string;
    role: string;
    email: string;
    employeeId: string;
    password: string;
  },
  authRole: UserRole,
): void {
  const index = getUserIndex();
  if (!index.includes(u.username)) {
    index.push(u.username);
    setUserIndex(index);
  }
  setJSON<UserProfile>(K.user(u.username), {
    username: u.username,
    fullName: u.fullName,
    role: u.role,
    joinedAt: new Date().toISOString(),
    email: u.email,
    employeeId: u.employeeId,
    authRole,
    isAdmin: authRole === "admin",
    passwordHash: hashPassword(u.password),
  });
  setJSON<DopeData>(K.dope(u.username), { history: [] });
  setJSON<AttendanceData>(K.attendance(u.username), { records: [] });
  setJSON<LeaveData>(K.leave(u.username), {
    balance: { Annual: 14, Medical: 14, Emergency: 3 },
    applications: [],
  });
  setJSON<ClaimData>(K.claim(u.username), { claims: [] });
  setJSON<EvalData>(K.eval(u.username), {
    evaluations: [
      {
        period: "2025 H2",
        overall: 78,
        categories: {
          Work_Quality: 80,
          Teamwork: 82,
          Punctuality: 70,
          Initiative: 76,
        },
        comments:
          "Consistent performance; punctuality on task submissions can be improved.",
      },
    ],
  });
}

/**
 * Validate credentials. Accepts an email, employee ID, or username.
 * Returns the matching username + inactive flag on success, or null on
 * failure — including when the account is inactive. Never reveals whether
 * the identifier exists.
 */
export function authenticate(
  identifier: string,
  password: string,
): { username: string; inactive: boolean } | null {
  const id = identifier.trim().toLowerCase();
  if (!id || !password) return null;
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
  const profile = getUser(match);
  if (!profile || !profile.passwordHash) return null;
  if (!verifyPassword(password, profile.passwordHash)) return null;
  // Blocked login for deactivated accounts — admin soft-deletes a staff
  // member by flipping accountStatus to "inactive". Uses the SAME canonical
  // normalization as the Admin Employee List (isAccountActive) so the two
  // can never disagree — anything not exactly "inactive" (case-insensitive,
  // trimmed, undefined→active) is treated as active.
  const status = (profile.accountStatus ?? "active")
    .toString()
    .toLowerCase()
    .trim();
  return { username: match, inactive: status === "inactive" };
}

/* ---------- admin helpers ---------- */
export function getAllUsers(): {
  username: string;
  profile: UserProfile;
  dope: DopeData;
}[] {
  return getUserIndex().map((u) => {
    const profile = getUser(u);
    return {
      username: u,
      profile: profile || {
        username: u,
        fullName: u,
        role: "Staff",
        joinedAt: "",
      },
      dope: getDope(u),
    };
  });
}

export function setAdminFlag(username: string, isAdmin: boolean): void {
  const profile = getUser(username);
  if (!profile) return;
  setJSON<UserProfile>(K.user(username), { ...profile, isAdmin });
}

/* ---------- session ---------- */
export function getSessionUsername(): string | null {
  return getJSON<{ username: string | null }>(K.session, { username: null })
    .username;
}

export function setSession(username: string | null): void {
  setJSON(K.session, { username });
  // Logging out also drops the backend token (see lib/api.ts), wherever
  // it was kept, plus the inactivity timestamp.
  if (username === null) {
    removeKey("hr:token");
    try {
      sessionStorage.removeItem("hr:token");
      sessionStorage.removeItem("hr:lastActive");
    } catch {
      /* ignore */
    }
  }
}

/* ---------- user index ---------- */
export function getUserIndex(): string[] {
  return getJSON<string[]>(K.index, []);
}

export function setUserIndex(index: string[]): void {
  setJSON(K.index, index);
}

/* ---------- per-user records ---------- */
export function getUser(username: string): UserProfile | null {
  return getJSON<UserProfile | null>(K.user(username), null);
}

export function getDope(username: string): DopeData {
  return getJSON<DopeData>(K.dope(username), { history: [] });
}

export function getAttendance(username: string): AttendanceData {
  return getJSON<AttendanceData>(K.attendance(username), { records: [] });
}

export function getLeave(username: string): LeaveData {
  return getJSON<LeaveData>(K.leave(username), {
    balance: { Annual: 14, Medical: 14, Emergency: 3 },
    applications: [],
  });
}

export function getClaim(username: string): ClaimData {
  return getJSON<ClaimData>(K.claim(username), { claims: [] });
}

export function getEval(username: string): EvalData {
  return getJSON<EvalData>(K.eval(username), { evaluations: [] });
}

/* ---------- password validation ---------- */
export interface PasswordValidation {
  ok: boolean;
  errors: string[];
}

/** Enforce the minimum password policy used by registration & reset. */
export function validatePassword(pw: string): PasswordValidation {
  const errors: string[] = [];
  if ((pw || "").length < 8)
    errors.push("Password must be at least 8 characters.");
  if (!/[A-Z]/.test(pw || ""))
    errors.push(
      "Password must contain at least one uppercase letter, one lowercase letter and one number.",
    );
  if (!/[a-z]/.test(pw || ""))
    errors.push(
      "Password must contain at least one uppercase letter, one lowercase letter and one number.",
    );
  if (!/[0-9]/.test(pw || ""))
    errors.push(
      "Password must contain at least one uppercase letter, one lowercase letter and one number.",
    );
  return { ok: errors.length === 0, errors };
}

/** Coarse strength estimate for the UI indicator. */
export function passwordStrength(pw: string): "weak" | "medium" | "strong" {
  let score = 0;
  if ((pw || "").length >= 8) score++;
  if ((pw || "").length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 2) return "weak";
  if (score <= 4) return "medium";
  return "strong";
}

/* Password reset tokens live in ./password-reset and are re-exported here
   for backward compatibility with components importing from hr-store. */
export {
  requestPasswordReset,
  isValidResetToken,
  resetPassword,
} from "./password-reset";

/* Registration + employee company-id migration live in ./registration and
   are re-exported here for backward compatibility with components importing
   from hr-store. */
export { registerUser, migrateEmployeeCompanyIds } from "./registration";

/* Dope status & scoring live in ./dope-scoring and are re-exported here
   for backward compatibility with components importing from hr-store. */
export { getDopeStatus, scoreDopeTest, buildDopeResult } from "./dope-scoring";

/* ---------- helpers ----------
   Date/time/identity helpers live in ./hr-utils and are re-exported here
   for backward compatibility with components importing from hr-store. */
export {
  todayISO,
  nowISO,
  fmtDate,
  fmtTime,
  daysBetween,
  initials,
  uid,
  workHours,
} from "./hr-utils";

/* Leave attachment helpers live in ./attachment and are re-exported here
   for backward compatibility with components importing from hr-store. */
export {
  ATTACHMENT_MAX_BYTES,
  validateAttachment,
  sanitizeFileName,
  readFileAsDataUrl,
  buildAttachment,
  downloadAttachment,
  formatFileSize,
} from "./attachment";
export type { AttachmentValidation } from "./attachment";
