/* Leave, claims, personality test and evaluations through the backend.
 *
 * Staff screens send their changes to the server, then copy the server's
 * records into the browser store they already read, so the rest of the UI
 * keeps working unchanged. Admin leave screens share one server-backed list
 * (useAdminLeaveApps) so an approval updates every admin screen at once. */

import { useEffect, useSyncExternalStore } from "react";
import type {
  ClaimRecord,
  ClaimType,
  DopeAnswer,
  DopeResult,
  EvaluationRecord,
  LeaveApplication,
  LeaveAttachment,
  LeaveData,
  LeaveStatus,
  LeaveType,
} from "./hr-types";
import type { AdminLeaveRow } from "./admin-store";
import { API_BASE, ApiError, api, authHeaders, fileUrl, handleAccountSwitched } from "./api";
import { setJSON } from "./hr-store";

/* ---------- shapes the server sends ---------- */

interface ApiAttachment {
  name: string;
  type: string;
  size: number;
  url: string;
}

interface ApiLeave {
  id: string;
  type: LeaveType;
  from: string;
  to: string;
  days: number;
  reason: string;
  status: LeaveStatus;
  appliedAt: string;
  attachment: ApiAttachment | null;
  rejectionReason?: string;
  replacementId?: string;
  typeLabel?: string;
}

function toAttachment(a: ApiAttachment | null): LeaveAttachment | null {
  // dataUrl doubles as the download link (authenticated server URL).
  return a ? { name: a.name, type: a.type, size: a.size, dataUrl: fileUrl(a.url) } : null;
}

function toLeave(r: ApiLeave): LeaveApplication {
  return {
    id: r.id,
    type: r.type,
    from: r.from,
    to: r.to,
    reason: r.reason,
    status: r.status,
    appliedAt: r.appliedAt,
    attachment: toAttachment(r.attachment),
    rejectionReason: r.rejectionReason,
    replacementId: r.replacementId,
    typeLabel: r.typeLabel,
  };
}

/** A data: URL (from the file picker) as a Blob, for uploading. Done by hand
 *  because the site's security policy blocks fetch() on data: URLs. */
function dataUrlToBlob(dataUrl: string, fallbackType: string): Blob {
  const [head, b64 = ""] = dataUrl.split(",", 2);
  const type = /^data:([^;]+)/.exec(head)?.[1] || fallbackType;
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

/** Multipart POST (file uploads). Same error handling as api(). */
async function postForm<T>(path: string, form: FormData): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: authHeaders(),
      body: form,
    });
  } catch {
    throw new ApiError("Can't reach the server. Please check your connection and try again.", 0, "OFFLINE");
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.ok === false) handleAccountSwitched(data.code);
  if (!res.ok || data.ok === false) throw new ApiError(data.error || "Something went wrong.", res.status, data.code);
  return data as T;
}

/* ---------- staff: leave ---------- */

export async function fetchMyLeave(): Promise<LeaveData> {
  const res = await api<{
    balance: LeaveData["balance"];
    replacement?: LeaveData["replacement"];
    applications: ApiLeave[];
  }>("/me/leave");
  return { balance: res.balance, replacement: res.replacement || [], applications: res.applications.map(toLeave) };
}

export function applyLeave(input: {
  type: LeaveType | "Replacement";
  /** Which replacement leave to use (only when type is "Replacement"). */
  replacementId?: string;
  from: string;
  to: string;
  reason: string;
  attachment: LeaveAttachment | null;
}) {
  const form = new FormData();
  form.append("type", input.type);
  if (input.replacementId) form.append("replacementId", input.replacementId);
  form.append("from", input.from);
  form.append("to", input.to);
  form.append("reason", input.reason);
  if (input.attachment) {
    form.append("attachment", dataUrlToBlob(input.attachment.dataUrl, input.attachment.type), input.attachment.name);
  }
  return postForm("/me/leave", form);
}

/* ---------- staff: claims ---------- */

export async function fetchMyClaims(): Promise<ClaimRecord[]> {
  const res = await api<{ claims: ClaimRecord[] }>("/me/claims");
  return res.claims;
}

export function submitClaim(input: { type: ClaimType; amount: number; date: string; desc: string }) {
  return api("/me/claims", { body: input });
}

/* ---------- staff: personality test ---------- */

export async function fetchMyDope(): Promise<DopeResult[]> {
  const res = await api<{ history: DopeResult[] }>("/me/dope");
  return res.history;
}

/** The server scores the test itself, so results can't be faked. */
export async function submitDope(answers: DopeAnswer[]): Promise<DopeResult> {
  const res = await api<{ result: DopeResult }>("/me/dope", { body: { answers, declarationsAccepted: true } });
  return res.result;
}

/* ---------- staff: evaluations ---------- */

export async function fetchMyEvaluations(): Promise<EvaluationRecord[]> {
  const res = await api<{ evaluations: EvaluationRecord[] }>("/me/evaluations");
  return res.evaluations;
}

/** Copy the server's leave, claims, test results and evaluations into the
 *  browser store the staff screens read. Each part is independent, so one
 *  failing doesn't block the others. */
export async function syncMyHrRecords(username: string): Promise<void> {
  await Promise.all([
    fetchMyLeave().then((d) => setJSON(`hr:leave:${username}`, d)),
    fetchMyClaims().then((claims) => setJSON(`hr:claim:${username}`, { claims })),
    fetchMyDope().then((history) => setJSON(`hr:dopetest:${username}`, { history })),
    fetchMyEvaluations().then((evaluations) => setJSON(`hr:evaluation:${username}`, { evaluations })),
  ].map((p) => p.catch(() => undefined)));
}

/* ---------- admin: shared leave list ---------- */

interface ApiAdminLeave extends ApiLeave {
  appId: string;
  username: string;
  fullName: string;
  department: string;
}

let adminLeave: AdminLeaveRow[] = [];
let adminLeaveLoaded = false;
let adminLeaveLoading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Fetch all leave applications from the server and update every screen. */
export function reloadAdminLeave(): Promise<void> {
  if (adminLeaveLoading) return adminLeaveLoading;
  adminLeaveLoading = api<{ applications: ApiAdminLeave[] }>("/admin/leave")
    .then((res) => {
      adminLeave = res.applications.map((r) => ({
        ...toLeave(r),
        // Admin screens show the type as text; use the replacement leave's
        // name (e.g. "Replacement Leave SUKMA") instead of just "Replacement".
        type: (r.typeLabel || r.type) as LeaveType,
        appId: r.appId,
        username: r.username,
        fullName: r.fullName,
        department: r.department,
        days: r.days,
      }));
      adminLeaveLoaded = true;
      emit();
    })
    .catch(() => undefined)
    .finally(() => {
      adminLeaveLoading = null;
    });
  return adminLeaveLoading;
}

/** All leave applications (newest first) for admin screens. Loads on first
 *  use and re-checks every minute while a screen is open. */
export function useAdminLeaveApps(): AdminLeaveRow[] {
  const apps = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => adminLeave,
  );
  useEffect(() => {
    if (!adminLeaveLoaded) void reloadAdminLeave();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void reloadAdminLeave();
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);
  return apps;
}

/** Approve / reject on the server, then refresh every admin screen. */
export async function setLeaveStatusOnServer(
  appId: string,
  status: LeaveStatus,
  rejectionReason?: string,
): Promise<void> {
  await api(`/admin/leave/${encodeURIComponent(appId)}/status`, {
    method: "PATCH",
    body: { status, rejectionReason },
  });
  await reloadAdminLeave();
}

/** Same check the admin screens used before (inclusive date range). */
export function isOnLeave(from: string, to: string, iso: string): boolean {
  return iso >= from && iso <= to;
}

/* ---------- admin: shared claims list ---------- */

export interface AdminClaimRow extends ClaimRecord {
  username: string;
  fullName: string;
  department: string;
  createdAt?: string;
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

let adminClaims: AdminClaimRow[] = [];
let adminClaimsLoaded = false;
let adminClaimsLoading: Promise<void> | null = null;
const claimListeners = new Set<() => void>();

export function reloadAdminClaims(): Promise<void> {
  if (adminClaimsLoading) return adminClaimsLoading;
  adminClaimsLoading = api<{ claims: AdminClaimRow[] }>("/admin/claims")
    .then((res) => {
      adminClaims = res.claims;
      adminClaimsLoaded = true;
      claimListeners.forEach((l) => l());
    })
    .catch(() => undefined)
    .finally(() => {
      adminClaimsLoading = null;
    });
  return adminClaimsLoading;
}

/** All claims (newest first) for admin screens; shared like the leave list. */
export function useAdminClaims(): AdminClaimRow[] {
  const claims = useSyncExternalStore(
    (cb) => {
      claimListeners.add(cb);
      return () => claimListeners.delete(cb);
    },
    () => adminClaims,
  );
  useEffect(() => {
    if (!adminClaimsLoaded) void reloadAdminClaims();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void reloadAdminClaims();
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);
  return claims;
}

/** Approve / reject a claim; the staff member is notified on their device. */
export async function setClaimStatusOnServer(
  id: string,
  status: "Pending" | "Approved" | "Rejected",
  rejectionReason?: string,
): Promise<void> {
  await api(`/admin/claims/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    body: { status, rejectionReason },
  });
  await reloadAdminClaims();
}

/** Current copies of the shared admin lists (no fetch). */
export const adminLeaveSnapshot = (): AdminLeaveRow[] => adminLeave;
export const adminClaimsSnapshot = (): AdminClaimRow[] => adminClaims;
