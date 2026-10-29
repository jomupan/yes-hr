import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Calendar, Pencil, X } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, EmptyState, Avatar, AdminBtn, AdminInput } from "@/components/admin/ui";
import type { AdminAttendanceRow } from "@/lib/admin-store";
import type { UserProfile } from "@/lib/hr-types";
import { fetchEmployeeAttendance, setClockOutTime } from "@/lib/api-attendance";
import { fmtDate, fmtTime } from "@/lib/hr-store";
import { AttendanceStatusBadge } from "./AdminAttendance";

export function AdminAttendanceEmployee() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const [range, setRange] = useState<{ from: string; to: string }>({
    from: "",
    to: "",
  });
  const [lightbox, setLightbox] = useState<string | null>(null);
  // Row whose clock-out time HR is filling in (staff forgot to clock out).
  const [fixing, setFixing] = useState<AdminAttendanceRow | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  // Loaded from the server so records from every device are included.
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [allRecords, setAllRecords] = useState<AdminAttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    if (reloadTick === 0) setLoading(true);
    fetchEmployeeAttendance(username)
      .then((res) => {
        if (cancelled) return;
        setProfile(res.profile);
        setAllRecords(res.rows);
      })
      .catch(() => {
        if (!cancelled) setProfile(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [username, reloadTick]);

  const filtered = allRecords.filter((r) => {
    if (range.from && r.record.date < range.from) return false;
    if (range.to && r.record.date > range.to) return false;
    return true;
  });

  const totalHours = filtered.reduce((s, r) => s + (r.hours ?? 0), 0);
  const presentCount = filtered.filter(
    (r) => r.status === "Present" || r.status === "Completed",
  ).length;
  const lateCount = filtered.filter((r) => r.status === "Late").length;

  return (
    <AdminLayout>
      <button
        onClick={() => navigate("/admin/attendance")}
        className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-sm mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Attendance
      </button>

      {loading ? (
        <Card className="p-6">
          <EmptyState>Loading attendance…</EmptyState>
        </Card>
      ) : !profile ? (
        <Card className="p-6">
          <EmptyState>Employee not found.</EmptyState>
        </Card>
      ) : (
        <>
          {/* Employee header */}
          <div className="flex items-center gap-4 mb-5">
            <Avatar name={profile.fullName} size={56} />
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white">
                {profile.fullName}
              </h2>
              <div className="text-slate-400 text-sm mt-0.5">
                {profile.employeeId} · {profile.department} ·{" "}
                {profile.company}
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <MiniStat label="Total Records" value={String(filtered.length)} />
            <MiniStat
              label="Present / Completed"
              value={String(presentCount)}
            />
            <MiniStat label="Late" value={String(lateCount)} />
          </div>

          {/* Date range filter */}
          <Card className="p-4 mb-5">
            <div className="flex items-center gap-2 mb-3 text-slate-300 text-sm">
              <Calendar className="w-4 h-4 text-amber-400" /> Date Range
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">
                  From
                </label>
                <input
                  type="date"
                  value={range.from}
                  onChange={(e) =>
                    setRange((r) => ({ ...r, from: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#0e1320] border border-white/10 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
                />
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">
                  To
                </label>
                <input
                  type="date"
                  value={range.to}
                  onChange={(e) =>
                    setRange((r) => ({ ...r, to: e.target.value }))
                  }
                  className="w-full px-3 py-2 rounded-lg bg-[#0e1320] border border-white/10 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => setRange({ from: "", to: "" })}
                  className="w-full px-3 py-2 rounded-lg border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 text-sm transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          </Card>

          {/* Records table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13.5px] min-w-[860px]">
                <thead>
                  <tr className="border-b border-white/10">
                    {[
                      "Date",
                      "Clock In",
                      "Clock In Selfie",
                      "Clock Out",
                      "Clock Out Selfie",
                      "Hours",
                      "Status",
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
                        <EmptyState>
                          No attendance records for this employee.
                        </EmptyState>
                      </td>
                    </tr>
                  ) : (
                    filtered.map((r: AdminAttendanceRow) => {
                      const clockInSelfie =
                        r.record.clockInSelfie ||
                        (r.record.selfie && r.record.selfie.startsWith("data:")
                          ? r.record.selfie
                          : "");
                      const clockOutSelfie = r.record.clockOutSelfie || "";
                      return (
                        <tr
                          key={r.record.date}
                          className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.02]"
                        >
                          <td className="px-4 py-3 font-mono-hr text-slate-300">
                            {fmtDate(r.record.date)}
                          </td>
                          <td className="px-4 py-3 font-mono-hr text-slate-300">
                            {r.record.clockIn ? fmtTime(r.record.clockIn) : "-"}
                          </td>
                          <td className="px-4 py-3">
                            <AdminSelfieThumb
                              src={clockInSelfie}
                              onZoom={setLightbox}
                            />
                          </td>
                          <td className="px-4 py-3 font-mono-hr text-slate-300">
                            {r.record.clockOut ? (
                              <div className="flex items-center gap-1.5">
                                {fmtTime(r.record.clockOut)}
                                {r.record.clockOutByAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => setFixing(r)}
                                    className="text-[10.5px] font-sans text-slate-500 hover:text-amber-300 inline-flex items-center gap-0.5"
                                    title={`Set by ${r.record.clockOutByAdmin}. Click to change.`}
                                  >
                                    (set by HR <Pencil className="w-3 h-3" />)
                                  </button>
                                )}
                              </div>
                            ) : r.status === "Missed Clock-Out" ? (
                              <button
                                type="button"
                                onClick={() => setFixing(r)}
                                className="font-sans text-[12px] font-semibold text-amber-300 border border-amber-500/40 rounded-md px-2 py-1 hover:bg-amber-500/10"
                              >
                                Set time
                              </button>
                            ) : (
                              "-"
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <AdminSelfieThumb
                              src={clockOutSelfie}
                              onZoom={setLightbox}
                            />
                          </td>
                          <td className="px-4 py-3 font-mono-hr text-slate-300">
                            {r.hours == null ? (
                              r.status === "Missed Clock-Out" ? (
                                <span className="text-rose-300">-</span>
                              ) : (
                                <span className="text-amber-300">
                                  In Progress
                                </span>
                              )
                            ) : (
                              `${r.hours.toFixed(1)} hrs`
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <AttendanceStatusBadge status={r.status} />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="mt-4 text-[12px] text-slate-500">
            Total working hours in range: {totalHours.toFixed(1)} hrs
          </div>
        </>
      )}

      {fixing && (
        <SetClockOutModal
          row={fixing}
          onClose={() => setFixing(null)}
          onSaved={() => {
            setFixing(null);
            setReloadTick((t) => t + 1);
          }}
        />
      )}

      {/* Full-size selfie lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt="Attendance selfie (full size)"
            className="max-w-[92vw] max-h-[88vh] rounded-[10px] shadow-2xl"
          />
        </div>
      )}
    </AdminLayout>
  );
}

/* Small selfie thumbnail with a zoom-on-click lightbox. */
function AdminSelfieThumb({
  src,
  onZoom,
}: {
  src: string;
  onZoom: (s: string) => void;
}) {
  if (!src) {
    return <span className="text-[12px] text-slate-600 italic">—</span>;
  }
  return (
    <button
      onClick={() => onZoom(src)}
      className="block rounded-[6px] overflow-hidden border border-white/10 hover:border-amber-400/40 transition-colors"
      title="View selfie"
    >
      <img
        src={src}
        alt="Attendance selfie"
        className="w-[44px] h-[44px] object-cover"
      />
    </button>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#111726] border border-white/10 rounded-[10px] p-3 text-center">
      <div className="font-mono-hr text-lg font-semibold text-white">
        {value}
      </div>
      <div className="text-[11px] text-slate-400 mt-0.5">{label}</div>
    </div>
  );
}

/** HR fills in the clock-out time for a day the staff member forgot. */
function SetClockOutModal({
  row,
  onClose,
  onSaved,
}: {
  row: AdminAttendanceRow;
  onClose: () => void;
  onSaved: () => void;
}) {
  const current = row.record.clockOut ? fmtTime(row.record.clockOut) : "17:30";
  const [time, setTime] = useState(/^\d{2}:\d{2}$/.test(current) ? current : "17:30");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (saving || !row.record.id) return;
    setSaving(true);
    setError("");
    try {
      await setClockOutTime(row.record.id, time);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="bg-[#111726] border border-white/10 rounded-[14px] w-full max-w-[400px] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sco-title"
      >
        <div className="flex items-start justify-between p-5 border-b border-white/10">
          <div>
            <h3 id="sco-title" className="text-base font-bold text-white">Set Clock-Out Time</h3>
            <div className="text-[12px] text-slate-400 mt-0.5">
              {fmtDate(row.record.date)} · clocked in at {fmtTime(row.record.clockIn)}
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">
          <label htmlFor="sco-time" className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
            Clock-out time
          </label>
          <AdminInput id="sco-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          <p className="text-[11.5px] text-slate-500 mt-2">
            The record will show this was set by HR, and the staff member is notified.
          </p>
          {error && <p className="text-xs text-rose-300 mt-3">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-white/10">
          <AdminBtn variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </AdminBtn>
          <AdminBtn variant="primary" onClick={() => void save()} disabled={saving || !time}>
            {saving ? "Saving…" : "Save"}
          </AdminBtn>
        </div>
      </div>
    </div>
  );
}
