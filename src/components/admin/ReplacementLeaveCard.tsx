import { useMemo, useState } from "react";
import { CalendarPlus, Pencil, Plus, Search, Trash2, Users, X } from "lucide-react";
import { Card, AdminBtn, AdminInput } from "@/components/admin/ui";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import { getAdminEmployees } from "@/lib/admin-store";
import { isAccountActive } from "@/lib/account-status";
import { useAdminDirectory } from "@/lib/api-admin";
import { fmtDate } from "@/lib/hr-store";
import {
  createReplacementLeave,
  deleteReplacementLeave,
  updateReplacementLeave,
  useReplacementLeaves,
  type AdminReplacementLeave,
  type ReplacementInput,
} from "@/lib/api-replacement";

const errText = (e: unknown, fallback: string) => (e instanceof Error && e.message) || fallback;

/** Settings card: replacement leave entries the admin adds and deletes,
 *  e.g. "Replacement Leave SUKMA – 1 day", given to all or chosen staff. */
export function ReplacementLeaveCard() {
  const { items, setItems, loading, error } = useReplacementLeaves();
  const [editing, setEditing] = useState<AdminReplacementLeave | "new" | null>(null);
  const [deleting, setDeleting] = useState<AdminReplacementLeave | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      setItems(await deleteReplacementLeave(deleting.id));
      setDeleting(null);
      setDeleteError("");
    } catch (e) {
      setDeleteError(errText(e, "Couldn't delete. Please try again."));
    }
  };

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-white">Replacement Leave</h3>
          <p className="text-[12px] text-slate-400 mt-1">
            Give staff extra leave days, e.g. Replacement Leave SUKMA. Staff can apply for them in the Leave page.
          </p>
        </div>
        <AdminBtn variant="primary" onClick={() => setEditing("new")}>
          <Plus className="w-4 h-4" /> Add
        </AdminBtn>
      </div>

      {loading ? (
        <div className="text-[13px] text-slate-500">Loading…</div>
      ) : error ? (
        <div className="text-[13px] text-rose-300">{error}</div>
      ) : items.length === 0 ? (
        <div className="text-[13px] text-slate-500 border border-dashed border-white/10 rounded-lg px-4 py-6 text-center">
          No replacement leave yet. Click <span className="text-slate-300">Add</span> to create one.
        </div>
      ) : (
        <div className="divide-y divide-white/5 border border-white/10 rounded-lg">
          {items.map((r) => {
            const expired = !!r.expiresOn && r.expiresOn < new Date().toLocaleDateString("en-CA");
            return (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center text-amber-300 flex-shrink-0">
                  <CalendarPlus className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13.5px] text-white font-medium truncate">{r.name}</div>
                  <div className="text-[12px] text-slate-400 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                    <span>{r.days} day(s)</span>
                    <span className={expired ? "text-rose-300" : ""}>
                      {r.expiresOn ? `${expired ? "Expired" : "Use by"} ${fmtDate(r.expiresOn)}` : "No expiry"}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="w-3 h-3" /> {r.staff.length} staff
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(r)}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
                  aria-label={`Edit ${r.name}`}
                  title="Edit"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDeleteError("");
                    setDeleting(r);
                  }}
                  className="p-2 rounded-lg text-rose-400 hover:bg-rose-500/10"
                  aria-label={`Delete ${r.name}`}
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {editing && (
        <ReplacementModal
          initial={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(list) => {
            setItems(list);
            setEditing(null);
          }}
        />
      )}

      {deleting && (
        <ConfirmModal
          title="Delete Replacement Leave?"
          message={`Delete "${deleting.name}"? Staff will no longer see or be able to apply for it. Leave already taken stays in their history.`}
          confirmLabel="Delete"
          danger
          error={deleteError}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void confirmDelete()}
        />
      )}
    </Card>
  );
}

function ReplacementModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: AdminReplacementLeave | null;
  onClose: () => void;
  onSaved: (list: AdminReplacementLeave[]) => void;
}) {
  const directory = useAdminDirectory();
  // Active staff (admins don't take leave here).
  const staff = useMemo(
    () =>
      getAdminEmployees()
        .filter((e) => e.profile.authRole !== "admin" && !e.profile.isAdmin && isAccountActive(e.profile))
        .map((e) => ({ username: e.username, fullName: e.profile.fullName }))
        .sort((a, b) => a.fullName.localeCompare(b.fullName)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [directory],
  );

  const [name, setName] = useState(initial?.name || "");
  const [days, setDays] = useState(String(initial?.days ?? 1));
  const [expiresOn, setExpiresOn] = useState(initial?.expiresOn || "");
  // New entries go to everyone by default; untick anyone who shouldn't get it.
  const [chosen, setChosen] = useState<Set<string> | null>(
    initial ? new Set(initial.staff.map((s) => s.username)) : null,
  );
  const selected = chosen ?? new Set(staff.map((s) => s.username));
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const shown = staff.filter((s) => {
    const q = search.trim().toLowerCase();
    return !q || s.fullName.toLowerCase().includes(q) || s.username.includes(q);
  });
  const allTicked = staff.length > 0 && staff.every((s) => selected.has(s.username));

  const toggle = (username: string) => {
    const next = new Set(selected);
    if (next.has(username)) next.delete(username);
    else next.add(username);
    setChosen(next);
  };
  const toggleAll = () => setChosen(allTicked ? new Set() : new Set(staff.map((s) => s.username)));

  const save = async () => {
    if (saving) return;
    setError("");
    const n = Number(days);
    if (!name.trim()) return setError("Please enter a name, e.g. Replacement Leave SUKMA.");
    if (!Number.isInteger(n) || n < 1) return setError("Days must be a whole number, at least 1.");
    const input: ReplacementInput = { name: name.trim(), days: n, expiresOn, usernames: [...selected] };
    setSaving(true);
    try {
      onSaved(initial ? await updateReplacementLeave(initial.id, input) : await createReplacementLeave(input));
    } catch (e) {
      setError(errText(e, "Couldn't save. Please try again."));
    } finally {
      setSaving(false);
    }
  };

  const label = "block text-[11px] uppercase tracking-wide text-slate-500 mb-1.5";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="bg-[#111726] border border-white/10 rounded-[14px] w-full max-w-[520px] shadow-2xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rl-title"
      >
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h3 id="rl-title" className="text-base font-bold text-white">
            {initial ? "Edit Replacement Leave" : "Add Replacement Leave"}
          </h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div>
            <label htmlFor="rl-name" className={label}>Name</label>
            <AdminInput
              id="rl-name"
              placeholder="e.g. Replacement Leave SUKMA"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="rl-days" className={label}>Days</label>
              <AdminInput id="rl-days" type="number" min={1} value={days} onChange={(e) => setDays(e.target.value)} />
            </div>
            <div>
              <label htmlFor="rl-exp" className={label}>Use by (optional)</label>
              <AdminInput id="rl-exp" type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
            </div>
          </div>
          {initial && (
            <p className="text-[11.5px] text-slate-500">
              Changing the days adds or removes the same number from everyone who already has it.
            </p>
          )}

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className={label + " mb-0"}>Who gets it ({selected.size} of {staff.length})</span>
              <button type="button" onClick={toggleAll} className="text-[12px] text-amber-300 hover:text-amber-200">
                {allTicked ? "Untick all" : "Tick all staff"}
              </button>
            </div>
            <div className="relative mb-2">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <AdminInput
                placeholder="Search staff"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="border border-white/10 rounded-lg max-h-[220px] overflow-y-auto divide-y divide-white/5">
              {shown.length === 0 ? (
                <div className="px-3 py-4 text-[12.5px] text-slate-500 text-center">
                  {staff.length === 0 ? "No active staff yet." : "No staff match your search."}
                </div>
              ) : (
                shown.map((s) => (
                  <label
                    key={s.username}
                    className="flex items-center gap-3 px-3 py-2.5 cursor-pointer hover:bg-white/[0.03]"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(s.username)}
                      onChange={() => toggle(s.username)}
                      className="w-4 h-4 accent-amber-500"
                    />
                    <span className="text-[13px] text-slate-200">{s.fullName}</span>
                    <span className="text-[11.5px] text-slate-500 ml-auto">{s.username}</span>
                  </label>
                ))
              )}
            </div>
          </div>
          {error && <p className="text-xs text-rose-300">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 p-5 border-t border-white/10">
          <AdminBtn variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </AdminBtn>
          <AdminBtn variant="primary" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </AdminBtn>
        </div>
      </div>
    </div>
  );
}
