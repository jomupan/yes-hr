import { useEffect, useState } from "react";
import { Save, ShieldCheck, X } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, AdminBtn, AdminInput } from "@/components/admin/ui";
import { useAdminSession } from "@/hooks/use-admin-session";
import { ReplacementLeaveCard } from "@/components/admin/ReplacementLeaveCard";
import { StaffChecklist, useActiveStaff } from "@/components/admin/StaffChecklist";
import { fetchSettings, saveSettings, type LeaveNumbers } from "@/lib/api-settings";

const LEAVE_KEYS: (keyof LeaveNumbers)[] = ["Annual", "Medical", "Emergency"];

export function AdminSettings() {
  const session = useAdminSession();
  const [companyName, setCompanyName] = useState("YES Empire Group");
  const [leave, setLeave] = useState<Record<keyof LeaveNumbers, string>>({ Annual: "14", Medical: "14", Emergency: "3" });
  // What's saved on the server, to see what changed.
  const [savedLeave, setSavedLeave] = useState<LeaveNumbers>({ Annual: 14, Medical: 14, Emergency: 3 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [askWho, setAskWho] = useState(false);

  useEffect(() => {
    fetchSettings()
      .then((s) => {
        setCompanyName(s.companyName);
        setSavedLeave(s.defaultLeave);
        setLeave({
          Annual: String(s.defaultLeave.Annual),
          Medical: String(s.defaultLeave.Medical),
          Emergency: String(s.defaultLeave.Emergency),
        });
      })
      .catch(() => setMessage({ ok: false, text: "Couldn't load settings. Please refresh." }))
      .finally(() => setLoading(false));
  }, []);

  const numbers = (): LeaveNumbers | null => {
    const out = {} as LeaveNumbers;
    for (const k of LEAVE_KEYS) {
      const n = Number(leave[k]);
      if (leave[k].trim() === "" || !Number.isInteger(n) || n < 0 || n > 365) return null;
      out[k] = n;
    }
    return out;
  };
  const leaveChanged = () => {
    const n = numbers();
    return !!n && LEAVE_KEYS.some((k) => n[k] !== savedLeave[k]);
  };

  const doSave = async (applyTo: string[]) => {
    const n = numbers();
    if (!n) return;
    setSaving(true);
    setMessage(null);
    try {
      const res = await saveSettings({ companyName: companyName.trim() || "YES Empire Group", defaultLeave: n }, applyTo);
      setSavedLeave(res.settings.defaultLeave);
      setAskWho(false);
      setMessage({
        ok: true,
        text: res.updatedStaff
          ? `Settings saved. Leave balances updated for ${res.updatedStaff} staff.`
          : "Settings saved.",
      });
    } catch (e) {
      setMessage({ ok: false, text: e instanceof Error ? e.message : "Couldn't save. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const onSave = () => {
    setMessage(null);
    if (!numbers()) {
      setMessage({ ok: false, text: "Leave days must be whole numbers from 0 to 365." });
      return;
    }
    // If the leave numbers changed, ask which existing staff should get the change.
    if (leaveChanged()) setAskWho(true);
    else void doSave([]);
  };

  return (
    <AdminLayout>
      <div className="mb-5">
        <h2 className="text-xl sm:text-2xl font-bold text-white">Settings</h2>
        <p className="text-slate-400 text-sm mt-1">
          Configure organization and leave policy defaults.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <h3 className="text-sm font-semibold text-white mb-4">
            Organization
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
                Company Name
              </label>
              <AdminInput
                value={companyName}
                disabled={loading}
                onChange={(e) => setCompanyName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
                Administrator
              </label>
              <AdminInput
                value={session.profile?.fullName || "Administrator"}
                disabled
              />
            </div>
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-sm font-semibold text-white mb-1">
            Default Leave Balances
          </h3>
          <p className="text-[12px] text-slate-400 mb-4">
            New staff start with these days. When you change them, you can also update existing staff.
          </p>
          <div className="grid grid-cols-3 gap-3">
            {LEAVE_KEYS.map((k) => (
              <div key={k}>
                <label
                  htmlFor={`def-${k}`}
                  className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1.5"
                >
                  {k}
                </label>
                <AdminInput
                  id={`def-${k}`}
                  type="number"
                  min={0}
                  value={leave[k]}
                  disabled={loading}
                  onChange={(e) => setLeave({ ...leave, [k]: e.target.value })}
                />
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center gap-3 flex-wrap">
            <AdminBtn variant="primary" onClick={onSave} disabled={loading || saving}>
              <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save Changes"}
            </AdminBtn>
            {message && (
              <span className={`text-[12px] ${message.ok ? "text-emerald-400" : "text-rose-300"}`}>
                {message.text}
              </span>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-4">
        <ReplacementLeaveCard />
      </div>

      <div className="mt-4">
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center text-emerald-300 flex-shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Admin Access</h3>
              <p className="text-[12px] text-slate-400 mt-1 leading-relaxed">
                Only users with the administrator role can access this portal.
                Public registration only ever creates staff accounts. Admin
                accounts are managed by authorized administrators from the Admin
                Accounts page.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {askWho && (
        <ApplyToStaffModal
          before={savedLeave}
          after={numbers()!}
          saving={saving}
          error={message && !message.ok ? message.text : ""}
          onCancel={() => setAskWho(false)}
          onSave={(usernames) => void doSave(usernames)}
        />
      )}
    </AdminLayout>
  );
}

/** Asks which existing staff should get the change (all ticked by default). */
function ApplyToStaffModal({
  before,
  after,
  saving,
  error,
  onCancel,
  onSave,
}: {
  before: LeaveNumbers;
  after: LeaveNumbers;
  saving: boolean;
  error: string;
  onCancel: () => void;
  onSave: (usernames: string[]) => void;
}) {
  const staff = useActiveStaff();
  const [chosen, setChosen] = useState<Set<string> | null>(null);
  const selected = chosen ?? new Set(staff.map((s) => s.username));
  const changes = LEAVE_KEYS.filter((k) => after[k] !== before[k]).map((k) => {
    const d = after[k] - before[k];
    return `${k} ${before[k]} → ${after[k]} (${d > 0 ? "+" : ""}${d})`;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onCancel}>
      <div
        className="bg-[#111726] border border-white/10 rounded-[14px] w-full max-w-[520px] shadow-2xl max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="apply-title"
      >
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h3 id="apply-title" className="text-base font-bold text-white">
            Update existing staff too?
          </h3>
          <button type="button" onClick={onCancel} className="text-slate-400 hover:text-white" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">
          <div className="text-[13px] text-slate-300 bg-white/[0.03] border border-white/10 rounded-lg px-3 py-2.5 space-y-0.5">
            {changes.map((c) => (
              <div key={c}>{c}</div>
            ))}
          </div>
          <p className="text-[12.5px] text-slate-400 leading-relaxed">
            New staff will start with the new numbers. Staff ticked below get the same change added to their current
            balance, so leave they've already taken still counts. Untick anyone who shouldn't change.
          </p>
          <StaffChecklist staff={staff} selected={selected} onChange={setChosen} title="Update these staff" />
          {error && <p className="text-xs text-rose-300">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-white/10">
          <AdminBtn variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </AdminBtn>
          <AdminBtn variant="primary" onClick={() => onSave([...selected])} disabled={saving}>
            {saving ? "Saving…" : `Save${selected.size ? ` & update ${selected.size} staff` : ""}`}
          </AdminBtn>
        </div>
      </div>
    </div>
  );
}
