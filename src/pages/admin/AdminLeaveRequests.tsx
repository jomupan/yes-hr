import { useMemo, useState } from "react";
import { Search, X, Check, FileText, Download } from "lucide-react";
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
import {
  getAllLeaveApplications,
  setLeaveStatus,
  type AdminLeaveRow,
} from "@/lib/admin-store";
import { downloadAttachment, fmtDate } from "@/lib/hr-store";
import { useAdminSession } from "@/hooks/use-admin-session";

export function AdminLeaveRequests() {
  const session = useAdminSession();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<AdminLeaveRow | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [tick, setTick] = useState(0);

  const apps = useMemo(() => getAllLeaveApplications(), [tick]);

  const filtered = apps.filter((a) => {
    const matchSearch =
      !search ||
      a.fullName.toLowerCase().includes(search.toLowerCase()) ||
      a.department.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || a.type === typeFilter;
    const matchStatus = statusFilter === "all" || a.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  const approve = () => {
    if (!selected) return;
    setLeaveStatus(selected.username, selected.appId, "Approved");
    setSelected(null);
    setTick((t) => t + 1);
    session.refresh();
  };

  const confirmReject = () => {
    if (!selected) return;
    setLeaveStatus(
      selected.username,
      selected.appId,
      "Rejected",
      rejectReason.trim() || undefined,
    );
    setRejecting(false);
    setRejectReason("");
    setSelected(null);
    setTick((t) => t + 1);
    session.refresh();
  };

  return (
    <AdminLayout>
      <div className="mb-5">
        <h2 className="text-xl sm:text-2xl font-bold text-white">
          Leave Requests
        </h2>
        <p className="text-slate-400 text-sm mt-1">
          Review and approve or reject pending leave applications.
        </p>
      </div>

      {/* Filters */}
      <Card className="p-4 mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <AdminInput
              placeholder="Search employee or department"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <AdminSelect
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="all">All Leave Types</option>
            <option value="Annual">Annual</option>
            <option value="Medical">Medical</option>
            <option value="Emergency">Emergency</option>
          </AdminSelect>
          <AdminSelect
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="Pending">Pending</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
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
                  "Leave Type",
                  "Start Date",
                  "End Date",
                  "Days",
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
                  <td colSpan={8}>
                    <EmptyState>No applications match your filters.</EmptyState>
                  </td>
                </tr>
              ) : (
                filtered.map((a) => (
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
                      {fmtDate(a.from)}
                    </td>
                    <td className="px-4 py-3 font-mono-hr text-slate-300">
                      {fmtDate(a.to)}
                    </td>
                    <td className="px-4 py-3 font-mono-hr text-slate-300">
                      {a.days}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="px-4 py-3">
                      <AdminBtn variant="ghost" onClick={() => setSelected(a)}>
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

      {/* Details modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={() => {
            setSelected(null);
            setRejecting(false);
            setRejectReason("");
          }}
        >
          <div
            className="bg-[#111726] border border-white/10 rounded-[14px] w-full max-w-[480px] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between p-5 border-b border-white/10">
              <div className="flex items-center gap-3">
                <Avatar name={selected.fullName} size={42} />
                <div>
                  <h3 className="text-base font-bold text-white">
                    {selected.fullName}
                  </h3>
                  <div className="text-[12px] text-slate-400">
                    {selected.department} · {selected.username}
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setSelected(null);
                  setRejecting(false);
                  setRejectReason("");
                }}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <Detail label="Leave Type" value={selected.type} />
                <Detail
                  label="Total Days"
                  value={`${selected.days} ${selected.days === 1 ? "Day" : "Days"}`}
                />
                <Detail label="Start Date" value={fmtLong(selected.from)} />
                <Detail label="End Date" value={fmtLong(selected.to)} />
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">
                  Reason
                </div>
                <div className="text-sm text-slate-200 bg-[#0e1320] border border-white/10 rounded-lg p-3">
                  {selected.reason || "—"}
                </div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">
                  Supporting Document
                </div>
                {selected.attachment ? (
                  <div className="flex items-center justify-between gap-2 text-sm text-slate-300 bg-[#0e1320] border border-white/10 rounded-lg p-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-amber-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="truncate">
                          {selected.attachment.name}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono-hr">
                          {selected.attachment.type} ·{" "}
                          {formatSize(selected.attachment.size)}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => downloadAttachment(selected.attachment!)}
                      className="flex items-center gap-1 text-amber-300 hover:text-amber-200 text-xs font-medium flex-shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                      View
                    </button>
                  </div>
                ) : (
                  <div className="text-sm text-slate-500 bg-[#0e1320] border border-white/10 rounded-lg p-3">
                    No supporting document uploaded.
                  </div>
                )}
              </div>
              {selected.status === "Rejected" && selected.rejectionReason && (
                <div>
                  <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">
                    Rejection Reason
                  </div>
                  <div className="text-sm text-rose-300 bg-rose-500/5 border border-rose-500/20 rounded-lg p-3">
                    {selected.rejectionReason}
                  </div>
                </div>
              )}
              <div className="flex items-center gap-2 pt-1">
                <span className="text-[12px] text-slate-400">
                  Current status:
                </span>
                <StatusBadge status={selected.status} />
              </div>
            </div>

            {/* Reject reason input (shown inline when rejecting) */}
            {rejecting ? (
              <div className="p-5 border-t border-white/10 space-y-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1">
                    Rejection reason (shown to staff)
                  </label>
                  <textarea
                    rows={2}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="e.g. Insufficient leave balance."
                    className="w-full px-3 py-2 rounded-lg bg-[#0e1320] border border-white/10 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/30"
                  />
                </div>
                <div className="flex gap-3">
                  <AdminBtn
                    variant="secondary"
                    className="flex-1"
                    onClick={() => {
                      setRejecting(false);
                      setRejectReason("");
                    }}
                  >
                    Cancel
                  </AdminBtn>
                  <AdminBtn
                    variant="danger"
                    className="flex-1"
                    onClick={confirmReject}
                  >
                    <X className="w-4 h-4" /> Confirm Reject
                  </AdminBtn>
                </div>
              </div>
            ) : (
              <div className="flex gap-3 p-5 border-t border-white/10">
                <AdminBtn
                  variant="danger"
                  className="flex-1"
                  onClick={() => setRejecting(true)}
                >
                  <X className="w-4 h-4" /> Reject
                </AdminBtn>
                <AdminBtn
                  variant="success"
                  className="flex-1"
                  onClick={approve}
                >
                  <Check className="w-4 h-4" /> Approve
                </AdminBtn>
              </div>
            )}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-0.5">
        {label}
      </div>
      <div className="text-sm text-slate-200">{value}</div>
    </div>
  );
}

function fmtLong(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatSize(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}
