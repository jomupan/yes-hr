import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Search,
  Users,
  UserCheck,
  Clock3,
  UserX,
  LogIn,
  Hourglass,
  Download,
  Eye,
  RefreshCw,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  Card,
  EmptyState,
  Avatar,
  AdminInput,
  AdminSelect,
  StatCard,
} from "@/components/admin/ui";
import type { AdminAttendanceRow, AttendanceSummary } from "@/lib/admin-store";
import { fetchAttendanceForDate } from "@/lib/api-attendance";
import { useNavigate } from "react-router-dom";
import { fmtDate, fmtTime, todayISO } from "@/lib/hr-store";
import { AttendanceDetailsModal } from "@/components/admin/AttendanceDetailsModal";

type StatusFilter =
  | "all"
  | "Present"
  | "Late"
  | "Completed"
  | "Currently Working"
  | "Not Clocked In";

const EMPTY_SUMMARY: AttendanceSummary = {
  totalActive: 0,
  present: 0,
  late: 0,
  notClockedIn: 0,
  clockedOut: 0,
  currentlyWorking: 0,
};

/* Re-check the server this often while the page is open, so new clock-ins
   from staff phones appear without pressing Refresh. */
const AUTO_REFRESH_MS = 60_000;

export function AdminAttendance() {
  const navigate = useNavigate();
  const [date, setDate] = useState(todayISO());
  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selected, setSelected] = useState<AdminAttendanceRow | null>(null);
  const [rows, setRows] = useState<AdminAttendanceRow[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary>(EMPTY_SUMMARY);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>(() =>
    new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    }),
  );

  // Monotonic request id guards against race conditions: if a newer fetch is
  // started before an older one resolves, the older one's result is discarded
  // so stale data can never overwrite fresh data.
  const reqIdRef = useRef(0);

  // Single shared fetch used by initial load, Refresh, date changes and the
  // auto-refresh. Reads from the server, so clock-ins from any device show.
  const fetchAttendance = useCallback(async () => {
    const myId = ++reqIdRef.current;
    setRefreshing(true);
    setRefreshError(false);
    try {
      const res = await fetchAttendanceForDate(date);
      // A newer request started — discard this stale result.
      if (myId !== reqIdRef.current) return;
      setRows(res.rows);
      setSummary(res.summary);
      setLastUpdated(
        new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    } catch {
      if (myId === reqIdRef.current) setRefreshError(true);
    } finally {
      if (myId === reqIdRef.current) setRefreshing(false);
    }
  }, [date]);

  // Load on open and whenever the date changes.
  useEffect(() => {
    void fetchAttendance();
  }, [fetchAttendance]);

  // Keep the view fresh while the page is open and visible.
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void fetchAttendance();
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(id);
  }, [fetchAttendance]);

  const departments = useMemo(() => {
    const set = new Set(rows.map((r) => r.department).filter(Boolean));
    return ["all", ...Array.from(set).sort()];
  }, [rows]);

  const filtered = rows.filter((r) => {
    const matchSearch =
      !search ||
      r.fullName.toLowerCase().includes(search.toLowerCase()) ||
      r.employeeId.toLowerCase().includes(search.toLowerCase()) ||
      r.username.toLowerCase().includes(search.toLowerCase());
    const matchDept = deptFilter === "all" || r.department === deptFilter;
    const matchStatus = statusFilter === "all" || r.status === statusFilter;
    return matchSearch && matchDept && matchStatus;
  });

  const exportCsv = () => {
    const headers = [
      "Employee",
      "Employee ID",
      "Company",
      "Department",
      "Date",
      "Clock In",
      "Clock In Location",
      "Clock Out",
      "Clock Out Location",
      "Working Hours",
      "Status",
    ];
    const lines = filtered.map((r) => {
      const hours =
        !r.record.clockIn
          ? "-"
          : r.hours == null
            ? "In Progress"
            : `${r.hours.toFixed(1)} hrs`;
      return [
        r.fullName,
        r.employeeId,
        r.company,
        r.department,
        r.record.date,
        r.record.clockIn ? fmtTime(r.record.clockIn) : "-",
        r.record.location || "-",
        r.record.clockOut ? fmtTime(r.record.clockOut) : "-",
        r.record.clockOutLocation || "-",
        hours,
        r.status,
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",");
    });
    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AdminLayout>
      <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            Attendance
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Track employee clock-in / clock-out records and verification
            details.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 self-start">
          <div className="flex flex-col items-end">
            <button
              onClick={fetchAttendance}
              disabled={refreshing}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw
                className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
              />
              {refreshing ? "Refreshing..." : "Refresh Attendance"}
            </button>
            <span className="text-[11px] text-slate-500 mt-1">
              Last updated: {lastUpdated}
            </span>
          </div>
          <button
            onClick={exportCsv}
            className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 text-sm font-medium transition-colors self-start"
          >
            <Download className="w-4 h-4" /> Export CSV
          </button>
        </div>
      </div>

      {refreshError && (
        <div className="mb-4 text-[12px] text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          Unable to refresh attendance data. Please try again.
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
        <StatCard
          label="Total Employees"
          value={summary.totalActive}
          icon={Users}
        />
        <StatCard label="Present" value={summary.present} icon={UserCheck} />
        <StatCard
          label="Late"
          value={summary.late}
          icon={Clock3}
          highlight={summary.late > 0}
        />
        <StatCard
          label="Not Clocked In"
          value={summary.notClockedIn}
          icon={UserX}
          highlight={summary.notClockedIn > 0}
        />
        <StatCard
          label="Currently Working"
          value={summary.currentlyWorking}
          icon={Hourglass}
        />
        <StatCard label="Clocked Out" value={summary.clockedOut} icon={LogIn} />
      </div>

      {/* Filters */}
      <Card className="p-4 mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">
              Date
            </label>
            <input
              type="date"
              value={date}
              max={todayISO()}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#0e1320] border border-white/10 text-sm text-slate-200 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30"
            />
          </div>
          <div className="relative">
            <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">
              Search
            </label>
            <Search className="w-4 h-4 absolute left-3 top-[34px] -translate-y-1/2 text-slate-500" />
            <AdminInput
              placeholder="Name or staff ID"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">
              Department
            </label>
            <AdminSelect
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
            >
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d === "all" ? "All Departments" : d}
                </option>
              ))}
            </AdminSelect>
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">
              Status
            </label>
            <AdminSelect
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              <option value="all">All Statuses</option>
              <option value="Present">Present</option>
              <option value="Late">Late</option>
              <option value="Currently Working">Currently Working</option>
              <option value="Completed">Completed</option>
              <option value="Not Clocked In">Not Clocked In</option>
            </AdminSelect>
          </div>
        </div>
        {date === todayISO() && (
          <div className="mt-3">
            <button
              onClick={() => setDate(todayISO())}
              className="text-[12px] text-amber-300 hover:text-amber-200 font-medium"
            >
              Showing today · {fmtDate(todayISO())}
            </button>
          </div>
        )}
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13.5px] min-w-[960px]">
            <thead>
              <tr className="border-b border-white/10">
                {[
                  "Employee",
                  "Employee ID",
                  "Department",
                  "Clock In",
                  "Clock In Selfie",
                  "Clock Out",
                  "Clock Out Selfie",
                  "Hours",
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
                  <td colSpan={10}>
                    <EmptyState>
                      No attendance records found for the selected filters.
                    </EmptyState>
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr
                    key={`${r.username}-${r.record.date}`}
                    className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={r.fullName} size={30} />
                        <div>
                          <div className="font-medium text-white">
                            {r.fullName}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {r.username}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono-hr text-slate-300">
                      {r.employeeId}
                    </td>
                    <td className="px-4 py-3 text-slate-300">{r.department}</td>
                    <td className="px-4 py-3 font-mono-hr text-slate-300">
                      {r.record.clockIn ? fmtTime(r.record.clockIn) : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <RowSelfie
                        src={
                          r.record.clockInSelfie ||
                          (r.record.selfie &&
                          r.record.selfie.startsWith("data:")
                            ? r.record.selfie
                            : "")
                        }
                        onZoom={setLightbox}
                      />
                    </td>
                    <td className="px-4 py-3 font-mono-hr text-slate-300">
                      {r.record.clockOut ? fmtTime(r.record.clockOut) : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <RowSelfie
                        src={r.record.clockOutSelfie || ""}
                        onZoom={setLightbox}
                      />
                    </td>
                    <td className="px-4 py-3 font-mono-hr text-slate-300">
                      {!r.record.clockIn ? (
                        <span className="text-slate-600">—</span>
                      ) : r.hours == null ? (
                        <span className="text-amber-300">In Progress</span>
                      ) : (
                        `${r.hours.toFixed(1)} hrs`
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <AttendanceStatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setSelected(r)}
                        className="inline-flex items-center gap-1 text-amber-300 hover:text-amber-200 text-[12px] font-medium"
                      >
                        <Eye className="w-3.5 h-3.5" /> View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* All records count */}
      <div className="mt-4 text-[12px] text-slate-500">
        Showing {filtered.length} of {rows.length} record
        {rows.length === 1 ? "" : "s"} for {fmtDate(date)}.
      </div>

      {selected && (
        <AttendanceDetailsModal
          row={selected}
          onViewHistory={() => {
            navigate(`/admin/attendance/employee/${selected.username}`);
            setSelected(null);
          }}
          onClose={() => setSelected(null)}
        />
      )}

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

export function AttendanceStatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    Present: { bg: "rgba(34,197,94,0.15)", color: "#4ade80" },
    Late: { bg: "rgba(217,119,6,0.15)", color: "#fbbf24" },
    Completed: { bg: "rgba(59,130,246,0.15)", color: "#60a5fa" },
    "Currently Working": { bg: "rgba(245,158,11,0.15)", color: "#fbbf24" },
    "Not Clocked In": { bg: "rgba(239,68,68,0.15)", color: "#f87171" },
  };
  const s = map[status] || { bg: "rgba(148,163,184,0.15)", color: "#94a3b8" };
  return (
    <span
      className="inline-block px-2.5 py-[3px] rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={{ background: s.bg, color: s.color }}
    >
      {status}
    </span>
  );
}

/* Small selfie thumbnail with a zoom-on-click lightbox. */
function RowSelfie({
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
