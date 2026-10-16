import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  Card,
  EmptyState,
  StatusBadge,
  Avatar,
  AdminBtn,
  AdminInput,
  AdminSelect,
} from "@/components/admin/ui";
import { getAllLeaveApplications } from "@/lib/admin-store";
import { fmtDate } from "@/lib/hr-store";

const PAGE_SIZE = 8;

export function AdminLeaveRecords() {
  const [employee, setEmployee] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [page, setPage] = useState(1);

  const apps = useMemo(() => getAllLeaveApplications(), []);

  const employeeOptions = useMemo(() => {
    const map = new Map<string, string>();
    apps.forEach((a) => map.set(a.username, a.fullName));
    return Array.from(map.entries());
  }, [apps]);

  const years = useMemo(() => {
    const set = new Set<number>();
    apps.forEach((a) => set.add(new Date(a.from).getFullYear()));
    return Array.from(set).sort((a, b) => b - a);
  }, [apps]);

  const filtered = apps.filter((a) => {
    const matchEmp = employee === "all" || a.username === employee;
    const matchType = typeFilter === "all" || a.type === typeFilter;
    const matchStatus = statusFilter === "all" || a.status === statusFilter;
    const d = new Date(a.from);
    const matchMonth =
      monthFilter === "all" || d.getMonth() === Number(monthFilter);
    const matchYear =
      yearFilter === "all" || d.getFullYear() === Number(yearFilter);
    return matchEmp && matchType && matchStatus && matchMonth && matchYear;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE,
  );

  const resetPage = () => setPage(1);

  return (
    <AdminLayout>
      <div className="mb-5">
        <h2 className="text-xl sm:text-2xl font-bold text-white">
          Leave Records
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          All past and current leave applications across the company.
        </p>
      </div>

      <Card className="p-4 mb-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <AdminSelect
            value={employee}
            onChange={(e) => {
              setEmployee(e.target.value);
              resetPage();
            }}
          >
            <option value="all">All Employees</option>
            {employeeOptions.map(([u, name]) => (
              <option key={u} value={u}>
                {name}
              </option>
            ))}
          </AdminSelect>
          <AdminSelect
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value);
              resetPage();
            }}
          >
            <option value="all">All Types</option>
            <option value="Annual">Annual</option>
            <option value="Medical">Medical</option>
            <option value="Emergency">Emergency</option>
          </AdminSelect>
          <AdminSelect
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              resetPage();
            }}
          >
            <option value="all">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
          </AdminSelect>
          <AdminSelect
            value={monthFilter}
            onChange={(e) => {
              setMonthFilter(e.target.value);
              resetPage();
            }}
          >
            <option value="all">All Months</option>
            {[
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
            ].map((m, i) => (
              <option key={m} value={i}>
                {m}
              </option>
            ))}
          </AdminSelect>
          <AdminSelect
            value={yearFilter}
            onChange={(e) => {
              setYearFilter(e.target.value);
              resetPage();
            }}
          >
            <option value="all">All Years</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </AdminSelect>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13.5px] min-w-[760px]">
            <thead>
              <tr className="border-b border-white/10">
                {[
                  "Employee",
                  "Department",
                  "Type",
                  "Period",
                  "Days",
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
              {pageItems.length === 0 ? (
                <tr>
                  <td colSpan={6}>
                    <EmptyState>No records match your filters.</EmptyState>
                  </td>
                </tr>
              ) : (
                pageItems.map((a) => (
                  <tr
                    key={a.appId}
                    className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={a.fullName} size={30} />
                        <span className="font-medium text-white">
                          {a.fullName}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{a.department}</td>
                    <td className="px-4 py-3 text-slate-300">{a.type}</td>
                    <td className="px-4 py-3 font-mono-hr text-slate-300">
                      {fmtDate(a.from)} → {fmtDate(a.to)}
                    </td>
                    <td className="px-4 py-3 font-mono-hr text-slate-300">
                      {a.days}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={a.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <div className="text-[12px] text-slate-400">
          Showing {filtered.length === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1}–
          {Math.min(safePage * PAGE_SIZE, filtered.length)} of {filtered.length}
        </div>
        <div className="flex items-center gap-2">
          <AdminBtn
            variant="secondary"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="!px-3 !py-2"
          >
            <ChevronLeft className="w-4 h-4" />
          </AdminBtn>
          <span className="text-[12px] text-slate-300 font-mono-hr">
            {safePage} / {totalPages}
          </span>
          <AdminBtn
            variant="secondary"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="!px-3 !py-2"
          >
            <ChevronRight className="w-4 h-4" />
          </AdminBtn>
        </div>
      </div>
    </AdminLayout>
  );
}
