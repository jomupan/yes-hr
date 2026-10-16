import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  MoreVertical,
  Trash2,
  RotateCcw,
  Eye,
  FileText,
  Clock,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, EmptyState, Avatar, AdminInput } from "@/components/admin/ui";
import { EmployeeProfileModal } from "@/components/admin/EmployeeProfileModal";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import {
  getAdminEmployees,
  departmentOf,
  companyOf,
  emailOf,
  employeeIdOf,
  type AdminEmployee,
} from "@/lib/admin-store";
import { useAdminSession } from "@/hooks/use-admin-session";
import { isAccountActive } from "@/lib/account-status";
import { setEmployeeActiveOnServer, useAdminDirectory } from "@/lib/api-admin";
import { getActiveCompanies } from "@/lib/companies";
import { getActiveDepartmentsByCompany } from "@/lib/departments";

type StatusFilter = "all" | "active" | "inactive";

export function AdminEmployees() {
  const adminSession = useAdminSession();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [companyFilter, setCompanyFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [selected, setSelected] = useState<AdminEmployee | null>(null);
  const [tick, setTick] = useState(0);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{
    type: "remove" | "reactivate";
    employee: AdminEmployee;
  } | null>(null);
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);
  // Changes whenever the latest employee list arrives from the server.
  const directory = useAdminDirectory();

  const employees = useMemo(() => getAdminEmployees(), [tick, directory]);
  const companies = useMemo(() => getActiveCompanies(), [tick, directory]);
  // Department options depend on the selected company filter.
  const deptOptions = useMemo(
    () => (companyFilter ? getActiveDepartmentsByCompany(companyFilter) : []),
    [companyFilter, tick, directory],
  );

  const filtered = employees.filter((e) => {
    const matchesSearch =
      !search ||
      e.profile.fullName.toLowerCase().includes(search.toLowerCase()) ||
      departmentOf(e.profile).toLowerCase().includes(search.toLowerCase()) ||
      companyOf(e.profile).toLowerCase().includes(search.toLowerCase()) ||
      e.username.toLowerCase().includes(search.toLowerCase());
    const active = isAccountActive(e.profile);
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && active) ||
      (statusFilter === "inactive" && !active);
    const matchesCompany =
      !companyFilter || e.profile.companyId === companyFilter;
    const matchesDept = !deptFilter || e.profile.departmentId === deptFilter;
    return matchesSearch && matchesStatus && matchesCompany && matchesDept;
  });

  const handleRemove = (employee: AdminEmployee) => {
    setMenuOpen(null);
    setActionError("");
    setConfirm({ type: "remove", employee });
  };

  const handleReactivate = (employee: AdminEmployee) => {
    setMenuOpen(null);
    setActionError("");
    setConfirm({ type: "reactivate", employee });
  };

  // Saved on the server, so a deactivated staff member is logged out on
  // their phone straight away.
  const confirmAction = async () => {
    if (!confirm || saving) return;
    const remove = confirm.type === "remove";
    const isAdminAccount =
      confirm.employee.profile.authRole === "admin" ||
      !!confirm.employee.profile.isAdmin;
    if (remove && isAdminAccount) {
      setActionError("Admin accounts cannot be deactivated.");
      return;
    }
    if (remove && confirm.employee.username === adminSession.username) {
      setActionError("You cannot deactivate your own account.");
      return;
    }
    setSaving(true);
    const result = await setEmployeeActiveOnServer(
      confirm.employee.username,
      !remove,
    );
    setSaving(false);
    if (!result.ok) {
      setActionError(
        result.error ||
          (remove ? "Unable to deactivate staff." : "Unable to reactivate staff."),
      );
      return;
    }
    setConfirm(null);
    setActionError("");
    setTick((t) => t + 1);
  };

  const filterTabs: { id: StatusFilter; label: string }[] = [
    { id: "active", label: "Active" },
    { id: "inactive", label: "Inactive" },
    { id: "all", label: "All" },
  ];

  return (
    <AdminLayout>
      <div className="mb-5">
        <h2 className="text-xl sm:text-2xl font-bold text-white">Employees</h2>
        <p className="text-slate-400 text-sm mt-1">
          Manage your staff directory and view leave history.
        </p>
      </div>

      <Card className="p-4 mb-5">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
            <div className="relative max-w-sm flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <AdminInput
                placeholder="Search name, company, department or username"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex gap-1 bg-[#0e1320] border border-white/10 rounded-lg p-1 self-end sm:self-auto">
              {filterTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setStatusFilter(tab.id)}
                  className={[
                    "px-3 py-1.5 rounded-md text-[12.5px] font-medium transition-colors",
                    statusFilter === tab.id
                      ? "bg-amber-500 text-slate-950"
                      : "text-slate-400 hover:text-white",
                  ].join(" ")}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <select
              value={companyFilter}
              onChange={(e) => {
                setCompanyFilter(e.target.value);
                setDeptFilter("");
              }}
              className="px-3 py-2 rounded-lg bg-[#0e1320] border border-white/10 text-[13px] text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 sm:max-w-[200px]"
            >
              <option value="">All Companies</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              disabled={!companyFilter}
              className="px-3 py-2 rounded-lg bg-[#0e1320] border border-white/10 text-[13px] text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40 disabled:opacity-50 sm:max-w-[200px]"
            >
              <option value="">All Departments</option>
              {deptOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13.5px] min-w-[920px]">
            <thead>
              <tr className="border-b border-white/10">
                {[
                  "Employee",
                  "Employee ID",
                  "Company",
                  "Department",
                  "Email",
                  "Annual Balance",
                  "Status",
                  "Action",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left text-[11px] uppercase tracking-[0.04em] text-slate-400 px-4 py-3 font-semibold"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <EmptyState>No employees found.</EmptyState>
                  </td>
                </tr>
              ) : (
                filtered.map((e) => {
                  const active = isAccountActive(e.profile);
                  const isSelf = e.username === adminSession.username;
                  const isAdmin =
                    e.profile.authRole === "admin" || !!e.profile.isAdmin;
                  return (
                    <tr
                      key={e.username}
                      className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={e.profile.fullName} size={32} />
                          <div>
                            <div className="font-medium text-white">
                              {e.profile.fullName}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {e.profile.role}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono-hr text-slate-300">
                        {employeeIdOf(e.profile)}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {companyOf(e.profile)}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {departmentOf(e.profile)}
                      </td>
                      <td className="px-4 py-3 text-slate-300 text-[12px]">
                        {emailOf(e.profile)}
                      </td>
                      <td className="px-4 py-3 font-mono-hr text-slate-300">
                        {e.leave.balance.Annual} days
                      </td>
                      <td className="px-4 py-3">
                        {active ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{" "}
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />{" "}
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 relative">
                        <button
                          onClick={() =>
                            setMenuOpen(
                              menuOpen === e.username ? null : e.username,
                            )
                          }
                          className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/5"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {menuOpen === e.username && (
                          <>
                            <div
                              className="fixed inset-0 z-40"
                              onClick={() => setMenuOpen(null)}
                            />
                            <div className="absolute right-0 top-9 z-50 w-48 bg-[#111726] border border-white/10 rounded-lg shadow-xl py-1">
                              <button
                                onClick={() => {
                                  setSelected(e);
                                  setMenuOpen(null);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-slate-300 hover:bg-white/5 hover:text-white text-left"
                              >
                                <Eye className="w-3.5 h-3.5" /> View Profile
                              </button>
                              <button
                                onClick={() => {
                                  setSelected(e);
                                  setMenuOpen(null);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-slate-300 hover:bg-white/5 hover:text-white text-left"
                              >
                                <FileText className="w-3.5 h-3.5" /> View Leave
                                History
                              </button>
                              <button
                                onClick={() => {
                                  setMenuOpen(null);
                                  navigate(
                                    `/admin/attendance/employee/${e.username}`,
                                  );
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-slate-300 hover:bg-white/5 hover:text-white text-left"
                              >
                                <Clock className="w-3.5 h-3.5" /> View
                                Attendance
                              </button>
                              {active ? (
                                <button
                                  onClick={() => handleRemove(e)}
                                  disabled={isSelf || isAdmin}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-rose-400 hover:bg-rose-500/10 text-left disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  <Trash2 className="w-3.5 h-3.5" /> Remove
                                  Staff
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleReactivate(e)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-emerald-400 hover:bg-emerald-500/10 text-left"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />{" "}
                                  Reactivate Staff
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {selected && (
        <EmployeeProfileModal
          employee={selected}
          onClose={() => setSelected(null)}
        />
      )}

      {confirm && (
        <ConfirmModal
          title={
            confirm.type === "remove" ? "Remove Staff?" : "Reactivate Staff?"
          }
          message={
            confirm.type === "remove"
              ? `Are you sure you want to remove ${confirm.employee.profile.fullName} from the active staff list? This staff member will no longer be able to log in to the HR System. Their existing HR records will be retained.`
              : `Are you sure you want to reactivate ${confirm.employee.profile.fullName}'s staff account? They will be able to log in again using their existing credentials.`
          }
          confirmLabel={
            confirm.type === "remove" ? "Remove Staff" : "Reactivate"
          }
          danger={confirm.type === "remove"}
          error={actionError}
          onCancel={() => {
            setConfirm(null);
            setActionError("");
          }}
          onConfirm={confirmAction}
        />
      )}
    </AdminLayout>
  );
}
