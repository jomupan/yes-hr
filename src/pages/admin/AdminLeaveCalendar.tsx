import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, Avatar, AdminBtn } from "@/components/admin/ui";
import { getAllLeaveApplications, isOnLeaveOn } from "@/lib/admin-store";
import { todayISO } from "@/lib/hr-store";

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function AdminLeaveCalendar() {
  const today = todayISO();
  const [offset, setOffset] = useState(0);
  const apps = useMemo(() => getAllLeaveApplications(), []);

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
    const isToday = iso === today;
    cells.push(
      <div
        key={iso}
        className={[
          "aspect-square rounded-lg border p-1.5 flex flex-col text-[11px]",
          isToday
            ? "border-amber-500/50 bg-amber-500/5"
            : "border-white/10 bg-[#0e1320]",
        ].join(" ")}
      >
        <div className="font-mono-hr text-slate-300 font-semibold">{d}</div>
        <div className="flex-1 overflow-hidden mt-1 space-y-0.5">
          {onLeave.slice(0, 2).map((a) => (
            <div
              key={a.appId}
              className="truncate text-amber-300/90 text-[9.5px] leading-tight"
            >
              {a.fullName.split(" ")[0]}
            </div>
          ))}
          {onLeave.length > 2 && (
            <div className="text-slate-500 text-[9px]">
              +{onLeave.length - 2} more
            </div>
          )}
        </div>
      </div>,
    );
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            Leave Calendar
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Approved leave across the team this month.
          </p>
        </div>
        <div className="flex items-center gap-2">
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

      <Card className="p-4">
        <div className="grid grid-cols-7 gap-2 mb-2">
          {DOW.map((d) => (
            <div
              key={d}
              className="text-center text-[10px] uppercase tracking-wide text-slate-500 font-semibold py-1"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">{cells}</div>
      </Card>

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
    </AdminLayout>
  );
}
