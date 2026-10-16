import {
  Inbox,
  CheckCircle2,
  XCircle,
  Users,
  CalendarCheck,
  CalendarClock,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  StatCard,
  SectionTitle,
  Card,
  EmptyState,
  StatusBadge,
  Avatar,
  AdminBtn,
} from "@/components/admin/ui";
import { getAdminEmployees, isOnLeaveOn } from "@/lib/admin-store";
import { useAdminDirectory } from "@/lib/api-admin";
import { useAdminLeaveApps } from "@/lib/api-hr";
import { fmtDate, todayISO, daysBetween } from "@/lib/hr-store";
import { isAccountActive } from "@/lib/account-status";
import { useNavigate } from "react-router-dom";

export function AdminDashboard() {
  const navigate = useNavigate();
  const apps = useAdminLeaveApps();
  useAdminDirectory(); // re-render when the server's employee list arrives
  const employees = getAdminEmployees();

  const pending = apps.filter((a) => a.status === "Pending").length;
  const approved = apps.filter((a) => a.status === "Approved").length;
  const rejected = apps.filter((a) => a.status === "Rejected").length;
  // Active employees only — inactive (removed) staff are excluded from the
  // count so the dashboard never overstates the current workforce.
  const activeEmployees = employees.filter((e) =>
    isAccountActive(e.profile),
  ).length;

  const today = todayISO();
  const onLeaveToday = apps.filter(
    (a) => a.status === "Approved" && isOnLeaveOn(a.from, a.to, today),
  );
  const upcoming = apps
    .filter(
      (a) =>
        a.status === "Approved" &&
        new Date(a.from) > new Date(today) &&
        daysBetween(today, a.from) <= 7,
    )
    .sort((a, b) => new Date(a.from).getTime() - new Date(b.from).getTime())
    .slice(0, 5);

  const recent = apps.slice(0, 6);

  return (
    <AdminLayout>
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-white">
          Welcome back, Admin 👋
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          Here's your leave management overview for today.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Pending Applications"
          value={pending}
          icon={Inbox}
          highlight
          sub="Needs your attention"
        />
        <StatCard label="Approved Leave" value={approved} icon={CheckCircle2} />
        <StatCard label="Rejected Leave" value={rejected} icon={XCircle} />
        <StatCard
          label="Active Employees"
          value={activeEmployees}
          icon={Users}
        />
      </div>

      <SectionTitle>Recent Leave Applications</SectionTitle>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13.5px] min-w-[640px]">
            <thead>
              <tr className="border-b border-white/10">
                {[
                  "Employee",
                  "Leave Type",
                  "Start Date",
                  "End Date",
                  "Total Days",
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
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState>No leave applications yet.</EmptyState>
                  </td>
                </tr>
              ) : (
                recent.map((a) => (
                  <tr
                    key={a.appId}
                    className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={a.fullName} size={30} />
                        <div>
                          <div className="font-medium text-white">
                            {a.fullName}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {a.department}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{a.type}</td>
                    <td className="px-4 py-3 font-mono-hr text-slate-300">
                      {fmtDate(a.from)}
                    </td>
                    <td className="px-4 py-3 font-mono-hr text-slate-300">
                      {fmtDate(a.to)}
                    </td>
                    <td className="px-4 py-3 font-mono-hr text-slate-300">
                      {a.days} {a.days === 1 ? "Day" : "Days"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-4 py-3">
                      <AdminBtn
                        variant="ghost"
                        onClick={() => navigate("/admin/leave-requests")}
                      >
                        View
                      </AdminBtn>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <SectionTitle>Employees On Leave Today</SectionTitle>
          <Card className="p-4">
            {onLeaveToday.length === 0 ? (
              <EmptyState>No employees on leave today.</EmptyState>
            ) : (
              <ul className="space-y-3">
                {onLeaveToday.map((a) => (
                  <li key={a.appId} className="flex items-center gap-3">
                    <Avatar name={a.fullName} size={36} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white font-medium truncate">
                        {a.fullName}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        {a.department} · {a.type}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-[11px] text-amber-300">
                        <CalendarCheck className="w-3 h-3" /> Returns{" "}
                        {fmtDate(addDays(a.to, 1))}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div>
          <SectionTitle>Upcoming Leave</SectionTitle>
          <Card className="p-4">
            {upcoming.length === 0 ? (
              <EmptyState>No upcoming leave in the next 7 days.</EmptyState>
            ) : (
              <ul className="space-y-3">
                {upcoming.map((a) => (
                  <li key={a.appId} className="flex items-center gap-3">
                    <Avatar name={a.fullName} size={36} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm text-white font-medium truncate">
                        {a.fullName}
                      </div>
                      <div className="text-[11px] text-slate-500">{a.type}</div>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-400">
                      <CalendarClock className="w-3 h-3" /> Starts{" "}
                      {fmtDate(a.from)}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
