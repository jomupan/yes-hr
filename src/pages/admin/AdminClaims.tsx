import { useState } from "react";
import { Search, X, Check, Receipt, Wallet, Clock3 } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  Card,
  EmptyState,
  StatusBadge,
  Avatar,
  AdminBtn,
  AdminInput,
  AdminSelect,
  StatCard,
} from "@/components/admin/ui";
import { fmtDate } from "@/lib/hr-store";
import {
  setClaimStatusOnServer,
  useAdminClaims,
  type AdminClaimRow,
} from "@/lib/api-hr";

const rm = (n: number) =>
  `RM ${n.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function AdminClaims() {
  const claims = useAdminClaims();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("Pending");
  const [selected, setSelectedRaw] = useState<AdminClaimRow | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState("");

  const setSelected = (c: AdminClaimRow | null) => {
    setActionError("");
    setRejecting(false);
    setRejectReason("");
    setSelectedRaw(c);
  };

  const filtered = claims.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch =
      !q ||
      c.fullName.toLowerCase().includes(q) ||
      c.department.toLowerCase().includes(q) ||
      c.desc.toLowerCase().includes(q);
    const matchType = typeFilter === "all" || c.type === typeFilter;
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchType && matchStatus;
  });

  const pending = claims.filter((c) => c.status === "Pending");
  const thisMonth = new Date().toISOString().slice(0, 7);
  const approvedThisMonth = claims
    .filter((c) => c.status === "Approved" && (c.reviewedAt || c.date).slice(0, 7) === thisMonth)
    .reduce((s, c) => s + Number(c.amount), 0);

  // Saved on the server; the staff member is notified on their own device.
  const decide = async (status: "Approved" | "Rejected", reason?: string) => {
    if (!selected || saving) return;
    setSaving(true);
    setActionError("");
    try {
      await setClaimStatusOnServer(selected.id, status, reason);
      setSelected(null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="mb-5">
        <h2 className="text-xl sm:text-2xl font-bold text-white">Claims</h2>
        <p className="text-slate-400 text-sm mt-1">
          Review expense claims submitted by staff.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <StatCard label="Pending Claims" value={pending.length} icon={Clock3} highlight={pending.length > 0} />
        <StatCard
          label="Pending Amount"
          value={rm(pending.reduce((s, c) => s + Number(c.amount), 0))}
          icon={Wallet}
        />
        <StatCard label="Approved This Month" value={rm(approvedThisMonth)} icon={Receipt} />
      </div>

      {/* Filters */}
      <Card className="p-4 mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <AdminInput
              placeholder="Search employee, department or description"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <AdminSelect value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="all">All Claim Types</option>
            <option value="Travel">Travel</option>
            <option value="Medical">Medical</option>
            <option value="Equipment">Equipment</option>
            <option value="Others">Others</option>
          </AdminSelect>
          <AdminSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
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
                {["Employee", "Department", "Type", "Amount", "Date", "Description", "Status", "Action"].map((h) => (
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
                    <EmptyState>No claims match your filters.</EmptyState>
                  </td>
                </tr>
              ) : (
                filtered.map((c) => (
                  <tr key={c.id} className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.02]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={c.fullName} size={30} />
                        <span className="font-medium text-white">{c.fullName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{c.department}</td>
                    <td className="px-4 py-3 text-slate-300">{c.type}</td>
                    <td className="px-4 py-3 font-mono-hr text-white">{rm(Number(c.amount))}</td>
                    <td className="px-4 py-3 font-mono-hr text-slate-300">{fmtDate(c.date)}</td>
                    <td className="px-4 py-3 text-slate-300 max-w-[220px] truncate" title={c.desc}>
                      {c.desc}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-4 py-3">
                      <AdminBtn variant="ghost" onClick={() => setSelected(c)}>
                        {c.status === "Pending" ? "Review" : "View"}
                      </AdminBtn>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Details */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
          onClick={() => !saving && setSelected(null)}
        >
          <div
            className="bg-[#111726] border border-white/10 rounded-[14px] w-full max-w-[480px] shadow-2xl max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="claim-title"
          >
            <div className="flex items-start justify-between p-5 border-b border-white/10">
              <div className="flex items-center gap-3">
                <Avatar name={selected.fullName} size={40} />
                <div>
                  <div id="claim-title" className="text-white font-semibold">{selected.fullName}</div>
                  <div className="text-slate-400 text-xs">{selected.department}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="text-slate-400 hover:text-white"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-3 text-sm">
              <Row label="Type" value={selected.type} />
              <Row label="Amount" value={rm(Number(selected.amount))} />
              <Row label="Expense date" value={fmtDate(selected.date)} />
              <Row label="Status" value={<StatusBadge status={selected.status} />} />
              <div>
                <div className="text-slate-400 text-xs mb-1">Description</div>
                <div className="text-slate-200 whitespace-pre-line break-words">{selected.desc}</div>
              </div>
              {selected.rejectionReason && (
                <div>
                  <div className="text-slate-400 text-xs mb-1">Reason for rejection</div>
                  <div className="text-rose-200">{selected.rejectionReason}</div>
                </div>
              )}
              {selected.reviewedBy && (
                <div className="text-[11px] text-slate-500">
                  Reviewed by {selected.reviewedBy}
                  {selected.reviewedAt ? ` on ${fmtDate(selected.reviewedAt)}` : ""}
                </div>
              )}
            </div>

            {selected.status === "Pending" &&
              (rejecting ? (
                <div className="p-5 border-t border-white/10">
                  <label className="block text-xs text-slate-400 mb-1.5" htmlFor="claim-reject">
                    Reason (shown to the staff member)
                  </label>
                  <textarea
                    id="claim-reject"
                    rows={3}
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="e.g. Please attach the receipt."
                    className="w-full px-3 py-2 rounded-lg bg-[#0e1320] border border-white/10 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/30 mb-3"
                  />
                  <div className="flex gap-3">
                    <AdminBtn variant="secondary" className="flex-1" onClick={() => setRejecting(false)} disabled={saving}>
                      Cancel
                    </AdminBtn>
                    <AdminBtn
                      variant="danger"
                      className="flex-1"
                      onClick={() => void decide("Rejected", rejectReason.trim() || undefined)}
                      disabled={saving}
                    >
                      <X className="w-4 h-4" /> {saving ? "Saving…" : "Confirm Reject"}
                    </AdminBtn>
                  </div>
                  {actionError && <p className="text-xs text-rose-300 mt-3">{actionError}</p>}
                </div>
              ) : (
                <div className="p-5 border-t border-white/10">
                  <div className="flex gap-3">
                    <AdminBtn variant="danger" className="flex-1" onClick={() => setRejecting(true)} disabled={saving}>
                      <X className="w-4 h-4" /> Reject
                    </AdminBtn>
                    <AdminBtn variant="success" className="flex-1" onClick={() => void decide("Approved")} disabled={saving}>
                      <Check className="w-4 h-4" /> {saving ? "Saving…" : "Approve"}
                    </AdminBtn>
                  </div>
                  {actionError && <p className="text-xs text-rose-300 mt-3">{actionError}</p>}
                </div>
              ))}
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-slate-400 text-xs">{label}</span>
      <span className="text-slate-200 text-right">{value}</span>
    </div>
  );
}
