/* Company settings and leave balances (admin). */

import { api } from "./api";
import { syncAdminDirectory } from "./api-admin";

export interface LeaveNumbers {
  Annual: number;
  Medical: number;
  Emergency: number;
}

export interface CompanySettings {
  companyName: string;
  defaultLeave: LeaveNumbers;
}

export async function fetchSettings(): Promise<CompanySettings> {
  const res = await api<{ settings: CompanySettings }>("/admin/settings");
  return res.settings;
}

/** Save settings. `applyTo` = existing staff whose balances get the same
 *  change added (new staff always start with the new defaults). */
export async function saveSettings(
  settings: CompanySettings,
  applyTo: string[] = [],
): Promise<{ settings: CompanySettings; updatedStaff: number }> {
  const res = await api<{ settings: CompanySettings; updatedStaff: number }>("/admin/settings", {
    method: "PUT",
    body: { ...settings, applyTo },
  });
  await syncAdminDirectory();
  return res;
}

/** Set one staff member's Annual / Medical / Emergency balance. */
export async function updateEmployeeLeaveBalance(username: string, balance: LeaveNumbers): Promise<void> {
  await api(`/admin/employees/${encodeURIComponent(username)}`, {
    method: "PATCH",
    body: { leaveBalance: balance },
  });
  await syncAdminDirectory();
}
