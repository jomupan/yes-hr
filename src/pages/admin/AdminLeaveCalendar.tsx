import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Pencil, Trash2, X } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, Avatar, AdminBtn, AdminInput, AdminSelect } from "@/components/admin/ui";
import { isOnLeaveOn } from "@/lib/admin-store";
import { useAdminLeaveApps } from "@/lib/api-hr";
import { fmtDate, todayISO } from "@/lib/hr-store";
import {
  CATEGORY_LABEL,
  createCalendarNote,
  deleteCalendarNote,
  notesOn,
  updateCalendarNote,
  useCalendarNotes,
  type CalendarCategory,
  type CalendarNote,
} from "@/lib/api-calendar";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/* Note colours on the dark admin theme. */
const NOTE_CHIP: Record<CalendarCategory, string> = {
  event: "bg-sky-500/15 text-sky-300",
  holiday: "bg-amber-500/15 text-amber-300",
  reminder: "bg-emerald-500/15 text-emerald-300",
};
const NOTE_DOT: Record<CalendarCategory, string> = {
  event: "bg-sky-400",
  holiday: "bg-amber-400",
  reminder: "bg-emerald-400",
};

interface Draft {
  id: string | null; // null = new note
  title: string;
  note: string;
  from: string;
  to: string;
  category: CalendarCategory;
  notifyStaff: boolean;
}

function noteDates(n: CalendarNote): string {
  return n.from === n.to ? fmtDate(n.from) : `${fmtDate(n.from)} – ${fmtDate(n.to)}`;
}

export function AdminLeaveCalendar() {
  const today = todayISO();
  const [offset, setOffset] = useState(0);
  const apps = useAdminLeaveApps();

  const base = new Date();
  const view = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  const year = view.getFullYear();
  const month = view.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = view.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  // Company notes (visible to every staff member).
  const { notes, reload } = useCalendarNotes(year, month);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<CalendarNote | null>(null);

  const openNew = (date: string) => {
    setFormError("");
    setDraft({ id: null, title: "", note: "", from: date, to: date, category: "event", notifyStaff: true });
  };
  const openEdit = (n: CalendarNote) => {
    setFormError("");
    setDraft({ id: n.id, title: n.title, note: n.note, from: n.from, to: n.to, category: n.category, notifyStaff: false });
  };

  const save = async () => {
    if (!draft || saving) return;
    if (!draft.title.trim()) return setFormError("Please enter a title.");
    if (!draft.from) return setFormError("Please choose a date.");
    if (draft.to && draft.to < draft.from) return setFormError("End date must be on or after the start date.");
    setSaving(true);
    setFormError("");
    try {
      const input = {
        title: draft.title.trim(),
        note: draft.note.trim(),
        from: draft.from,
        to: draft.to || draft.from,
        category: draft.category,
        notifyStaff: draft.notifyStaff,
      };
      if (draft.id) await updateCalendarNote(draft.id, input);
      else await createCalendarNote(input);
      setDraft(null);
      await reload();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirmDelete) return;
    setSaving(true);
    try {
      await deleteCalendarNote(confirmDelete.id);
      setConfirmDelete(null);
      await reload();
    } finally {
      setSaving(false);
    }
  };

  // approved leaves overlapping this month
  const monthLeaves = apps.filter((a) => {
    if (a.status !== "Approved") return false;
    const start = new Date(a.from);
    const end = new Date(a.to);
    const mStart = new Date(year, month, 1);
    const mEnd = new Date(year, month + 1, 0);
    return start <= mEnd && end >= mStart;
  });

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < firstDow; i++)
    cells.push(<div key={`e${i}`} className="aspect-square" />);
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const onLeave = monthLeaves.filter((a) => isOnLeaveOn(a.from, a.to, iso));
    const dayNotes = notesOn(notes, iso);
    const isToday = iso === today;
    cells.push(
      <button
        type="button"
        key={iso}
        onClick={() => openNew(iso)}
        title={`Add a note for ${fmtDate(iso)}`}
        className={[
          "aspect-square rounded-lg border p-1 sm:p-1.5 flex flex-col text-[11px] text-left overflow-hidden transition-colors hover:border-amber-500/40",
          isToday
            ? "border-amber-500/50 bg-amber-500/5"
            : "border-white/10 bg-[#0e1320]",
        ].join(" ")}
      >
        <div className="font-mono-hr text-slate-300 font-semibold">{d}</div>
        <div className="flex-1 overflow-hidden mt-1 space-y-0.5 min-w-0">
          {dayNotes.slice(0, 1).map((n) => (
            <div
              key={n.id}
              className={`hidden sm:block truncate rounded px-1 text-[9.5px] leading-tight ${NOTE_CHIP[n.category]}`}
            >
              {n.title}
            </div>
          ))}
          {onLeave.slice(0, 2).map((a) => (
            <div
              key={a.appId}
              className="hidden sm:block truncate text-amber-300/90 text-[9.5px] leading-tight"
            >
              {a.fullName.split(" ")[0]}
            </div>
          ))}
          {dayNotes.length + onLeave.length > 3 && (
            <div className="hidden sm:block text-slate-500 text-[9px]">
              +{dayNotes.length + onLeave.length - 3} more
            </div>
          )}
          {/* Phones: dots */}
          <div className="flex gap-0.5 sm:hidden">
            {dayNotes.slice(0, 2).map((n) => (
              <span key={n.id} className={`w-1.5 h-1.5 rounded-full ${NOTE_DOT[n.category]}`} />
            ))}
            {onLeave.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-amber-300/70" />}
          </div>
        </div>
      </button>,
    );
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            Leave Calendar
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Approved leave and company notes. Tap a day to add a note for all staff.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <AdminBtn onClick={() => openNew(today)}>
            <Plus className="w-4 h-4" /> Add note
          </AdminBtn>
          <AdminBtn
            variant="secondary"
            onClick={() => setOffset((o) => o - 1)}
            className="!px-3 !py-2"
          >
            <ChevronLeft className="w-4 h-4" />
          </AdminBtn>
          <div className="px-3 py-2 rounded-lg border border-white/10 text-sm text-white font-medium min-w-[140px] text-center">
            {monthLabel}
          </div>
          <AdminBtn
            variant="secondary"
            onClick={() => setOffset((o) => o + 1)}
            className="!px-3 !py-2"
          >
            <ChevronRight className="w-4 h-4" />
          </AdminBtn>
        </div>
      </div>

      <Card className="p-3 sm:p-4">
        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2">
          {DOW.map((d) => (
            <div
              key={d}
              className="text-center text-[10px] uppercase tracking-wide text-slate-500 font-semibold py-1"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1 sm:gap-2">{cells}</div>
      </Card>

      <div className="mt-6">
        <div className="text-[12px] uppercase tracking-[0.08em] text-slate-400 font-semibold mb-3">
          Company Notes This Month
        </div>
        <Card className="p-4">
          {notes.length === 0 ? (
            <div className="text-center text-slate-500 text-sm py-4">
              No notes this month. Use “Add note” or tap a day.
            </div>
          ) : (
            <ul className="divide-y divide-white/5">
              {notes.map((n) => (
                <li key={n.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <span className={`mt-1.5 w-2.5 h-2.5 rounded-full flex-shrink-0 ${NOTE_DOT[n.category]}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white font-medium">{n.title}</div>
                    <div className="text-[11px] text-slate-500">
                      {noteDates(n)} · {CATEGORY_LABEL[n.category]}
                    </div>
                    {n.note && (
                      <div className="text-[13px] text-slate-300 mt-1 whitespace-pre-line break-words">{n.note}</div>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <AdminBtn variant="ghost" className="!px-2 !py-1.5" onClick={() => openEdit(n)}>
                      <Pencil className="w-4 h-4" />
                      <span className="sr-only">Edit</span>
                    </AdminBtn>
                    <AdminBtn variant="ghost" className="!px-2 !py-1.5" onClick={() => setConfirmDelete(n)}>
                      <Trash2 className="w-4 h-4 text-rose-300" />
                      <span className="sr-only">Delete</span>
                    </AdminBtn>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <div className="text-[12px] uppercase tracking-[0.08em] text-slate-400 font-semibold mb-3">
          On Leave This Month
        </div>
        <Card className="p-4">
          {monthLeaves.length === 0 ? (
            <div className="text-center text-slate-500 text-sm py-4">
              No approved leave this month.
            </div>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {monthLeaves.map((a) => (
                <li key={a.appId} className="flex items-center gap-3">
                  <Avatar name={a.fullName} size={32} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white font-medium truncate">
                      {a.fullName}
                    </div>
                    <div className="text-[11px] text-slate-500">{a.type}</div>
                  </div>
                  <div className="text-[11px] font-mono-hr text-slate-400">
                    {a.from} → {a.to}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Add / edit note */}
      {draft && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={() => !saving && setDraft(null)}>
          <div
            className="w-full sm:max-w-md bg-[#111726] border border-white/10 rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="note-dialog-title"
          >
            <div className="flex items-center justify-between p-5 border-b border-white/10">
              <h3 id="note-dialog-title" className="text-white font-semibold">
                {draft.id ? "Edit note" : "Add a note for all staff"}
              </h3>
              <button type="button" onClick={() => setDraft(null)} className="text-slate-400 hover:text-white" aria-label="Close">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <label className="block">
                <span className="block text-xs text-slate-400 mb-1.5">Title</span>
                <AdminInput
                  value={draft.title}
                  maxLength={120}
                  placeholder="e.g. Town hall meeting"
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  autoFocus
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="block text-xs text-slate-400 mb-1.5">From</span>
                  <AdminInput
                    type="date"
                    value={draft.from}
                    onChange={(e) => {
                      const from = e.target.value;
                      setDraft({ ...draft, from, to: draft.to < from ? from : draft.to });
                    }}
                  />
                </label>
                <label className="block">
                  <span className="block text-xs text-slate-400 mb-1.5">To</span>
                  <AdminInput
                    type="date"
                    value={draft.to}
                    min={draft.from}
                    onChange={(e) => setDraft({ ...draft, to: e.target.value })}
                  />
                </label>
              </div>
              <label className="block">
                <span className="block text-xs text-slate-400 mb-1.5">Type</span>
                <AdminSelect
                  value={draft.category}
                  onChange={(e) => setDraft({ ...draft, category: e.target.value as CalendarCategory })}
                >
                  {(Object.keys(CATEGORY_LABEL) as CalendarCategory[]).map((c) => (
                    <option key={c} value={c}>
                      {CATEGORY_LABEL[c]}
                    </option>
                  ))}
                </AdminSelect>
              </label>
              <label className="block">
                <span className="block text-xs text-slate-400 mb-1.5">Details (optional)</span>
                <textarea
                  rows={4}
                  maxLength={2000}
                  value={draft.note}
                  placeholder="e.g. Main hall, 3:00 pm. Attendance is compulsory."
                  onChange={(e) => setDraft({ ...draft, note: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-[#0e1320] border border-white/10 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
                />
              </label>
              {!draft.id && (
                <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={draft.notifyStaff}
                    onChange={(e) => setDraft({ ...draft, notifyStaff: e.target.checked })}
                  />
                  Notify all staff
                </label>
              )}
              {formError && <p className="text-xs text-rose-300">{formError}</p>}
            </div>
            <div className="flex gap-3 p-5 border-t border-white/10">
              <AdminBtn variant="secondary" className="flex-1" onClick={() => setDraft(null)} disabled={saving}>
                Cancel
              </AdminBtn>
              <AdminBtn className="flex-1" onClick={() => void save()} disabled={saving}>
                {saving ? "Saving…" : draft.id ? "Save changes" : "Add note"}
              </AdminBtn>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => !saving && setConfirmDelete(null)}>
          <div className="w-full max-w-sm bg-[#111726] border border-white/10 rounded-2xl p-5" onClick={(e) => e.stopPropagation()} role="alertdialog" aria-modal="true">
            <h3 className="text-white font-semibold mb-2">Delete this note?</h3>
            <p className="text-sm text-slate-400 mb-5">
              “{confirmDelete.title}” ({noteDates(confirmDelete)}) will be removed from every staff calendar.
            </p>
            <div className="flex gap-3">
              <AdminBtn variant="secondary" className="flex-1" onClick={() => setConfirmDelete(null)} disabled={saving}>
                Cancel
              </AdminBtn>
              <AdminBtn variant="danger" className="flex-1" onClick={() => void remove()} disabled={saving}>
                {saving ? "Deleting…" : "Delete"}
              </AdminBtn>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
