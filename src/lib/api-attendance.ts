/* Attendance through the backend, so a clock-in on a staff phone is visible
 * to admins on any device. Selfies are stored on the server; the records
 * carry authenticated URLs (fileUrl adds the login token so <img> works). */

import type { AttendanceRecord, UserProfile } from "./hr-types";
import type { AdminAttendanceRow, AttendanceStatus, AttendanceSummary } from "./admin-store";
import { api, fileUrl } from "./api";
import { setJSON } from "./hr-store";

/** Attendance record as the backend sends it. */
interface ApiAttendanceRecord {
  id: string;
  date: string;
  clockIn: string;
  clockOut: string | null;
  location: string;
  clockOutLocation: string;
  selfie: string;
  clockInSelfie: string;
  clockOutSelfie: string;
  late: boolean;
  hours: number | null;
  clockOutByAdmin?: string;
}

interface ApiAdminRow {
  username: string;
  fullName: string;
  employeeId: string;
  department: string;
  company: string;
  status: AttendanceStatus;
  record: ApiAttendanceRecord | null;
  hours: number | null;
}

function toRecord(r: ApiAttendanceRecord): AttendanceRecord {
  return {
    id: r.id,
    date: r.date,
    clockOutByAdmin: r.clockOutByAdmin,
    clockIn: r.clockIn,
    clockOut: r.clockOut,
    location: r.location,
    clockOutLocation: r.clockOutLocation,
    // Old code fell back to `selfie` when it held an image; keep it a label.
    selfie: r.clockInSelfie ? "Selfie captured" : "",
    clockInSelfie: fileUrl(r.clockInSelfie),
    clockOutSelfie: fileUrl(r.clockOutSelfie),
  };
}

function emptyRecord(date: string): AttendanceRecord {
  return {
    date,
    clockIn: "",
    clockOut: null,
    location: "",
    clockOutLocation: "",
    selfie: "",
    clockInSelfie: "",
    clockOutSelfie: "",
  };
}

function toAdminRow(r: ApiAdminRow, date: string): AdminAttendanceRow {
  return {
    username: r.username,
    fullName: r.fullName,
    employeeId: r.employeeId,
    department: r.department,
    company: r.company,
    record: r.record ? toRecord(r.record) : emptyRecord(date),
    status: r.status,
    hours: r.hours,
  };
}

/* ---------- staff ---------- */

/** The logged-in user's records, newest first. */
export async function fetchMyAttendance(): Promise<AttendanceRecord[]> {
  const res = await api<{ records: ApiAttendanceRecord[] }>("/me/attendance");
  return res.records.map(toRecord);
}

/** Copy the server's records into the browser store the staff screens read. */
export async function syncMyAttendance(username: string): Promise<AttendanceRecord[]> {
  const records = await fetchMyAttendance();
  setJSON(`hr:attendance:${username}`, { records });
  return records;
}

export function clockIn(location: string, selfie: string) {
  return api("/me/attendance/clock-in", { body: { location, selfie } });
}

export function clockOut(location: string, selfie: string) {
  return api("/me/attendance/clock-out", { body: { location, selfie } });
}

/* ---------- admin ---------- */

export async function fetchAttendanceForDate(
  date: string,
): Promise<{ rows: AdminAttendanceRow[]; summary: AttendanceSummary }> {
  const res = await api<{ rows: ApiAdminRow[]; summary: AttendanceSummary }>(
    `/admin/attendance?date=${encodeURIComponent(date)}`,
  );
  return { rows: res.rows.map((r) => toAdminRow(r, date)), summary: res.summary };
}

export async function fetchEmployeeAttendance(username: string): Promise<{
  profile: UserProfile;
  rows: AdminAttendanceRow[];
}> {
  const res = await api<{
    profile: UserProfile;
    rows: { status: AttendanceStatus; record: ApiAttendanceRecord }[];
  }>(`/admin/attendance/employee/${encodeURIComponent(username)}`);
  const p = res.profile;
  return {
    profile: p,
    rows: res.rows.map((r) => ({
      username: p.username,
      fullName: p.fullName,
      employeeId: p.employeeId || "",
      department: p.department || "",
      company: p.company || "",
      record: toRecord(r.record),
      status: r.status,
      hours: r.record.hours,
    })),
  };
}

/** Admin: fill in (or correct) the clock-out time, e.g. "17:30", for a
 *  staff member who forgot to clock out. */
export async function setClockOutTime(id: string, time: string): Promise<void> {
  await api(`/admin/attendance/${encodeURIComponent(id)}/clock-out`, { method: "PATCH", body: { time } });
}
