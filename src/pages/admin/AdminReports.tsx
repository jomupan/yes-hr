import { useMemo } from "react";
import {
  BarChart3,
  PieChart as PieIcon,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
} from "recharts";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, SectionTitle, Avatar } from "@/components/admin/ui";
import { getAdminEmployees } from "@/lib/admin-store";
import { useAdminDirectory } from "@/lib/api-admin";
import { useAdminLeaveApps } from "@/lib/api-hr";
import { isAccountActive } from "@/lib/account-status";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
const PIE_COLORS = ["#f59e0b", "#22c55e", "#ef4444"];

export function AdminReports() {
  const apps = useAdminLeaveApps();
  const directory = useAdminDirectory();
  const employees = useMemo(() => getAdminEmployees(), [directory]);

  // Applications by month (current year)
  const year = new Date().getFullYear();
  const byMonth = MONTHS.map((m, i) => {
    const count = apps.filter((a) => {
      const d = new Date(a.from);
      return d.getFullYear() === year && d.getMonth() === i;
    }).length;
    return { month: m, applications: count };
  });

  // Leave type distribution
  const typeCounts = ["Annual", "Medical", "Emergency"]
    .map((t) => ({
      name: t,
      value: apps.filter((a) => a.type === t).length,
    }))
    .filter((x) => x.value > 0);

  // Approved vs rejected
  const approvedVsRejected = [
    {
      name: "Approved",
      value: apps.filter((a) => a.status === "Approved").length,
    },
    {
      name: "Rejected",
      value: apps.filter((a) => a.status === "Rejected").length,
    },
    {
      name: "Pending",
      value: apps.filter((a) => a.status === "Pending").length,
    },
  ].filter((x) => x.value > 0);

  // Highest leave usage (approved days per employee)
  const usage = employees
    .map((e) => {
      const days = e.leave.applications
        .filter((a) => a.status === "Approved")
        .reduce(
          (s, a) =>
            s +
            (Math.floor(
              (new Date(a.to).getTime() - new Date(a.from).getTime()) /
                86400000,
            ) +
              1),
          0,
        );
      return { name: e.profile.fullName, days };
    })
    .filter((x) => x.days > 0)
    .sort((a, b) => b.days - a.days)
    .slice(0, 5);

  const tooltipStyle = {
    backgroundColor: "#0e1320",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "8px",
    color: "#e2e8f0",
    fontSize: "12px",
  };

  return (
    <AdminLayout>
      <div className="mb-5">
        <h2 className="text-xl sm:text-2xl font-bold text-white">Reports</h2>
        <p className="text-slate-400 text-sm mt-1">
          Leave analytics and trends across the organization.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Applications by month */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">
              Leave Applications by Month ({year})
            </h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={byMonth}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255,255,255,0.06)"
                vertical={false}
              />
              <XAxis
                dataKey="month"
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="#64748b"
                fontSize={11}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                cursor={{ fill: "rgba(255,255,255,0.03)" }}
              />
              <Bar
                dataKey="applications"
                fill="#f59e0b"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Leave type distribution */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <PieIcon className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">
              Leave Types Distribution
            </h3>
          </div>
          {typeCounts.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-slate-500 text-sm">
              No data yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={typeCounts}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={45}
                  paddingAngle={3}
                >
                  {typeCounts.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: "12px", color: "#94a3b8" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Approved vs rejected */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">
              Application Status Breakdown
            </h3>
          </div>
          {approvedVsRejected.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-slate-500 text-sm">
              No data yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={approvedVsRejected}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  innerRadius={45}
                  paddingAngle={3}
                >
                  {approvedVsRejected.map((_, i) => (
                    <Cell
                      key={i}
                      fill={["#22c55e", "#ef4444", "#f59e0b"][i % 3]}
                    />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: "12px", color: "#94a3b8" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Highest usage */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-semibold text-white">
              Highest Leave Usage
            </h3>
          </div>
          {usage.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-slate-500 text-sm">
              No approved leave yet.
            </div>
          ) : (
            <ul className="space-y-3">
              {usage.map((u, i) => (
                <li key={u.name} className="flex items-center gap-3">
                  <span className="w-5 text-center text-[12px] font-mono-hr text-slate-500">
                    {i + 1}
                  </span>
                  <Avatar name={u.name} size={30} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{u.name}</div>
                    <div className="h-1.5 rounded-full bg-white/5 mt-1 overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full"
                        style={{ width: `${(u.days / usage[0].days) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="font-mono-hr text-sm text-amber-300">
                    {u.days}d
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <SectionTitle>Summary</SectionTitle>
      <Card className="p-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
          <SummaryStat label="Total Applications" value={apps.length} />
          <SummaryStat
            label="Approved"
            value={apps.filter((a) => a.status === "Approved").length}
          />
          <SummaryStat
            label="Pending"
            value={apps.filter((a) => a.status === "Pending").length}
          />
          <SummaryStat
            label="Active Employees"
            value={employees.filter((e) => isAccountActive(e.profile)).length}
          />
        </div>
      </Card>
    </AdminLayout>
  );
}

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-mono-hr text-2xl font-semibold text-white">
        {value}
      </div>
      <div className="text-[11px] text-slate-400 mt-1">{label}</div>
    </div>
  );
}
