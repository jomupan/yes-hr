import type {
  AttendanceData,
  AttendanceRecord,
  ClaimData,
  DopeData,
  EvalData,
  LeaveData,
  LeaveStatus,
  LeaveType,
  UserProfile,
} from "./hr-types";
import {
  daysBetween,
  fmtDate,
  getAttendance,
  getClaim,
  getDope,
  getEval,
  getJSON,
  getLeave,
  getUser,
  getUserIndex,
  setJSON,
} from "./hr-store";
import { isAccountActive } from "./account-status";
import { getDepartmentById } from "./departments";
import { getCompanyById } from "./companies";
import { notifyLeaveApproved, notifyLeaveRejected } from "./notification-store";

/* A full employee record aggregating every per-user dataset for admin views. */
export interface AdminEmployee {
  username: string;
  profile: UserProfile;
  dope: DopeData;
  attendance: AttendanceData;
  leave: LeaveData;
  claim: ClaimData;
  evaluation: EvalData;
}

const LEAVE_KEY = (u: string) => `hr:leave:${u}`;
const USER_KEY = (u: string) => `hr:user:${u}`;

export function getAdminEmployees(): AdminEmployee[] {
  return getUserIndex().map((u) => {
    const profile = getUser(u) || {
      username: u,
      fullName: u,
      role: "Staff",
      joinedAt: "",
    };
    return {
      username: u,
      profile,
      dope: getDope(u),
      attendance: getAttendance(u),
      leave: getLeave(u),
      claim: getClaim(u),
      evaluation: getEval(u),
    };
  });
}

/* Derive a sensible department from a role when none is stored. */
export function deriveDepartment(role: string): string {
  const r = (role || "").toLowerCase();
  if (r.includes("market")) return "Marketing";
  if (r.includes("execut")) return "Executive";
  if (r.includes("it") || r.includes("developer") || r.includes("engineer"))
    return "IT";
  if (r.includes("finance") || r.includes("account")) return "Finance";
  if (r.includes("hr") || r.includes("human")) return "Human Resources";
  if (r.includes("sales")) return "Sales";
  if (r.includes("admin")) return "Administration";
  if (r.includes("ops") || r.includes("operation")) return "Operations";
  return "Operations";
}

/* Resolve a profile's department from the canonical departments store first
   (departmentId), then fall back to a stored label, then derive from role.
   This keeps the Admin Employee List, Attendance, Leave, Claims, Evaluation
   and Reports all reading from the same source of truth. */
export function departmentOf(profile: UserProfile): string {
  if (profile.departmentId) {
    const dept = getDepartmentById(profile.departmentId);
    if (dept) return dept.name;
  }
  return profile.department?.trim() || deriveDepartment(profile.role);
}

export function emailOf(profile: UserProfile): string {
  if (profile.email?.trim()) return profile.email;
  return `${profile.username}@yesempire.com`;
}

export function employeeIdOf(profile: UserProfile): string {
  if (profile.employeeId?.trim()) return profile.employeeId;
  return (
    "YES-" +
    profile.username
      .replace(/[^a-z0-9]/gi, "")
      .slice(0, 4)
      .toUpperCase()
      .padStart(4, "0") +
    "-" +
    Math.abs(hashCode(profile.username)).toString().slice(0, 3)
  );
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++)
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

/* A flattened leave application enriched with the owning employee. */
export interface AdminLeaveRow {
  appId: string;
  username: string;
  fullName: string;
  department: string;
  type: LeaveType;
  from: string;
  to: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  appliedAt: string;
  attachment?: import("./hr-types").LeaveAttachment | null;
  rejectionReason?: string;
}

export function getAllLeaveApplications(): AdminLeaveRow[] {
  const rows: AdminLeaveRow[] = [];
  getAdminEmployees().forEach((e) => {
    e.leave.applications.forEach((a) => {
      rows.push({
        appId: a.id,
        username: e.username,
        fullName: e.profile.fullName,
        department: departmentOf(e.profile),
        type: a.type,
        from: a.from,
        to: a.to,
        days: daysBetween(a.from, a.to) + 1,
        reason: a.reason,
        status: a.status,
        appliedAt: a.appliedAt,
        attachment: a.attachment ?? null,
        rejectionReason: a.rejectionReason,
      });
    });
  });
  return rows.sort(
    (a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime(),
  );
}

/* Update a single application's status and adjust the leave balance accordingly.
   When rejecting, an optional reason is stored and surfaced to the staff member
   via a notification. Staff never see internal admin-only notes — only the
   explicit rejection reason provided here. */
export function setLeaveStatus(
  username: string,
  appId: string,
  status: LeaveStatus,
  rejectionReason?: string,
): void {
  const leave: LeaveData = getJSON<LeaveData>(LEAVE_KEY(username), {
    balance: { Annual: 14, Medical: 14, Emergency: 3 },
    applications: [],
  });
  const app = leave.applications.find((a) => a.id === appId);
  if (!app) return;
  const prevStatus = app.status;
  const wasApproved = prevStatus === "Approved";
  const days = daysBetween(app.from, app.to) + 1;
  app.status = status;
  if (status === "Rejected" && rejectionReason?.trim()) {
    app.rejectionReason = rejectionReason.trim();
  }
  if (status === "Approved" && !wasApproved) {
    leave.balance[app.type] = Math.max(0, leave.balance[app.type] - days);
  } else if (status !== "Approved" && wasApproved) {
    leave.balance[app.type] = leave.balance[app.type] + days;
  }
  setJSON(LEAVE_KEY(username), leave);

  // Only notify when the status actually changes.
  if (prevStatus === status) return;
  const fromFmt = fmtDate(app.from);
  const toFmt = fmtDate(app.to);
  if (status === "Approved") {
    notifyLeaveApproved(username, app.type, fromFmt, toFmt, app.id);
  } else if (status === "Rejected") {
    notifyLeaveRejected(
      username,
      app.type,
      fromFmt,
      toFmt,
      app.id,
      rejectionReason,
    );
  }
}

export function setEmployeeProfile(
  username: string,
  profile: UserProfile,
): void {
  setJSON<UserProfile>(USER_KEY(username), profile);
}

/* Is the given ISO date within [from, to] inclusive? */
export function isOnLeaveOn(from: string, to: string, iso: string): boolean {
  return new Date(iso) >= new Date(from) && new Date(iso) <= new Date(to);
}

/* ---------- Admin Attendance ----------
   Reads the SAME per-user attendance records written by the Staff
   Attendance module (hr:attendance:{username}). Never duplicates the
   underlying data source. */

export type AttendanceStatus =
  "Present" | "Late" | "Completed" | "Currently Working" | "Not Clocked In";

/* A single attendance row enriched with the owning employee. */
export interface AdminAttendanceRow {
  username: string;
  fullName: string;
  employeeId: string;
  department: string;
  company: string;
  record: AttendanceRecord;
  status: AttendanceStatus;
  hours: number | null; // null while still clocked in
}

/* Resolve a profile's company from the canonical companies store first
   (companyId), then fall back to a stored label, then default to the parent
   company. This keeps the Admin Employee List, Attendance, Leave, Claims,
   Evaluation and Reports all reading from the same source of truth. */
export function companyOf(profile: UserProfile): string {
  if (profile.companyId) {
    const co = getCompanyById(profile.companyId);
    if (co) return co.name;
  }
  return profile.company?.trim() || "YES EMPIRE Group";
}

const LATE_AFTER_MINUTES = 8 * 60 + 30; // 8:30 is on time; 8:31 or later = Late

/* Compute attendance status for a single record on a given date. */
export function attendanceStatusOf(
  record: AttendanceRecord | undefined,
  dateISO: string,
): AttendanceStatus {
  const isToday = dateISO === todayISO();
  if (!record) {
    return isToday ? "Not Clocked In" : "Not Clocked In";
  }
  if (!record.clockOut) {
    return "Currently Working";
  }
  // Completed shift — Late if clock-in was after the threshold.
  const ci = new Date(record.clockIn);
  return ci.getHours() * 60 + ci.getMinutes() > LATE_AFTER_MINUTES ? "Late" : "Present";
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Build attendance rows for a given date. Active employees with no record on
 * that date show up as "Not Clocked In"; inactive employees are excluded
 * from current-date totals but their historical records are still returned
 * when viewing past dates (filtered by the caller as needed).
 */
export function getAttendanceForDate(dateISO: string): AdminAttendanceRow[] {
  const rows: AdminAttendanceRow[] = [];
  getAdminEmployees().forEach((e) => {
    const active = isAccountActive(e.profile);
    const record = e.attendance.records.find((r) => r.date === dateISO);
    // For today's view: only active employees without a record count as
    // "Not Clocked In". Inactive employees are skipped for current dates.
    if (!record && !active && dateISO === todayISO()) return;
    if (!record && !active) return;
    const status = attendanceStatusOf(record, dateISO);
    const hours = record?.clockOut
      ? Math.max(
          0,
          (new Date(record.clockOut).getTime() -
            new Date(record.clockIn).getTime()) /
            3600000,
        )
      : null;
    rows.push({
      username: e.username,
      fullName: e.profile.fullName,
      employeeId: employeeIdOf(e.profile),
      department: departmentOf(e.profile),
      company: companyOf(e.profile),
      record: record || {
        date: dateISO,
        clockIn: "",
        clockOut: null,
        location: "",
        clockOutLocation: "",
        selfie: "",
        clockInSelfie: "",
        clockOutSelfie: "",
      },
      status,
      hours,
    });
  });
  return rows;
}

/* Summary stats for a given date, counting active employees only. */
export interface AttendanceSummary {
  totalActive: number;
  present: number;
  late: number;
  notClockedIn: number;
  clockedOut: number;
  currentlyWorking: number;
}

export function getAttendanceSummary(dateISO: string): AttendanceSummary {
  const rows = getAttendanceForDate(dateISO);
  const totalActive = getAdminEmployees().filter((e) =>
    isAccountActive(e.profile),
  ).length;
  return {
    totalActive,
    present: rows.filter((r) => r.status === "Present").length,
    late: rows.filter((r) => r.status === "Late").length,
    notClockedIn: rows.filter((r) => r.status === "Not Clocked In").length,
    clockedOut: rows
      .filter(
        (r) =>
          r.status === "Completed" ||
          r.status === "Present" ||
          r.status === "Late",
      )
      .filter((r) => r.record.clockOut).length,
    currentlyWorking: rows.filter((r) => r.status === "Currently Working")
      .length,
  };
}

/* All historical attendance records across every employee (incl. inactive). */
export function getAllAttendanceRecords(): AdminAttendanceRow[] {
  const rows: AdminAttendanceRow[] = [];
  getAdminEmployees().forEach((e) => {
    e.attendance.records.forEach((record) => {
      const status = attendanceStatusOf(record, record.date);
      const hours = record.clockOut
        ? Math.max(
            0,
            (new Date(record.clockOut).getTime() -
              new Date(record.clockIn).getTime()) /
              3600000,
          )
        : null;
      rows.push({
        username: e.username,
        fullName: e.profile.fullName,
        employeeId: employeeIdOf(e.profile),
        department: departmentOf(e.profile),
        company: companyOf(e.profile),
        record,
        status,
        hours,
      });
    });
  });
  return rows.sort(
    (a, b) =>
      new Date(b.record.date).getTime() - new Date(a.record.date).getTime(),
  );
}

/* Attendance history for a single employee (by username). */
export function getEmployeeAttendance(username: string): AdminAttendanceRow[] {
  const profile = getUser(username);
  if (!profile) return [];
  const data = getAttendance(username);
  return data.records
    .map((record) => {
      const status = attendanceStatusOf(record, record.date);
      const hours = record.clockOut
        ? Math.max(
            0,
            (new Date(record.clockOut).getTime() -
              new Date(record.clockIn).getTime()) /
              3600000,
          )
        : null;
      return {
        username,
        fullName: profile.fullName,
        employeeId: employeeIdOf(profile),
        department: departmentOf(profile),
        company: companyOf(profile),
        record,
        status,
        hours,
      };
    })
    .sort(
      (a, b) =>
        new Date(b.record.date).getTime() - new Date(a.record.date).getTime(),
    );
}
