/* Admin directory (employees, companies, departments, payslips) through the
 * backend.
 *
 * The admin screens were built to read from the browser store (hr:index,
 * hr:user:*, hr:companies, …). Rather than rewrite every screen, this module
 * copies the server's records into those same keys and tells the screens to
 * re-read. Changes (deactivate, add company, upload payslip, …) are sent to
 * the server first, then the copy is refreshed, so the server stays the
 * single source of truth and every admin sees the same data. */

import { useEffect, useSyncExternalStore } from "react";
import type { DopeResult, LeaveApplication, UserProfile } from "./hr-types";
import { api, ApiError } from "./api";
import { getUserIndex, removeKey, setJSON, setUserIndex } from "./hr-store";
import { reloadAdminClaims, reloadAdminLeave, adminClaimsSnapshot, adminLeaveSnapshot } from "./api-hr";
import type { Company, CompanyType } from "./companies";
import type { Department } from "./departments";

export interface ActionResult {
  ok: boolean;
  error?: string;
}

interface ApiEmployee {
  username: string;
  profile: UserProfile;
  leaveBalance: { Annual: number; Medical: number; Emergency: number };
  dope: { history: DopeResult[] };
}

/* ---------- change notification ---------- */

let version = 0;
let loaded = false;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();
const bump = () => {
  version++;
  listeners.forEach((l) => l());
};

/** Copy employees, companies, departments, leave and claims from the
 *  server into the browser store the admin screens read. */
export function syncAdminDirectory(): Promise<void> {
  if (loading) return loading;
  loading = (async () => {
    const [emp, cos, depts] = await Promise.all([
      api<{ employees: ApiEmployee[] }>("/admin/employees"),
      api<{ companies: Company[] }>("/admin/companies"),
      api<{ departments: Department[] }>("/admin/departments"),
      reloadAdminLeave(),
      reloadAdminClaims(),
    ]);

    setJSON("hr:companies", cos.companies.map(stripCounts));
    setJSON("hr:departments", depts.departments.map(stripCounts));
    // Stop the old browser-only seeding from adding its own copies back.
    setJSON("hr:companies-seeded", true);
    setJSON("hr:departments-seeded", true);
    setJSON("hr:departments-company-migrated", true);

    const leaveBy = new Map<string, LeaveApplication[]>();
    for (const r of adminLeaveSnapshot()) {
      const app: LeaveApplication = {
        id: r.appId,
        type: r.type,
        from: r.from,
        to: r.to,
        reason: r.reason,
        status: r.status,
        appliedAt: r.appliedAt,
        attachment: r.attachment,
        rejectionReason: r.rejectionReason,
      };
      leaveBy.set(r.username, [...(leaveBy.get(r.username) || []), app]);
    }
    const claimsBy = new Map<string, ReturnType<typeof adminClaimsSnapshot>>();
    for (const c of adminClaimsSnapshot()) claimsBy.set(c.username, [...(claimsBy.get(c.username) || []), c]);

    const usernames = emp.employees.map((e) => e.username);
    // Forget people who no longer exist on the server (old browser-only data).
    for (const u of getUserIndex()) if (!usernames.includes(u)) removeKey(`hr:user:${u}`);
    for (const e of emp.employees) {
      setJSON(`hr:user:${e.username}`, e.profile);
      setJSON(`hr:leave:${e.username}`, { balance: e.leaveBalance, applications: leaveBy.get(e.username) || [] });
      setJSON(`hr:dopetest:${e.username}`, { history: e.dope.history });
      setJSON(`hr:claim:${e.username}`, {
        claims: (claimsBy.get(e.username) || []).map((c) => ({
          id: c.id,
          type: c.type,
          amount: c.amount,
          date: c.date,
          desc: c.desc,
          status: c.status,
        })),
      });
    }
    setUserIndex(usernames);
    loaded = true;
    bump();
  })()
    .catch(() => undefined)
    .finally(() => {
      loading = null;
    });
  return loading;
}

/** The list endpoints add employee/department counts; the stored records
 *  don't have them. */
function stripCounts<T extends object>(r: T): T {
  const { employeeCount: _e, departmentCount: _d, ...rest } = r as T & {
    employeeCount?: number;
    departmentCount?: number;
  };
  void _e;
  void _d;
  return rest as T;
}

/** Admin screens call this so they re-read when the server copy arrives.
 *  Loads on first use and re-checks every minute while a screen is open.
 *  The returned number changes whenever new data has been copied in. */
export function useAdminDirectory(): number {
  const v = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => version,
  );
  useEffect(() => {
    if (!loaded) void syncAdminDirectory();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void syncAdminDirectory();
    }, 60_000);
    return () => window.clearInterval(id);
  }, []);
  return v;
}

/** Run a change on the server, then refresh the local copy. */
async function run(fn: () => Promise<unknown>, fallback: string): Promise<ActionResult> {
  try {
    await fn();
  } catch (e) {
    return { ok: false, error: e instanceof ApiError || e instanceof Error ? e.message : fallback };
  }
  await syncAdminDirectory();
  return { ok: true };
}

/* ---------- employees ---------- */

export const setEmployeeActiveOnServer = (username: string, active: boolean) =>
  run(
    () => api(`/admin/employees/${encodeURIComponent(username)}/${active ? "reactivate" : "deactivate"}`, { method: "POST" }),
    active ? "Unable to reactivate staff." : "Unable to deactivate staff.",
  );

/* ---------- companies ---------- */

export const addCompanyOnServer = (name: string, code: string, type: CompanyType, parentCompanyId: string | null) =>
  run(
    () => api("/admin/companies", { body: { name: name.trim(), code: code.trim() || undefined, type, parentCompanyId } }),
    "Unable to add company.",
  );

export const updateCompanyOnServer = (
  id: string,
  name: string,
  code: string,
  type: CompanyType,
  parentCompanyId: string | null,
) =>
  run(
    () =>
      api(`/admin/companies/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: { name: name.trim(), code: code.trim() || undefined, type, parentCompanyId },
      }),
    "Unable to update company.",
  );

export const setCompanyActiveOnServer = (id: string, active: boolean) =>
  run(
    () => api(`/admin/companies/${encodeURIComponent(id)}/${active ? "reactivate" : "deactivate"}`, { method: "POST" }),
    "Unable to update company.",
  );

export const deleteCompanyOnServer = (id: string) =>
  run(() => api(`/admin/companies/${encodeURIComponent(id)}`, { method: "DELETE" }), "Unable to delete company.");

/* ---------- departments ---------- */

export const addDepartmentOnServer = (name: string, companyId: string, code: string) =>
  run(
    () => api("/admin/departments", { body: { name: name.trim(), companyId, code: code.trim() || undefined } }),
    "Unable to add department.",
  );

export const updateDepartmentOnServer = (id: string, name: string, companyId: string, code: string) =>
  run(
    () =>
      api(`/admin/departments/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: { name: name.trim(), companyId, code: code.trim() || undefined },
      }),
    "Unable to rename department.",
  );

export const setDepartmentActiveOnServer = (id: string, active: boolean) =>
  run(
    () => api(`/admin/departments/${encodeURIComponent(id)}/${active ? "reactivate" : "deactivate"}`, { method: "POST" }),
    "Unable to update department.",
  );

export const deleteDepartmentOnServer = (id: string) =>
  run(() => api(`/admin/departments/${encodeURIComponent(id)}`, { method: "DELETE" }), "Unable to delete department.");
