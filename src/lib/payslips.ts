import type { UserProfile } from "./hr-types";
import {
  getJSON,
  setJSON,
  getUser,
  getUserIndex,
  uid,
  nowISO,
} from "./hr-store";
import {
  validateAttachment,
  sanitizeFileName,
  readFileAsDataUrl,
  ATTACHMENT_MAX_BYTES,
} from "./attachment";
import { isAccountActive } from "./account-status";
import { notifyPayslipAvailable } from "./notification-store";

/* ---------- payslip records ----------
   Payslips are stored in a single shared store keyed `hr:payslips`, each
   record linked to an employee by their stable username (the internal
   database key, never the display name). Files are persisted as base64
   data URLs — the same approach the leave-attachment system already uses
   in this project (there is no server-side upload folder available in a
   frontend-only build). Staff retrieval is strictly filtered by the
   logged-in username so a user can never read another employee's payslip. */

export interface PayslipFile {
  /** Original file name (sanitised before storage). */
  name: string;
  /** MIME type, validated against an allow-list. */
  type: string;
  /** File size in bytes. */
  size: number;
  /** Base64 data URL used to persist & re-download the file. */
  dataUrl: string;
}

export type PayslipStatus = "active" | "removed";

export interface PayslipRecord {
  id: string;
  /** Owning employee username — the canonical link to the user record. */
  username: string;
  month: number; // 1-12
  year: number;
  file: PayslipFile;
  note?: string;
  status: PayslipStatus;
  uploadedBy: string;
  createdAt: string;
  updatedAt: string;
}

const PAYSLIPS_KEY = "hr:payslips";

function getAllRaw(): PayslipRecord[] {
  return getJSON<PayslipRecord[]>(PAYSLIPS_KEY, []);
}

function saveAll(list: PayslipRecord[]): void {
  setJSON(PAYSLIPS_KEY, list);
}

export interface PayslipSaveResult {
  ok: boolean;
  error?: string;
  payslip?: PayslipRecord;
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export function monthName(m: number): string {
  return MONTHS[m - 1] || "";
}

export function periodLabel(month: number, year: number): string {
  return `${monthName(month)} ${year}`;
}

/** All payslips (active + removed) — admin views. */
export function getAllPayslips(): PayslipRecord[] {
  return getAllRaw().sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

/** Only active payslips — admin list default. */
export function getActivePayslips(): PayslipRecord[] {
  return getAllPayslips().filter((p) => p.status === "active");
}

/** Payslips belonging to a single employee (active only). Staff access. */
export function getPayslipsForUser(username: string): PayslipRecord[] {
  return getAllPayslips()
    .filter((p) => p.username === username && p.status === "active")
    .sort((a, b) => b.year - a.year || b.month - a.month);
}

/** Find an existing active payslip for an employee + month + year. */
export function findPayslip(
  username: string,
  month: number,
  year: number,
): PayslipRecord | undefined {
  return getAllRaw().find(
    (p) =>
      p.username === username &&
      p.month === month &&
      p.year === year &&
      p.status === "active",
  );
}

/** Validate a payslip file before it is read/stored. */
export function validatePayslipFile(file: File): {
  ok: boolean;
  error?: string;
} {
  if (file.size > ATTACHMENT_MAX_BYTES) {
    return { ok: false, error: "File size must not exceed 5 MB." };
  }
  const v = validateAttachment(file);
  if (!v.ok) return v;
  return { ok: true };
}

/** Build a PayslipFile from a validated File. */
export async function buildPayslipFile(
  file: File,
): Promise<PayslipFile | null> {
  const v = validatePayslipFile(file);
  if (!v.ok) return null;
  const dataUrl = await readFileAsDataUrl(file);
  return {
    name: sanitizeFileName(file.name),
    type: file.type,
    size: file.size,
    dataUrl,
  };
}

/** Upload a new payslip. Prevents duplicates for the same employee+month+year. */
export async function uploadPayslip(
  username: string,
  month: number,
  year: number,
  file: File,
  note: string,
  uploadedBy: string,
): Promise<PayslipSaveResult> {
  if (!username) return { ok: false, error: "Please select an employee." };
  const employee = getUser(username);
  if (!employee) return { ok: false, error: "Employee not found." };
  if (!month || !year)
    return { ok: false, error: "Please select a month and year." };
  const existing = findPayslip(username, month, year);
  if (existing) {
    return {
      ok: false,
      error: `A payslip already exists for this employee for ${periodLabel(month, year)}.`,
    };
  }
  const fv = validatePayslipFile(file);
  if (!fv.ok) return { ok: false, error: fv.error };
  const built = await buildPayslipFile(file);
  if (!built)
    return {
      ok: false,
      error: "Only PDF, JPG, JPEG and PNG files are allowed.",
    };
  const now = nowISO();
  const record: PayslipRecord = {
    id: uid(),
    username,
    month,
    year,
    file: built,
    note: note.trim() || undefined,
    status: "active",
    uploadedBy,
    createdAt: now,
    updatedAt: now,
  };
  const list = getAllRaw();
  list.push(record);
  saveAll(list);
  // Notify only the owning employee.
  notifyPayslipAvailable(username, periodLabel(month, year), record.id);
  return { ok: true, payslip: record };
}

/** Replace an existing payslip's file (keeps the same record id). */
export async function replacePayslipFile(
  id: string,
  file: File,
): Promise<PayslipSaveResult> {
  const list = getAllRaw();
  const idx = list.findIndex((p) => p.id === id);
  if (idx === -1) return { ok: false, error: "Payslip not found." };
  const fv = validatePayslipFile(file);
  if (!fv.ok) return { ok: false, error: fv.error };
  const built = await buildPayslipFile(file);
  if (!built)
    return {
      ok: false,
      error: "Only PDF, JPG, JPEG and PNG files are allowed.",
    };
  list[idx] = {
    ...list[idx],
    file: built,
    updatedAt: nowISO(),
  };
  saveAll(list);
  return { ok: true, payslip: list[idx] };
}

/** Soft-remove a payslip (status -> removed). Staff can no longer see it. */
export function removePayslip(id: string): PayslipSaveResult {
  const list = getAllRaw();
  const idx = list.findIndex((p) => p.id === id);
  if (idx === -1) return { ok: false, error: "Payslip not found." };
  list[idx] = { ...list[idx], status: "removed", updatedAt: nowISO() };
  saveAll(list);
  return { ok: true, payslip: list[idx] };
}

/** Resolve the employee profile for a payslip (regardless of active state). */
export function employeeOf(p: PayslipRecord): UserProfile | null {
  return getUser(p.username);
}

/** Active employees available for the upload dropdown. */
export function getActiveEmployeesForPayslip(): {
  username: string;
  profile: UserProfile;
}[] {
  return getUserIndex()
    .map((u) => ({ username: u, profile: getUser(u) }))
    .filter(
      (e): e is { username: string; profile: UserProfile } =>
        !!e.profile && isAccountActive(e.profile),
    )
    .sort((a, b) => a.profile.fullName.localeCompare(b.profile.fullName));
}

/** Trigger a browser download of a payslip file. */
export function downloadPayslip(p: PayslipRecord): void {
  const a = document.createElement("a");
  a.href = p.file.dataUrl;
  a.download = p.file.name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
