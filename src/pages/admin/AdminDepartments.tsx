import { useMemo, useState } from "react";
import {
  Building2,
  Plus,
  Pencil,
  Power,
  PowerOff,
  Trash2,
  X,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, EmptyState, AdminBtn, AdminInput } from "@/components/admin/ui";
import {
  getAllDepartments,
  addDepartment,
  renameDepartment,
  deactivateDepartment,
  reactivateDepartment,
  deleteDepartmentIfEmpty,
  type Department,
} from "@/lib/departments";
import { getActiveCompanies } from "@/lib/companies";
import { getAdminEmployees, departmentOf } from "@/lib/admin-store";

type Filter = "active" | "inactive" | "all";

export function AdminDepartments() {
  const [tick, setTick] = useState(0);
  const [filter, setFilter] = useState<Filter>("active");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Department | null>(null);
  const [error, setError] = useState("");

  const departments = useMemo(() => getAllDepartments(), [tick]);
  const employees = useMemo(() => getAdminEmployees(), [tick]);

  const countFor = (id: string) =>
    employees.filter((e) => {
      // Count by resolved department id when present, otherwise by name match.
      if (e.profile.departmentId) return e.profile.departmentId === id;
      const d = departments.find((x) => x.id === id);
      return d && departmentOf(e.profile) === d.name;
    }).length;

  const filtered = departments.filter((d) =>
    filter === "all" ? true : filter === "active" ? d.active : !d.active,
  );

  const refresh = () => {
    setError("");
    setTick((t) => t + 1);
  };

  const handleDeactivate = (d: Department) => {
    setError("");
    const r = deactivateDepartment(d.id);
    if (!r.ok) {
      setError(r.error || "Unable to deactivate department.");
      return;
    }
    refresh();
  };

  const handleReactivate = (d: Department) => {
    setError("");
    const r = reactivateDepartment(d.id);
    if (!r.ok) {
      setError(r.error || "Unable to reactivate department.");
      return;
    }
    refresh();
  };

  const handleDelete = (d: Department) => {
    setError("");
    const count = countFor(d.id);
    const r = deleteDepartmentIfEmpty(d.id, count);
    if (!r.ok) {
      setError(r.error || "Unable to delete department.");
      return;
    }
    refresh();
  };

  const filterTabs: { id: Filter; label: string }[] = [
    { id: "active", label: "Active" },
    { id: "inactive", label: "Inactive" },
    { id: "all", label: "All" },
  ];

  return (
    <AdminLayout>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            Departments
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Manage departments used across the HR system. Active departments
            appear in the staff registration dropdown.
          </p>
        </div>
        <AdminBtn variant="primary" onClick={() => setShowAdd(true)}>
          <Plus className="w-4 h-4" /> Add Department
        </AdminBtn>
      </div>

      <Card className="p-3 mb-5">
        <div className="flex gap-1 bg-[#0e1320] border border-white/10 rounded-lg p-1 w-fit">
          {filterTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id)}
              className={[
                "px-3 py-1.5 rounded-md text-[12.5px] font-medium transition-colors",
                filter === tab.id
                  ? "bg-amber-500 text-slate-950"
                  : "text-slate-400 hover:text-white",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </Card>

      {error && (
        <div className="mb-4 text-[12px] text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13.5px] min-w-[640px]">
            <thead>
              <tr className="border-b border-white/10">
                {[
                  "Department",
                  "Code",
                  "Company",
                  "Employees",
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
                  <td colSpan={6}>
                    <EmptyState>No departments found.</EmptyState>
                  </td>
                </tr>
              ) : (
                filtered.map((d) => {
                  const count = countFor(d.id);
                  return (
                    <tr
                      key={d.id}
                      className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-300 flex items-center justify-center">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <span className="font-medium text-white">
                            {d.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono-hr text-slate-300">
                        {d.code || "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-300">{d.company}</td>
                      <td className="px-4 py-3 font-mono-hr text-slate-300">
                        {count}
                      </td>
                      <td className="px-4 py-3">
                        {d.active ? (
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
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              setEditing(d);
                              setError("");
                            }}
                            className="text-slate-400 hover:text-white p-1.5 rounded hover:bg-white/5"
                            title="Rename"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {d.active ? (
                            <button
                              onClick={() => handleDeactivate(d)}
                              className="text-amber-400 hover:text-amber-300 p-1.5 rounded hover:bg-amber-500/10"
                              title="Deactivate"
                            >
                              <PowerOff className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleReactivate(d)}
                              className="text-emerald-400 hover:text-emerald-300 p-1.5 rounded hover:bg-emerald-500/10"
                              title="Reactivate"
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(d)}
                            className="text-rose-400 hover:text-rose-300 p-1.5 rounded hover:bg-rose-500/10"
                            title="Delete (only when no employees assigned)"
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

      {showAdd && (
        <DepartmentFormModal
          title="Add Department"
          onClose={() => setShowAdd(false)}
          onSubmit={(name, code, companyId) => {
            const r = addDepartment(name, companyId, code);
            if (!r.ok) {
              setError(r.error || "Unable to add department.");
              return false;
            }
            refresh();
            return true;
          }}
        />
      )}

      {editing && (
        <DepartmentFormModal
          title="Rename Department"
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={(name, code, companyId) => {
            const r = renameDepartment(editing.id, name, companyId, code);
            if (!r.ok) {
              setError(r.error || "Unable to rename department.");
              return false;
            }
            refresh();
            return true;
          }}
        />
      )}
    </AdminLayout>
  );
}

function DepartmentFormModal({
  title,
  initial,
  onClose,
  onSubmit,
}: {
  title: string;
  initial?: Department;
  onClose: () => void;
  onSubmit: (name: string, code: string, companyId: string) => boolean;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [code, setCode] = useState(initial?.code || "");
  const [companyId, setCompanyId] = useState(initial?.companyId || "");
  const [localError, setLocalError] = useState("");

  const companies = getActiveCompanies();

  const submit = () => {
    setLocalError("");
    if (!name.trim()) {
      setLocalError("Department name is required.");
      return;
    }
    if (!companyId) {
      setLocalError("Please select a company.");
      return;
    }
    const ok = onSubmit(name, code, companyId);
    if (ok) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-[#111726] border border-white/10 rounded-[14px] w-full max-w-[420px] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h3 className="text-base font-bold text-white">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
              Company / Subsidiary
            </label>
            {companies.length === 0 ? (
              <div className="text-[12px] text-rose-300">
                No active companies available. Add a company first.
              </div>
            ) : (
              <select
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-[#0e1320] border border-white/10 text-[13.5px] text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              >
                <option value="">Select company</option>
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.code ? ` (${c.code})` : ""}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
              Department Name
            </label>
            <AdminInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Customer Service"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
              Code (optional)
            </label>
            <AdminInput
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. CS"
            />
          </div>
          {localError && (
            <div className="text-[12px] text-rose-300">{localError}</div>
          )}
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-white/10">
          <AdminBtn variant="secondary" onClick={onClose}>
            Cancel
          </AdminBtn>
          <AdminBtn variant="primary" onClick={submit}>
            Save
          </AdminBtn>
        </div>
      </div>
    </div>
  );
}
