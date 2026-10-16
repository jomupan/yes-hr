/* Staff registration + employee company-id migration.
   Extracted from hr-store to keep that file focused and under the line limit.
   Re-exported by hr-store for backward compatibility. */
import type {
  AttendanceData,
  ClaimData,
  DopeData,
  EvalData,
  LeaveData,
  UserProfile,
  UserRole,
} from "./hr-types";
import {
  getJSON,
  setJSON,
  getUserIndex,
  setUserIndex,
  getUser,
  hashPassword,
} from "./hr-store";
import { getDepartmentById } from "./departments";
import { getCompanyById, PARENT_COMPANY_ID } from "./companies";

const userKey = (u: string) => `hr:user:${u}`;
const dopeKey = (u: string) => `hr:dopetest:${u}`;
const attendanceKey = (u: string) => `hr:attendance:${u}`;
const leaveKey = (u: string) => `hr:leave:${u}`;
const claimKey = (u: string) => `hr:claim:${u}`;
const evalKey = (u: string) => `hr:evaluation:${u}`;

const COMPANY_MIGRATE_FLAG = "hr:employees-company-migrated";

/**
 * One-time backfill: assign companyId to every existing employee that lacks
 * one. Employees whose department has a companyId inherit that company;
 * everyone else falls back to the parent company (YES EMPIRE Group). Existing
 * assignments are never lost — this only fills in the new canonical link.
 */
export function migrateEmployeeCompanyIds(): void {
  if (getJSON<boolean>(COMPANY_MIGRATE_FLAG, false)) return;
  const index = getUserIndex();
  for (const u of index) {
    const p = getUser(u);
    if (!p) continue;
    if (p.companyId) continue;
    let companyId = PARENT_COMPANY_ID;
    if (p.departmentId) {
      const dept = getDepartmentById(p.departmentId);
      if (dept?.companyId) companyId = dept.companyId;
    }
    setJSON<UserProfile>(userKey(u), { ...p, companyId });
  }
  setJSON(COMPANY_MIGRATE_FLAG, true);
}

/* ---------- registration ----------
   Staff self-registration always creates a normal STAFF account. The first
   user is no longer auto-promoted to admin — that rule misclassified ordinary
   staff (e.g. nurin) as admins when they registered before the seeded accounts
   existed, which then blocked the "Remove Staff" action. Admin accounts are
   seeded explicitly via ensureSeedUsers() instead.

   Department and Company are now required, validated ids from the departments
   and companies stores — the backend verifies both exist and are active, and
   that the department belongs to the selected company, before the account is
   created, so staff can never register a free-text/fake department or company. */
export function registerUser(
  name: string,
  username: string,
  role: string,
  password?: string,
  email?: string,
  departmentId?: string,
  companyId?: string,
): { ok: boolean; error?: string } {
  // Backend validation: company must exist and be active.
  const company = getCompanyById(companyId);
  if (!company) {
    return { ok: false, error: "Please select your company." };
  }
  if (!company.active) {
    return { ok: false, error: "The selected company is no longer available." };
  }
  // Backend validation: department must exist and be active.
  const dept = getDepartmentById(departmentId);
  if (!dept) {
    return { ok: false, error: "Please select your department." };
  }
  if (!dept.active) {
    return {
      ok: false,
      error: "The selected department is no longer available.",
    };
  }
  // The department must belong to the selected company.
  if (dept.companyId !== company.id) {
    return {
      ok: false,
      error: "The selected department does not belong to the selected company.",
    };
  }
  const index = getUserIndex();
  if (!index.includes(username)) {
    index.push(username);
    setUserIndex(index);
  }
  const authRole: UserRole = "staff";
  setJSON<UserProfile>(userKey(username), {
    username,
    fullName: name,
    role: role || "Staff",
    joinedAt: new Date().toISOString(),
    isAdmin: false,
    authRole,
    email: email && email.trim() ? email.trim() : `${username}@yesempire.com`,
    employeeId: `EMP${String(index.length).padStart(3, "0")}`,
    passwordHash: hashPassword(password || username),
    departmentId: dept.id,
    department: dept.name,
    companyId: company.id,
    company: company.name,
  });
  setJSON<DopeData>(dopeKey(username), { history: [] });
  setJSON<AttendanceData>(attendanceKey(username), { records: [] });
  setJSON<LeaveData>(leaveKey(username), {
    balance: { Annual: 14, Medical: 14, Emergency: 3 },
    applications: [],
  });
  setJSON<ClaimData>(claimKey(username), { claims: [] });
  setJSON<EvalData>(evalKey(username), {
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
  return { ok: true };
}
