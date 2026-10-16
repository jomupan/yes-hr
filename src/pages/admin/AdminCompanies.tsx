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
  getAllCompanies,
  getCompanyById,
  type Company,
  type CompanyType,
} from "@/lib/companies";
import { getAllDepartments } from "@/lib/departments";
import { getAdminEmployees, companyOf } from "@/lib/admin-store";
import {
  addCompanyOnServer,
  deleteCompanyOnServer,
  setCompanyActiveOnServer,
  updateCompanyOnServer,
  useAdminDirectory,
  type ActionResult,
} from "@/lib/api-admin";

type Filter = "active" | "inactive" | "all";

export function AdminCompanies() {
  const [tick, setTick] = useState(0);
  const [filter, setFilter] = useState<Filter>("active");
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<Company | null>(null);
  const [error, setError] = useState("");

  const directory = useAdminDirectory();
  const companies = useMemo(() => getAllCompanies(), [tick, directory]);
  const departments = useMemo(() => getAllDepartments(), [tick, directory]);
  const employees = useMemo(() => getAdminEmployees(), [tick, directory]);

  const deptCountFor = (id: string) =>
    departments.filter((d) => d.companyId === id).length;
  const empCountFor = (id: string) =>
    employees.filter((e) => {
      if (e.profile.companyId) return e.profile.companyId === id;
      return companyOf(e.profile) === (getCompanyById(id)?.name || "");
    }).length;

  const filtered = companies.filter((c) =>
    filter === "all" ? true : filter === "active" ? c.active : !c.active,
  );

  const refresh = () => {
    setError("");
    setTick((t) => t + 1);
  };

  // Changes are saved on the server, then the list is refreshed.
  const apply = async (p: Promise<ActionResult>, fallback: string) => {
    setError("");
    const r = await p;
    if (!r.ok) {
      setError(r.error || fallback);
      return false;
    }
    refresh();
    return true;
  };

  const handleDeactivate = (c: Company) =>
    void apply(setCompanyActiveOnServer(c.id, false), "Unable to deactivate company.");

  const handleReactivate = (c: Company) =>
    void apply(setCompanyActiveOnServer(c.id, true), "Unable to reactivate company.");

  const handleDelete = (c: Company) =>
    void apply(deleteCompanyOnServer(c.id), "Unable to delete company.");

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
            Companies
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Manage the parent company and its subsidiaries. Departments and
            employees are assigned to a specific company.
          </p>
        </div>
        <AdminBtn variant="primary" onClick={() => setShowAdd(true)}>
          <Plus className="w-4 h-4" /> Add Company
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
          <table className="w-full border-collapse text-[13.5px] min-w-[720px]">
            <thead>
              <tr className="border-b border-white/10">
                {[
                  "Company",
                  "Code",
                  "Type",
                  "Departments",
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
                  <td colSpan={7}>
                    <EmptyState>No companies found.</EmptyState>
                  </td>
                </tr>
              ) : (
                filtered.map((c) => {
                  const parent = c.parentCompanyId
                    ? getCompanyById(c.parentCompanyId)
                    : null;
                  return (
                    <tr
                      key={c.id}
                      className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.02]"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-300 flex items-center justify-center">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="font-medium text-white">
                              {c.name}
                            </div>
                            {parent && (
                              <div className="text-[11px] text-slate-500">
                                under {parent.name}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono-hr text-slate-300">
                        {c.code || "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {c.type === "parent" ? "Parent Company" : "Subsidiary"}
                      </td>
                      <td className="px-4 py-3 font-mono-hr text-slate-300">
                        {deptCountFor(c.id)}
                      </td>
                      <td className="px-4 py-3 font-mono-hr text-slate-300">
                        {empCountFor(c.id)}
                      </td>
                      <td className="px-4 py-3">
                        {c.active ? (
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
                              setEditing(c);
                              setError("");
                            }}
                            className="text-slate-400 hover:text-white p-1.5 rounded hover:bg-white/5"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {c.active ? (
                            <button
                              onClick={() => handleDeactivate(c)}
                              className="text-amber-400 hover:text-amber-300 p-1.5 rounded hover:bg-amber-500/10"
                              title="Deactivate"
                            >
                              <PowerOff className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleReactivate(c)}
                              className="text-emerald-400 hover:text-emerald-300 p-1.5 rounded hover:bg-emerald-500/10"
                              title="Reactivate"
                            >
                              <Power className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(c)}
                            className="text-rose-400 hover:text-rose-300 p-1.5 rounded hover:bg-rose-500/10"
                            title="Delete (only when no departments or employees assigned)"
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
        <CompanyFormModal
          title="Add Company"
          onClose={() => setShowAdd(false)}
          onSubmit={(name, code, type, parentId) =>
            apply(
              addCompanyOnServer(name, code, type, parentId),
              "Unable to add company.",
            )
          }
        />
      )}

      {editing && (
        <CompanyFormModal
          title="Edit Company"
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={(name, code, type, parentId) =>
            apply(
              updateCompanyOnServer(editing.id, name, code, type, parentId),
              "Unable to update company.",
            )
          }
        />
      )}
    </AdminLayout>
  );
}

function CompanyFormModal({
  title,
  initial,
  onClose,
  onSubmit,
}: {
  title: string;
  initial?: Company;
  onClose: () => void;
  onSubmit: (
    name: string,
    code: string,
    type: CompanyType,
    parentId: string | null,
  ) => Promise<boolean>;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [code, setCode] = useState(initial?.code || "");
  const [type, setType] = useState<CompanyType>(initial?.type || "subsidiary");
  const [parentId, setParentId] = useState<string>(
    initial?.parentCompanyId || "",
  );
  const [localError, setLocalError] = useState("");

  // Eligible parents: active parent companies (excluding the one being edited).
  const parents = getAllCompanies().filter(
    (c) => c.active && c.type === "parent" && c.id !== initial?.id,
  );

  const submit = async () => {
    setLocalError("");
    if (!name.trim()) {
      setLocalError("Company name is required.");
      return;
    }
    const ok = await onSubmit(
      name,
      code,
      type,
      type === "parent" ? null : parentId || null,
    );
    if (ok) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-[#111726] border border-white/10 rounded-[14px] w-full max-w-[440px] shadow-2xl"
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
              Company Name
            </label>
            <AdminInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. BENACCOUNT"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
              Company Code
            </label>
            <AdminInput
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. BAC"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
              Company Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as CompanyType)}
              className="w-full px-3 py-2.5 rounded-lg bg-[#0e1320] border border-white/10 text-[13.5px] text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            >
              <option value="subsidiary">Subsidiary</option>
              <option value="parent">Parent Company</option>
            </select>
          </div>
          {type === "subsidiary" && (
            <div>
              <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
                Parent Company
              </label>
              <select
                value={parentId}
                onChange={(e) => setParentId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg bg-[#0e1320] border border-white/10 text-[13.5px] text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40"
              >
                <option value="">None</option>
                {parents.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
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
