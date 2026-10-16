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
import { API_BASE, ApiError, api, fileUrl, getToken } from "./api";

/* Payslips now live on the server. The browser keeps a copy under
   `hr:payslips` (server download path in file.url, never the login token);
   dataUrl is filled in with an authenticated link each time it is read.
   The original notes below describe the record shape, which is unchanged. */

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
  /** Link used to show & download the file (authenticated server URL). */
  dataUrl: string;
  /** Server download path, as stored in the browser copy. */
  url?: string;
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
  return getJSON<PayslipRecord[]>(PAYSLIPS_KEY, []).map((p) =>
    p.file?.url ? { ...p, file: { ...p.file, dataUrl: fileUrl(`${p.file.url}?inline=1`) } } : p,
  );
}

/* ---------- server sync ---------- */

/** Admin: copy every payslip (active + removed) from the server. */
export async function syncAdminPayslips(): Promise<void> {
  const res = await api<{ payslips: PayslipRecord[] }>("/admin/payslips?status=all");
  setJSON(PAYSLIPS_KEY, res.payslips);
}

/** Staff: copy the logged-in employee's own payslips from the server. */
export async function syncMyPayslips(): Promise<void> {
  const res = await api<{ payslips: PayslipRecord[] }>("/me/payslips");
  setJSON(PAYSLIPS_KEY, res.payslips);
}

/** Multipart upload with the same error handling as api(). */
async function sendForm<T>(method: "POST" | "PUT", path: string, form: FormData): Promise<T> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    });
  } catch {
    throw new ApiError("Can't reach the server. Please check your connection and try again.", 0, "OFFLINE");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) throw new ApiError(data.error || "Something went wrong.", res.status, data.code);
  return data as T;
}

const errText = (e: unknown, fallback: string) => (e instanceof Error && e.message) || fallback;

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
  _uploadedBy: string,
): Promise<PayslipSaveResult> {
  void _uploadedBy; // the server records who is logged in
  if (!username) return { ok: false, error: "Please select an employee." };
  if (!month || !year)
    return { ok: false, error: "Please select a month and year." };
  const fv = validatePayslipFile(file);
  if (!fv.ok) return { ok: false, error: fv.error };
  const form = new FormData();
  form.append("username", username);
  form.append("month", String(month));
  form.append("year", String(year));
  if (note.trim()) form.append("note", note.trim());
  form.append("file", file, sanitizeFileName(file.name));
  try {
    // The server notifies only the owning employee.
    const res = await sendForm<{ payslip: PayslipRecord }>("POST", "/admin/payslips", form);
    await syncAdminPayslips().catch(() => undefined);
    return { ok: true, payslip: res.payslip };
  } catch (e) {
    return { ok: false, error: errText(e, "Unable to upload payslip.") };
  }
}

/** Replace an existing payslip's file (keeps the same record id). */
export async function replacePayslipFile(
  id: string,
  file: File,
): Promise<PayslipSaveResult> {
  const fv = validatePayslipFile(file);
  if (!fv.ok) return { ok: false, error: fv.error };
  const form = new FormData();
  form.append("file", file, sanitizeFileName(file.name));
  try {
    const res = await sendForm<{ payslip: PayslipRecord }>("PUT", `/admin/payslips/${encodeURIComponent(id)}/file`, form);
    await syncAdminPayslips().catch(() => undefined);
    return { ok: true, payslip: res.payslip };
  } catch (e) {
    return { ok: false, error: errText(e, "Unable to replace payslip.") };
  }
}

/** Soft-remove a payslip (status -> removed). Staff can no longer see it. */
export async function removePayslip(id: string): Promise<PayslipSaveResult> {
  try {
    await api(`/admin/payslips/${encodeURIComponent(id)}`, { method: "DELETE" });
    await syncAdminPayslips().catch(() => undefined);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: errText(e, "Unable to remove payslip.") };
  }
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
