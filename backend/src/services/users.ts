import crypto from "crypto";
import bcrypt from "bcryptjs";
import type { Knex } from "knex";
import { db } from "../db/knex";
import { config } from "../config";
import { nowISO } from "../lib/time";

export type AuthRole = "staff" | "admin";

export interface UserRow {
  id: string;
  username: string;
  full_name: string;
  job_title: string;
  email: string;
  employee_id: string;
  auth_role: AuthRole;
  password_hash: string;
  account_status: "active" | "inactive";
  company_id: string | null;
  department_id: string | null;
  leave_annual: number;
  leave_medical: number;
  leave_emergency: number;
  joined_at: string;
  updated_at: string;
}

/** The public profile shape — identical to the frontend's UserProfile type
 *  (minus passwordHash, which never leaves the server). */
export interface UserProfileDto {
  username: string;
  fullName: string;
  role: string;
  joinedAt: string;
  isAdmin: boolean;
  authRole: AuthRole;
  accountStatus: "active" | "inactive";
  email: string;
  employeeId: string;
  companyId: string | null;
  company: string;
  departmentId: string | null;
  department: string;
}

export const newId = () => crypto.randomUUID();

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw || "", hash || "");
}

/** Registration / reset policy: 8+ chars, upper, lower, number. */
export function passwordPolicyError(pw: string): string | null {
  if ((pw || "").length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(pw) || !/[a-z]/.test(pw) || !/[0-9]/.test(pw))
    return "Password must contain at least one uppercase letter, one lowercase letter and one number.";
  return null;
}

export function normalizeUsername(u: string): string {
  return (u || "").trim().toLowerCase().replace(/\s+/g, ".");
}

/** Resolve company/department names in one query for a batch of users. */
export async function toProfiles(rows: UserRow[], trx: Knex = db): Promise<UserProfileDto[]> {
  const [companies, departments] = await Promise.all([
    trx("companies").select("id", "name"),
    trx("departments").select("id", "name"),
  ]);
  const cMap = new Map(companies.map((c: { id: string; name: string }) => [c.id, c.name]));
  const dMap = new Map(departments.map((d: { id: string; name: string }) => [d.id, d.name]));
  return rows.map((r) => ({
    username: r.username,
    fullName: r.full_name,
    role: r.job_title,
    joinedAt: r.joined_at,
    isAdmin: r.auth_role === "admin",
    authRole: r.auth_role,
    accountStatus: r.account_status === "inactive" ? "inactive" : "active",
    email: r.email,
    employeeId: r.employee_id,
    companyId: r.company_id,
    company: (r.company_id && cMap.get(r.company_id)) || "YES EMPIRE Group",
    departmentId: r.department_id,
    department: (r.department_id && dMap.get(r.department_id)) || "Unassigned",
  }));
}

export async function toProfile(row: UserRow, trx: Knex = db): Promise<UserProfileDto> {
  return (await toProfiles([row], trx))[0];
}

export async function findUserByUsername(username: string, trx: Knex = db): Promise<UserRow | undefined> {
  return trx<UserRow>("users").where({ username: normalizeUsername(username) }).first();
}

/** Login identifier can be username, email or employee ID (case-insensitive). */
export async function findUserByIdentifier(identifier: string): Promise<UserRow | undefined> {
  const id = (identifier || "").trim().toLowerCase();
  if (!id) return undefined;
  return db<UserRow>("users")
    .whereRaw("lower(username) = ?", [id])
    .orWhereRaw("lower(email) = ?", [id])
    .orWhereRaw("lower(employee_id) = ?", [id])
    .first();
}

/** Next sequential employee id with the given prefix, e.g. EMP024 / ADM003. */
export async function nextEmployeeId(prefix: "EMP" | "ADM", trx: Knex = db): Promise<string> {
  const rows: { employee_id: string }[] = await trx("users")
    .select("employee_id")
    .where("employee_id", "like", `${prefix}%`);
  const max = rows.reduce((m, r) => {
    const n = parseInt(r.employee_id.slice(prefix.length), 10);
    return Number.isFinite(n) && n > m ? n : m;
  }, 0);
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

export interface CreateUserInput {
  username: string;
  fullName: string;
  jobTitle: string;
  email: string;
  password: string;
  authRole: AuthRole;
  companyId?: string | null;
  departmentId?: string | null;
  employeeId?: string;
}

export async function createUser(input: CreateUserInput, trx: Knex = db): Promise<UserRow> {
  const now = nowISO();
  const leave = await defaultLeaveBalances(trx);
  const row: UserRow = {
    id: newId(),
    username: normalizeUsername(input.username),
    full_name: input.fullName.trim(),
    job_title: input.jobTitle?.trim() || (input.authRole === "admin" ? "Administrator" : "Staff"),
    email: input.email.trim().toLowerCase(),
    employee_id: input.employeeId || (await nextEmployeeId(input.authRole === "admin" ? "ADM" : "EMP", trx)),
    auth_role: input.authRole,
    password_hash: await hashPassword(input.password),
    account_status: "active",
    company_id: input.companyId || null,
    department_id: input.departmentId || null,
    leave_annual: leave.Annual,
    leave_medical: leave.Medical,
    leave_emergency: leave.Emergency,
    joined_at: now,
    updated_at: now,
  };
  await trx("users").insert(row);
  return row;
}

/** Default leave balances come from admin Settings, falling back to config. */
export async function defaultLeaveBalances(trx: Knex = db): Promise<{ Annual: number; Medical: number; Emergency: number }> {
  const row = await trx("settings").where({ key: "defaultLeave" }).first();
  if (row) {
    try {
      return { ...config.rules.defaultLeave, ...JSON.parse(row.value) };
    } catch {
      /* fall through */
    }
  }
  return { ...config.rules.defaultLeave };
}

export async function activeAdminCount(trx: Knex = db): Promise<number> {
  const r = await trx("users").where({ auth_role: "admin", account_status: "active" }).count({ n: "*" }).first();
  return Number(r?.n ?? 0);
}
