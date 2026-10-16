import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Calendar } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, EmptyState, Avatar } from "@/components/admin/ui";
import {
  getEmployeeAttendance,
  employeeIdOf,
  departmentOf,
  companyOf,
  type AdminAttendanceRow,
} from "@/lib/admin-store";
import { getUser } from "@/lib/hr-store";
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

  const profile = useMemo(
    () => (username ? getUser(username) : null),
    [username],
  );
  const allRecords = useMemo(
    () => (username ? getEmployeeAttendance(username) : []),
    [username],
  );

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

      {!profile ? (
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
                {employeeIdOf(profile)} · {departmentOf(profile)} ·{" "}
                {companyOf(profile)}
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
                            {r.record.clockOut
                              ? fmtTime(r.record.clockOut)
                              : "-"}
                          </td>
                          <td className="px-4 py-3">
                            <AdminSelfieThumb
                              src={clockOutSelfie}
                              onZoom={setLightbox}
                            />
                          </td>
                          <td className="px-4 py-3 font-mono-hr text-slate-300">
                            {r.hours == null ? (
                              <span className="text-amber-300">
                                In Progress
                              </span>
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
