import { useEffect, useMemo, useState } from "react";
import {
  Plus,
  RefreshCw,
  Eye,
  Replace,
  Trash2,
  FileText,
  Image as ImageIcon,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  Card,
  EmptyState,
  AdminBtn,
  AdminInput,
  AdminSelect,
  Avatar,
} from "@/components/admin/ui";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import {
  UploadPayslipModal,
  ViewPayslipModal,
  ReplacePayslipModal,
} from "@/components/admin/payslip-modals";
import {
  getAllPayslips,
  getActiveEmployeesForPayslip,
  removePayslip,
  syncAdminPayslips,
  monthName,
  periodLabel,
  type PayslipRecord,
} from "@/lib/payslips";
import { departmentOf, companyOf, employeeIdOf } from "@/lib/admin-store";
import { fmtDate } from "@/lib/hr-store";
import { useAdminSession } from "@/hooks/use-admin-session";
import { syncAdminDirectory, useAdminDirectory } from "@/lib/api-admin";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const YEARS = (() => {
  const now = new Date();
  const out: number[] = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 4; y--) out.push(y);
  return out;
})();

function isImage(type: string): boolean {
  return type.startsWith("image/");
}

export function AdminPayslips() {
  const admin = useAdminSession();
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");
  const [error, setError] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [viewing, setViewing] = useState<PayslipRecord | null>(null);
  const [replacing, setReplacing] = useState<PayslipRecord | null>(null);
  const [removing, setRemoving] = useState<PayslipRecord | null>(null);

  const [search, setSearch] = useState("");
  const [dept, setDept] = useState("");
  const [co, setCo] = useState("");
  const [month, setMonth] = useState<number | "">("");
  const [year, setYear] = useState<number | "">("");

  const directory = useAdminDirectory();
  const employees = useMemo(
    () => getActiveEmployeesForPayslip(),
    [tick, directory],
  );
  const payslips = useMemo(() => getAllPayslips(), [tick]);

  // Load the latest payslips from the server.
  const refresh = () => {
    setRefreshing(true);
    setError("");
    Promise.all([syncAdminPayslips(), syncAdminDirectory()])
      .then(() =>
        setLastUpdated(
          new Date().toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
          }),
        ),
      )
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Unable to load payslips."),
      )
      .finally(() => {
        setTick((t) => t + 1);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    refresh();
  }, []);

  const deptOptions = useMemo(() => {
    const set = new Map<string, string>();
    employees.forEach((e) => {
      const name = departmentOf(e.profile);
      if (e.profile.departmentId) set.set(e.profile.departmentId, name);
      else if (!Array.from(set.values()).includes(name)) set.set(name, name);
    });
    return Array.from(set.entries()).map(([id, name]) => ({ id, name }));
  }, [employees]);
  const coOptions = useMemo(() => {
    const set = new Map<string, string>();
    employees.forEach((e) => {
      const name = companyOf(e.profile);
      if (e.profile.companyId) set.set(e.profile.companyId, name);
      else if (!Array.from(set.values()).includes(name)) set.set(name, name);
    });
    return Array.from(set.entries()).map(([id, name]) => ({ id, name }));
  }, [employees]);

  const filtered = payslips.filter((p) => {
    const emp = employees.find((e) => e.username === p.username);
    const profile = emp?.profile;
    if (search) {
      const q = search.toLowerCase();
      const name = (profile?.fullName || "").toLowerCase();
      const eid = (profile?.employeeId || "").toLowerCase();
      if (!name.includes(q) && !eid.includes(q) && !p.username.includes(q))
        return false;
    }
    if (dept) {
      const dname = profile ? departmentOf(profile) : "";
      const did = profile?.departmentId;
      if (did ? did !== dept : dname !== dept) return false;
    }
    if (co) {
      const cname = profile ? companyOf(profile) : "";
      const cid = profile?.companyId;
      if (cid ? cid !== co : cname !== co) return false;
    }
    if (month && p.month !== month) return false;
    if (year && p.year !== year) return false;
    return true;
  });

  const handleRemove = async () => {
    if (!removing) return;
    const r = await removePayslip(removing.id);
    if (!r.ok) {
      setError(r.error || "Unable to remove payslip.");
      return;
    }
    setRemoving(null);
    refresh();
  };

  return (
    <AdminLayout>
      <div className="mb-5 flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">Payslips</h2>
          <p className="text-slate-400 text-sm mt-1">
            Upload and manage employee payslips. Each payslip is visible only to
            the assigned employee.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-[11px] text-slate-500">
              Last updated: {lastUpdated}
            </span>
          )}
          <AdminBtn variant="secondary" onClick={refresh} disabled={refreshing}>
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            />
            {refreshing ? "Refreshing..." : "Refresh"}
          </AdminBtn>
          <AdminBtn variant="primary" onClick={() => setShowUpload(true)}>
            <Plus className="w-4 h-4" /> Upload Payslip
          </AdminBtn>
        </div>
      </div>

      <Card className="p-4 mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
              Search
            </label>
            <AdminInput
              placeholder="Employee or Staff ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
              Department
            </label>
            <AdminSelect value={dept} onChange={(e) => setDept(e.target.value)}>
              <option value="">All Departments</option>
              {deptOptions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </AdminSelect>
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
              Company
            </label>
            <AdminSelect value={co} onChange={(e) => setCo(e.target.value)}>
              <option value="">All Companies</option>
              {coOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </AdminSelect>
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
              Month
            </label>
            <AdminSelect
              value={month}
              onChange={(e) =>
                setMonth(e.target.value ? Number(e.target.value) : "")
              }
            >
              <option value="">All Months</option>
              {MONTHS.map((m) => (
                <option key={m} value={m}>
                  {monthName(m)}
                </option>
              ))}
            </AdminSelect>
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
              Year
            </label>
            <AdminSelect
              value={year}
              onChange={(e) =>
                setYear(e.target.value ? Number(e.target.value) : "")
              }
            >
              <option value="">All Years</option>
              {YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </AdminSelect>
          </div>
        </div>
      </Card>

      {error && (
        <div className="mb-4 text-[12px] text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13.5px] min-w-[860px]">
            <thead>
              <tr className="border-b border-white/10">
                {[
                  "Employee",
                  "Employee ID",
                  "Department",
                  "Company",
                  "Period",
                  "File",
                  "Uploaded",
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
                  <td colSpan={9}>
                    <EmptyState>No payslips found.</EmptyState>
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const emp = employees.find((e) => e.username === p.username);
                  const profile = emp?.profile;
                  return (
                    <tr
                      key={p.id}
                      className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar
                            name={profile?.fullName || p.username}
                            size={30}
                          />
                          <span className="font-medium text-white">
                            {profile?.fullName || p.username}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono-hr text-slate-300">
                        {profile ? employeeIdOf(profile) : "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {profile ? departmentOf(profile) : "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {profile ? companyOf(profile) : "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {periodLabel(p.month, p.year)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          {isImage(p.file.type) ? (
                            <ImageIcon className="w-3.5 h-3.5 text-amber-300" />
                          ) : (
                            <FileText className="w-3.5 h-3.5 text-amber-300" />
                          )}
                          <span className="truncate max-w-[140px]">
                            {p.file.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        {fmtDate(p.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        {p.status === "active" ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{" "}
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />{" "}
                            Removed
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setViewing(p)}
                            className="text-slate-400 hover:text-white p-1.5 rounded hover:bg-white/5"
                            title="View"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setReplacing(p)}
                            className="text-amber-400 hover:text-amber-300 p-1.5 rounded hover:bg-amber-500/10"
                            title="Replace"
                          >
                            <Replace className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setRemoving(p)}
                            className="text-rose-400 hover:text-rose-300 p-1.5 rounded hover:bg-rose-500/10"
                            title="Remove"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {showUpload && (
        <UploadPayslipModal
          onClose={() => setShowUpload(false)}
          uploadedBy={admin.username || "admin"}
          onDone={() => {
            setShowUpload(false);
            refresh();
          }}
        />
      )}
      {viewing && (
        <ViewPayslipModal payslip={viewing} onClose={() => setViewing(null)} />
      )}
      {replacing && (
        <ReplacePayslipModal
          payslip={replacing}
          onClose={() => setReplacing(null)}
          onDone={() => {
            setReplacing(null);
            refresh();
          }}
        />
      )}
      {removing && (
        <ConfirmModal
          title="Remove Payslip"
          message={`Are you sure you want to remove the payslip for ${periodLabel(removing.month, removing.year)}? This payslip will no longer be visible to the employee.`}
          confirmLabel="Remove"
          danger
          onCancel={() => setRemoving(null)}
          onConfirm={handleRemove}
        />
      )}
    </AdminLayout>
  );
}
