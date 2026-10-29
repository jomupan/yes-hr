import { db } from "../db/knex";
import { dopeStatus, DopeResultDto, DopeStatus } from "../lib/dope";
import { notify } from "./notifications";
import { hoursBetween, isLateClockIn, todayISO } from "../lib/time";
import { toProfile, UserRow } from "./users";

/* Row → DTO mappers. Every DTO matches the frontend types in
   src/lib/hr-types.ts so the UI can consume API responses unchanged.
   Files are exposed as authenticated URLs instead of base64 data URLs. */

const API = "/api";

export function dopeDto(r: any): DopeResultDto {
  return {
    id: r.id,
    date: r.date,
    status: "Pass",
    answers: JSON.parse(r.answers),
    scores: JSON.parse(r.scores),
    personalityType: r.personality_type,
    summary: r.summary,
  };
}

export type AttendanceStatus = "Present" | "Late" | "Currently Working" | "Missed Clock-Out" | "Not Clocked In";

export function attendanceStatusOf(r: any | undefined): AttendanceStatus {
  if (!r) return "Not Clocked In";
  // No clock-out on an earlier day = they forgot (HR can fill it in).
  if (!r.clock_out) return r.date < todayISO() ? "Missed Clock-Out" : "Currently Working";
  return isLateClockIn(r.clock_in) ? "Late" : "Present";
}

export function attendanceDto(r: any, scope: "me" | "admin") {
  const base = scope === "me" ? `${API}/me/attendance` : `${API}/admin/attendance`;
  return {
    id: r.id,
    date: r.date,
    clockIn: r.clock_in,
    clockOut: r.clock_out ?? null,
    clockOutByAdmin: r.clock_out_by ?? undefined,
    location: r.location,
    clockOutLocation: r.clock_out_location,
    selfie: r.clock_in_selfie ? "Selfie captured" : "",
    clockInSelfie: r.clock_in_selfie ? `${base}/${r.id}/selfie/in` : "",
    clockOutSelfie: r.clock_out_selfie ? `${base}/${r.id}/selfie/out` : "",
    late: isLateClockIn(r.clock_in),
    hours: hoursBetween(r.clock_in, r.clock_out),
  };
}

export function leaveDto(r: any, scope: "me" | "admin") {
  const base = scope === "me" ? `${API}/me/leave` : `${API}/admin/leave`;
  return {
    id: r.id,
    type: r.type,
    typeLabel: r.type_label ?? undefined,
    replacementId: r.replacement_id ?? undefined,
    from: r.date_from,
    to: r.date_to,
    days: r.days,
    reason: r.reason,
    status: r.status,
    appliedAt: r.applied_at,
    attachment: r.attachment_path
      ? { name: r.attachment_name, type: r.attachment_type, size: r.attachment_size, url: `${base}/${r.id}/attachment` }
      : null,
    rejectionReason: r.rejection_reason ?? undefined,
    reviewedBy: r.reviewed_by ?? undefined,
    reviewedAt: r.reviewed_at ?? undefined,
  };
}

export function claimDto(r: any) {
  return {
    id: r.id,
    type: r.type,
    amount: Number(r.amount),
    date: r.date,
    desc: r.description,
    status: r.status,
    createdAt: r.created_at,
    rejectionReason: r.rejection_reason ?? undefined,
  };
}

export function evaluationDto(r: any) {
  return {
    id: r.id,
    period: r.period,
    overall: r.overall,
    categories: JSON.parse(r.categories),
    comments: r.comments,
    createdAt: r.created_at,
  };
}

export function payslipDto(r: any, username: string, scope: "me" | "admin") {
  const base = scope === "me" ? `${API}/me/payslips` : `${API}/admin/payslips`;
  return {
    id: r.id,
    username,
    month: r.month,
    year: r.year,
    file: { name: r.file_name, type: r.file_type, size: r.file_size, url: `${base}/${r.id}/file` },
    note: r.note ?? undefined,
    status: r.status,
    uploadedBy: r.uploaded_by,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** A staff member's replacement leave entries with days left. */
export async function replacementBalances(userId: string) {
  const rows = await db("replacement_grants as g")
    .join("replacement_leaves as r", "r.id", "g.replacement_id")
    .where("g.user_id", userId)
    .select("r.id", "r.name", "r.days", "r.expires_on", "g.balance")
    .orderBy("r.created_at", "asc");
  const today = todayISO();
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    days: Number(r.days),
    balance: Number(r.balance),
    expiresOn: r.expires_on ?? null,
    expired: !!r.expires_on && r.expires_on < today,
  }));
}

export function leaveBalance(u: UserRow) {
  return { Annual: u.leave_annual, Medical: u.leave_medical, Emergency: u.leave_emergency };
}

/** Create the "test required" / "expiring soon" notification once per state,
 *  same as the staff Dashboard does on the frontend. A reminder is only sent
 *  if no dopetest notification exists since the last completed test, so the
 *  user gets one nudge per cycle instead of one per page load. */
export async function ensureDopeReminder(user: UserRow, status: DopeStatus): Promise<void> {
  if (status.state !== "first_time" && status.state !== "reminder") return;
  const q = db("notifications").where({ user_id: user.id, category: "dopetest" });
  if (status.state === "reminder") q.andWhere("created_at", ">=", `${status.last.date}T00:00:00.000Z`);
  if (await q.first()) return;
  if (status.state === "first_time") await notify.dopeRequired(user.id);
  else await notify.dopeExpiring(user.id, status.daysLeft);
}

/** Everything the staff portal needs in one call (mirrors HrSession). */
export async function buildSessionBundle(user: UserRow) {
  const [profile, dopeRows, attRows, leaveRows, claimRows, evalRows] = await Promise.all([
    toProfile(user),
    db("dope_results").where({ user_id: user.id }).orderBy("date", "asc"),
    db("attendance").where({ user_id: user.id }).orderBy("date", "asc"),
    db("leave_applications").where({ user_id: user.id }).orderBy("applied_at", "asc"),
    db("claims").where({ user_id: user.id }).orderBy("created_at", "asc"),
    db("evaluations").where({ user_id: user.id }).orderBy("created_at", "asc"),
  ]);
  const history = dopeRows.map(dopeDto);
  const status = dopeStatus(history);
  await ensureDopeReminder(user, status);
  return {
    username: user.username,
    profile,
    dope: { history },
    attendance: { records: attRows.map((r) => attendanceDto(r, "me")) },
    leave: {
      balance: leaveBalance(user),
      replacement: await replacementBalances(user.id),
      applications: leaveRows.map((r) => leaveDto(r, "me")),
    },
    claim: { claims: claimRows.map(claimDto) },
    evaluation: { evaluations: evalRows.map(evaluationDto) },
    status,
    isAdmin: user.auth_role === "admin",
    authRole: user.auth_role,
  };
}
