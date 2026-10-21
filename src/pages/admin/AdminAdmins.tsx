import { useEffect, useMemo, useState } from "react";
import {
  ShieldCheck,
  Plus,
  MoreVertical,
  Eye,
  KeyRound,
  Power,
  PowerOff,
  RotateCcw,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, EmptyState, AdminBtn } from "@/components/admin/ui";
import { ConfirmModal } from "@/components/admin/ConfirmModal";
import { useAdminSession } from "@/hooks/use-admin-session";
import {
  isAdminProfile,
  activeAdminCount,
  createAdminAccount,
  changeAdminPassword,
  resetAdminPassword,
  deactivateAdmin,
  reactivateAdmin,
  getAuditLog,
  loadAuditLog,
  type AdminMgmtResult,
} from "@/lib/admin-accounts";
import { useAdminDirectory } from "@/lib/api-admin";
import { getUser, getUserIndex, fmtDate } from "@/lib/hr-store";
import { isAccountActive } from "@/lib/account-status";
import {
  CreateAdminModal,
  ViewAdminModal,
  ChangePasswordModal,
  type AdminRow,
} from "@/components/admin/AdminAdminModals";

type ModalKind =
  | { kind: "none" }
  | { kind: "create" }
  | { kind: "view"; row: AdminRow }
  | { kind: "password"; row: AdminRow }
  | { kind: "reset"; row: AdminRow }
  | { kind: "confirmDeactivate"; row: AdminRow }
  | { kind: "confirmReactivate"; row: AdminRow };

export function AdminAdmins() {
  const session = useAdminSession();
  const [tick, setTick] = useState(0);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [menuPos, setMenupos] = useState<{ top?: Number; bottom?: Number; right: Number }>({ right: 0});
  const [modal, setModal] = useState<ModalKind>({ kind: "none" });
  const [actionError, setActionError] = useState("");

  const directory = useAdminDirectory();
  useEffect(() => {
    loadAuditLog().then(() => setTick((t) => t + 1));
  }, []);

  const adminRows = useMemo<AdminRow[]>(() => {
    return getUserIndex()
      .filter((u) => isAdminProfile(getUser(u)))
      .map((u) => {
        const p = getUser(u)!;
        return {
          username: u,
          fullName: p.fullName,
          email: p.email || `${u}@yesempire.com`,
          role: p.role,
          employeeId: p.employeeId || "-",
          active: isAccountActive(p),
          isSelf: u === session.username,
          createdAt: p.joinedAt ? fmtDate(p.joinedAt) : "-",
        };
      })
      .sort((a, b) => a.fullName.localeCompare(b.fullName));
  }, [tick, directory, session.username]);

  const activeCount = activeAdminCount();
  const inactiveCount = adminRows.length - activeCount;
  const recentAudit = getAuditLog(6);

  const refresh = () => {
    setActionError("");
    setMenuOpen(null);
    setTick((t) => t + 1);
  };

  const handleResult = async (p: Promise<AdminMgmtResult>): Promise<AdminMgmtResult> => {
    const r = await p;
    if (!r.ok) {
      setActionError(r.error || "Unable to complete the action.");
      return r;
    }
    refresh();
    return r;
  };

  const onMenu = (action: string, row: AdminRow) => {
    setMenuOpen(null);
    setActionError("");
    if (action === "view") setModal({ kind: "view", row });
    else if (action === "password") setModal({ kind: "password", row });
    else if (action === "reset") setModal({ kind: "reset", row });
    else if (action === "deactivate")
      setModal({ kind: "confirmDeactivate", row });
    else if (action === "reactivate")
      setModal({ kind: "confirmReactivate", row });
  };

  const confirmDeactivate = () => {
    if (modal.kind !== "confirmDeactivate") return;
    handleResult(deactivateAdmin(modal.row.username, session.username || ""));
    setModal({ kind: "none" });
  };

  const confirmReactivate = () => {
    if (modal.kind !== "confirmReactivate") return;
    handleResult(reactivateAdmin(modal.row.username, session.username || ""));
    setModal({ kind: "none" });
  };

  return (
    <AdminLayout>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            Admin Accounts
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Manage administrators who can access this portal. Public
            registration only ever creates staff accounts — never admin.
          </p>
        </div>
        <AdminBtn
          variant="primary"
          onClick={() => setModal({ kind: "create" })}
        >
          <Plus className="w-4 h-4" /> Add Admin
        </AdminBtn>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <SummaryStat label="Total Admins" value={adminRows.length} />
        <SummaryStat label="Active" value={activeCount} tone="emerald" />
        <SummaryStat label="Inactive" value={inactiveCount} tone="rose" />
        <SummaryStat
          label="You"
          value={session.profile?.fullName?.split(" ")[0] || "—"}
          tone="amber"
        />
      </div>

      {actionError && (
        <div className="mb-4 text-[12.5px] text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
          {actionError}
        </div>
      )}

      {/* Table */}
      <Card className="overflow-hidden mb-6">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[13.5px] min-w-[820px]">
            <thead>
              <tr className="border-b border-white/10">
                {[
                  "Administrator",
                  "Employee ID",
                  "Email",
                  "Role",
                  "Created",
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
              {adminRows.length === 0 ? (
                <tr>
                  <td colSpan={7}>
                    <EmptyState>No admin accounts found.</EmptyState>
                  </td>
                </tr>
              ) : (
                adminRows.slice(0, 8).map((row) => (
                  <tr
                    key={row.username}
                    className="border-b border-white/5 last:border-b-0 hover:bg-white/[0.02]"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center flex-shrink-0">
                          <ShieldCheck className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-medium text-white flex items-center gap-1.5">
                            {row.fullName}
                            {row.isSelf && (
                              <span className="text-[9px] uppercase tracking-wide text-amber-300/80">
                                you
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 font-mono-hr">
                            @{row.username}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono-hr text-slate-300">
                      {row.employeeId}
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-[12px]">
                      {row.email}
                    </td>
                    <td className="px-4 py-3 text-slate-300 text-[12.5px]">
                      {row.role}
                    </td>
                    <td className="px-4 py-3 font-mono-hr text-slate-300 text-[12px]">
                      {row.createdAt}
                    </td>
                    <td className="px-4 py-3">
                      {row.active ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 text-emerald-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{" "}
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/15 text-rose-300">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />{" "}
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 relative">
                      <button
                        onClick={(ev) => {
                          const r = ev.currentTarget.getBoundingClientRect();
                          const roomBelow = window.innerHeight - r.bottom > 240;
                          setMenupos(
                            roomBelow
                              ? { top: r.bottom + 4, right: window.innerWidth - r.right }
                              : { bottom: window.innerHeight - r.top + 4, right: window.innerWidth - r.right },
                          );
                          setMenuOpen(menuOpen === row.username ? null : row.username);
                        }}

                        className="text-slate-400 hover:text-white p-1 rounded hover:bg-white/5"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {menuOpen === row.username && (
                        <>
                          <div
                            className="fixed inset-0 z-40"
                            onClick={() => setMenuOpen(null)}
                          />
                          <div style={menuPos} className="fixed z-50 w-52 bg-[#111726] border border-white/10 rounded-lg shadow-xl py-1">
                            <MenuItem
                              icon={<Eye className="w-3.5 h-3.5" />}
                              label="View Profile"
                              onClick={() => onMenu("view", row)}
                            />
                            <MenuItem
                              icon={<KeyRound className="w-3.5 h-3.5" />}
                              label="Change Password"
                              onClick={() => onMenu("password", row)}
                              disabled={!row.isSelf}
                            />
                            <MenuItem
                              icon={<RotateCcw className="w-3.5 h-3.5" />}
                              label="Reset Password"
                              onClick={() => onMenu("reset", row)}
                              disabled={row.isSelf}
                            />
                            {row.active ? (
                              <MenuItem
                                icon={<PowerOff className="w-3.5 h-3.5" />}
                                label="Deactivate"
                                tone="rose"
                                onClick={() => onMenu("deactivate", row)}
                                disabled={row.isSelf || activeCount <= 1}
                              />
                            ) : (
                              <MenuItem
                                icon={<Power className="w-3.5 h-3.5" />}
                                label="Reactivate"
                                tone="emerald"
                                onClick={() => onMenu("reactivate", row)}
                              />
                            )}
                          </div>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {adminRows.length > 8 && (
        <p className="text-[12px] text-slate-500 -mt-3 mb-6">
          Showing first 8 of {adminRows.length} admin accounts.
        </p>
      )}

      {/* Recent audit log */}
      <div className="mb-3">
        <h3 className="text-[12px] uppercase tracking-[0.08em] text-slate-400 font-semibold">
          Recent Account Activity
        </h3>
      </div>
      <Card className="overflow-hidden">
        {recentAudit.length === 0 ? (
          <EmptyState>No admin account activity yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-white/5">
            {recentAudit.map((e) => (
              <li key={e.id} className="px-4 py-3 flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-white/5 text-slate-400 flex items-center justify-center flex-shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] text-white">{e.detail}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    by @{e.actor} · {fmtDate(e.createdAt)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* ---------- Modals ---------- */}

      {modal.kind === "create" && (
        <CreateAdminModal
          onClose={() => setModal({ kind: "none" })}
          onSubmit={(input) => 
            handleResult(createAdminAccount(input, session.username || ""))
          }
        />
      )}

      {modal.kind === "view" && (
        <ViewAdminModal
          row={modal.row}
          onClose={() => setModal({ kind: "none" })}
        />
      )}

      {modal.kind === "password" && (
        <ChangePasswordModal
          title="Change Password"
          row={modal.row}
          showCurrent
          onClose={() => setModal({ kind: "none" })}
          onSubmit={(current, next) =>
            handleResult(
              changeAdminPassword(
                modal.row.username,
                current,
                next,
                session.username || "",
              ),
            )
          }
        />
      )}

      {modal.kind === "reset" && (
        <ChangePasswordModal
          title={`Reset Password — ${modal.row.fullName}`}
          row={modal.row}
          showCurrent={false}
          onClose={() => setModal({ kind: "none" })}
          onSubmit={(_current, next) =>
            handleResult(
              resetAdminPassword(
                modal.row.username,
                next,
                session.username || "",
              ),
            )
          }
        />
      )}

      {modal.kind === "confirmDeactivate" && (
        <ConfirmModal
          title="Deactivate Admin?"
          message={`Deactivate ${modal.row.fullName}? They will no longer be able to log in to the Admin Portal. This can be undone later by reactivating the account.`}
          confirmLabel="Deactivate"
          danger
          error={actionError}
          onCancel={() => {
            setModal({ kind: "none" });
            setActionError("");
          }}
          onConfirm={confirmDeactivate}
        />
      )}

      {modal.kind === "confirmReactivate" && (
        <ConfirmModal
          title="Reactivate Admin?"
          message={`Reactivate ${modal.row.fullName}? They will be able to log in to the Admin Portal again.`}
          confirmLabel="Reactivate"
          error={actionError}
          onCancel={() => {
            setModal({ kind: "none" });
            setActionError("");
          }}
          onConfirm={confirmReactivate}
        />
      )}
    </AdminLayout>
  );
}

/* ---------- small UI helpers ---------- */

function SummaryStat({
  label,
  value,
  tone = "slate",
}: {
  label: string;
  value: number | string;
  tone?: "slate" | "emerald" | "rose" | "amber";
}) {
  const tones: Record<string, string> = {
    slate: "bg-white/5 text-slate-300",
    emerald: "bg-emerald-500/10 text-emerald-300",
    rose: "bg-rose-500/10 text-rose-300",
    amber: "bg-amber-500/10 text-amber-300",
  };
  return (
    <div className="rounded-[12px] border border-white/10 bg-[#111726] p-4">
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${tones[tone]}`}
      >
        <ShieldCheck className="w-4 h-4" />
      </div>
      <div className="font-mono-hr text-[22px] font-semibold text-white leading-none">
        {value}
      </div>
      <div className="text-[12px] text-slate-400 mt-1.5">{label}</div>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  tone,
  disabled,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  tone?: "rose" | "emerald";
  disabled?: boolean;
}) {
  const toneCls =
    tone === "rose"
      ? "text-rose-400 hover:bg-rose-500/10"
      : tone === "emerald"
        ? "text-emerald-400 hover:bg-emerald-500/10"
        : "text-slate-300 hover:bg-white/5 hover:text-white";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left rounded disabled:opacity-40 disabled:cursor-not-allowed ${toneCls}`}
    >
      {icon} {label}
    </button>
  );
}
