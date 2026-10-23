import { useState } from "react";
import { X } from "lucide-react";
import { AdminBtn, AdminInput } from "@/components/admin/ui";
import { updateEmployeeLeaveBalance, type LeaveNumbers } from "@/lib/api-settings";

const KEYS: (keyof LeaveNumbers)[] = ["Annual", "Medical", "Emergency"];

/** Edit one staff member's Annual / Medical / Emergency days left. */
export function EditLeaveBalanceModal({
  username,
  fullName,
  current,
  onClose,
  onSaved,
}: {
  username: string;
  fullName: string;
  current: LeaveNumbers;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [values, setValues] = useState<Record<keyof LeaveNumbers, string>>({
    Annual: String(current.Annual),
    Medical: String(current.Medical),
    Emergency: String(current.Emergency),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if (saving) return;
    const out = {} as LeaveNumbers;
    for (const k of KEYS) {
      const n = Number(values[k]);
      if (values[k].trim() === "" || !Number.isInteger(n) || n < 0 || n > 365) {
        setError("Leave days must be whole numbers from 0 to 365.");
        return;
      }
      out[k] = n;
    }
    setSaving(true);
    setError("");
    try {
      await updateEmployeeLeaveBalance(username, out);
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="bg-[#111726] border border-white/10 rounded-[14px] w-full max-w-[440px] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="elb-title"
      >
        <div className="flex items-start justify-between p-5 border-b border-white/10">
          <div>
            <h3 id="elb-title" className="text-base font-bold text-white">Edit Leave Balance</h3>
            <div className="text-[12px] text-slate-400 mt-0.5">{fullName}</div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white" aria-label="Close">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">
          <p className="text-[12.5px] text-slate-400 mb-4">Days left this staff member can still take.</p>
          <div className="grid grid-cols-3 gap-3">
            {KEYS.map((k) => (
              <div key={k}>
                <label htmlFor={`elb-${k}`} className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
                  {k}
                </label>
                <AdminInput
                  id={`elb-${k}`}
                  type="number"
                  min={0}
                  value={values[k]}
                  onChange={(e) => setValues({ ...values, [k]: e.target.value })}
                />
              </div>
            ))}
          </div>
          {error && <p className="text-xs text-rose-300 mt-3">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-white/10">
          <AdminBtn variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </AdminBtn>
          <AdminBtn variant="primary" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </AdminBtn>
        </div>
      </div>
    </div>
  );
}
