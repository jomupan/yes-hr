import type { AdminEmployee } from "@/lib/admin-store";
import { departmentOf, companyOf } from "@/lib/admin-store";
import { DOPE_PERSONALITY_TYPES } from "@/lib/hr-constants";
import { fmtDate, daysBetween } from "@/lib/hr-store";
import { useState } from "react";
import { X, ShieldCheck, Mail, Building2, IdCard } from "lucide-react";
import { Avatar, EmptyState, StatusBadge } from "@/components/admin/ui";

export function EmployeeProfileModal({
  employee,
  onClose,
}: {
  employee: AdminEmployee;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"overview" | "leave" | "personality">(
    "overview",
  );
  const e = employee;
  const apps = [...e.leave.applications].sort(
    (a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime(),
  );
  const dopeHistory = [...e.dope.history].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-[#111726] border border-white/10 rounded-[14px] w-full max-w-[640px] max-h-[85vh] overflow-hidden flex flex-col shadow-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex items-start justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <Avatar name={e.profile.fullName} size={48} />
            <div>
              <h3 className="text-base font-bold text-white">
                {e.profile.fullName}
              </h3>
              <div className="text-[12px] text-slate-400">
                {e.profile.role} · {e.username}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex gap-1 px-5 pt-3 border-b border-white/10">
          {(["overview", "leave", "personality"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                "px-3 py-2 text-[13px] font-medium capitalize border-b-2 transition-colors",
                tab === t
                  ? "border-amber-500 text-amber-300"
                  : "border-transparent text-slate-400 hover:text-white",
              ].join(" ")}
            >
              {t === "personality" ? "Personality Test" : t}
            </button>
          ))}
        </div>

        <div className="p-5 overflow-y-auto">
          {tab === "overview" && (
            <div className="space-y-3">
              <InfoRow
                icon={IdCard}
                label="Employee ID"
                value={e.profile.employeeId || "-"}
              />
              <InfoRow
                icon={Building2}
                label="Company"
                value={companyOf(e.profile)}
              />
              <InfoRow
                icon={Building2}
                label="Department"
                value={departmentOf(e.profile)}
              />
              <InfoRow
                icon={Mail}
                label="Email"
                value={e.profile.email || "-"}
              />
              <InfoRow icon={ShieldCheck} label="Role" value={e.profile.role} />
              <div className="grid grid-cols-3 gap-3 pt-2">
                {Object.entries(e.leave.balance).map(([k, v]) => (
                  <div
                    key={k}
                    className="bg-[#0e1320] border border-white/10 rounded-lg p-3 text-center"
                  >
                    <div className="font-mono-hr text-lg font-semibold text-white">
                      {v}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {k} Balance
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "leave" &&
            (apps.length === 0 ? (
              <EmptyState>No leave history for this employee.</EmptyState>
            ) : (
              <div className="overflow-hidden rounded-lg border border-white/10">
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-white/10 bg-white/[0.02]">
                      {["Type", "Period", "Days", "Status"].map((h) => (
                        <th
                          key={h}
                          className="text-left text-[10px] uppercase tracking-wide text-slate-400 px-3 py-2 font-semibold"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {apps.map((a) => (
                      <tr
                        key={a.id}
                        className="border-b border-white/5 last:border-b-0"
                      >
                        <td className="px-3 py-2 text-slate-200">{a.type}</td>
                        <td className="px-3 py-2 font-mono-hr text-slate-300">
                          {fmtDate(a.from)} → {fmtDate(a.to)}
                        </td>
                        <td className="px-3 py-2 font-mono-hr text-slate-300">
                          {daysBetween(a.from, a.to) + 1}
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge status={a.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}

          {tab === "personality" &&
            (dopeHistory.length === 0 ? (
              <EmptyState>
                This employee has not taken any Dope Personality Tests.
              </EmptyState>
            ) : (
              <div className="space-y-3">
                {dopeHistory.map((r) => {
                  const meta = DOPE_PERSONALITY_TYPES[r.personalityType];
                  return (
                    <div
                      key={r.id}
                      className="bg-[#0e1320] border border-white/10 rounded-lg p-4"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300">
                            <ShieldCheck className="w-3 h-3" /> Passed
                          </span>
                          <span className="font-mono-hr text-[11px] text-slate-400">
                            {fmtDate(r.date)}
                          </span>
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-white">
                        {meta?.label || r.personalityType}
                      </div>
                      <div className="text-[12px] text-slate-400 mt-1 leading-relaxed">
                        {r.summary || meta?.summary}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400">
        <Icon className="w-4 h-4" />
      </div>
      <div>
        <div className="text-[11px] uppercase tracking-wide text-slate-500">
          {label}
        </div>
        <div className="text-sm text-slate-200">{value}</div>
      </div>
    </div>
  );
}
