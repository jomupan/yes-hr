import { useState } from "react";
import { X, FileText, Image as ImageIcon, Download } from "lucide-react";
import { AdminBtn, AdminInput } from "@/components/admin/ui";
import {
  uploadPayslip,
  replacePayslipFile,
  downloadPayslip,
  getActiveEmployeesForPayslip,
  monthName,
  periodLabel,
  type PayslipRecord,
} from "@/lib/payslips";
import { employeeIdOf, departmentOf } from "@/lib/admin-store";
import { formatFileSize } from "@/lib/attachment";
import { fmtDate } from "@/lib/hr-store";

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1);
const YEARS = (() => {
  const now = new Date();
  const out: number[] = [];
  for (let y = now.getFullYear(); y >= now.getFullYear() - 4; y--) out.push(y);
  return out;
})();

function isImage(type: string): boolean {
  return type.startsWith("image/");
}

export function UploadPayslipModal({
  onClose,
  uploadedBy,
  onDone,
}: {
  onClose: () => void;
  uploadedBy: string;
  onDone: () => void;
}) {
  const employees = getActiveEmployeesForPayslip();
  const [username, setUsername] = useState("");
  const [month, setMonth] = useState<number | "">("");
  const [year, setYear] = useState<number | "">(new Date().getFullYear());
  const [file, setFile] = useState<File | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (!username) return setError("Please select an employee.");
    if (!month || !year) return setError("Please select a month and year.");
    if (!file) return setError("Please choose a payslip file.");
    setBusy(true);
    const r = await uploadPayslip(
      username,
      Number(month),
      Number(year),
      file,
      note,
      uploadedBy,
    );
    setBusy(false);
    if (!r.ok) return setError(r.error || "Unable to upload payslip.");
    onDone();
  };

  const selectCls =
    "w-full px-3 py-2.5 rounded-lg bg-[#0e1320] border border-white/10 text-[13.5px] text-white focus:outline-none focus:ring-2 focus:ring-amber-500/40";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-[#111726] border border-white/10 rounded-[14px] w-full max-w-[460px] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h3 className="text-base font-bold text-white">Upload Payslip</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
              Employee
            </label>
            {employees.length === 0 ? (
              <div className="text-[12px] text-rose-300">
                No active employees available.
              </div>
            ) : (
              <select
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={selectCls}
              >
                <option value="">Select employee</option>
                {employees.map((e) => (
                  <option key={e.username} value={e.username}>
                    {e.profile.fullName} — {employeeIdOf(e.profile)}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
                Month
              </label>
              <select
                value={month}
                onChange={(e) =>
                  setMonth(e.target.value ? Number(e.target.value) : "")
                }
                className={selectCls}
              >
                <option value="">Select month</option>
                {MONTHS.map((m) => (
                  <option key={m} value={m}>
                    {monthName(m)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
                Year
              </label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className={selectCls}
              >
                {YEARS.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
              Payslip File
            </label>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-[13px] text-slate-300 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-amber-500/20 file:text-amber-200 file:font-semibold file:cursor-pointer"
            />
            <div className="text-[11px] text-slate-500 mt-1">
              Accepted formats: PDF, JPG, JPEG, PNG · Max 4 MB
            </div>
            {file && (
              <div className="mt-2 text-[12px] text-slate-300">
                {file.name} · {formatFileSize(file.size)}
              </div>
            )}
          </div>
          <div>
            <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
              Note (optional)
            </label>
            <AdminInput
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Enter note"
            />
          </div>
          {error && (
            <div className="text-[12px] text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-white/10">
          <AdminBtn variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </AdminBtn>
          <AdminBtn variant="primary" onClick={submit} disabled={busy}>
            {busy ? "Uploading..." : "Upload Payslip"}
          </AdminBtn>
        </div>
      </div>
    </div>
  );
}

export function ViewPayslipModal({
  payslip,
  onClose,
}: {
  payslip: PayslipRecord;
  onClose: () => void;
}) {
  const emp = getActiveEmployeesForPayslip().find(
    (e) => e.username === payslip.username,
  )?.profile;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-[#111726] border border-white/10 rounded-[14px] w-full max-w-[560px] shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/10 sticky top-0 bg-[#111726]">
          <h3 className="text-base font-bold text-white">Payslip Details</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <DetailRow
            label="Employee"
            value={emp?.fullName || payslip.username}
          />
          <DetailRow
            label="Employee ID"
            value={emp ? employeeIdOf(emp) : "-"}
          />
          <DetailRow label="Department" value={emp ? departmentOf(emp) : "-"} />
          <DetailRow
            label="Payslip Period"
            value={periodLabel(payslip.month, payslip.year)}
          />
          <DetailRow label="File Name" value={payslip.file.name} />
          <DetailRow
            label="File Size"
            value={formatFileSize(payslip.file.size)}
          />
          <DetailRow label="Uploaded Date" value={fmtDate(payslip.createdAt)} />
          <DetailRow label="Uploaded By" value={payslip.uploadedBy} />
          {payslip.note && <DetailRow label="Note" value={payslip.note} />}
          <div className="pt-2">
            {isImage(payslip.file.type) ? (
              <img
                src={payslip.file.dataUrl}
                alt={`Payslip ${periodLabel(payslip.month, payslip.year)}`}
                className="w-full rounded-lg border border-white/10"
              />
            ) : (
              <div className="flex items-center gap-2 text-slate-300 bg-[#0e1320] border border-white/10 rounded-lg px-4 py-3">
                <FileText className="w-5 h-5 text-amber-300" />
                <span className="text-sm">PDF document</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-white/10 sticky bottom-0 bg-[#111726]">
          <AdminBtn
            variant="secondary"
            onClick={() => downloadPayslip(payslip)}
          >
            <Download className="w-4 h-4" /> Download
          </AdminBtn>
          <AdminBtn variant="secondary" onClick={onClose}>
            Close
          </AdminBtn>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 text-[13px]">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200 text-right">{value}</span>
    </div>
  );
}

export function ReplacePayslipModal({
  payslip,
  onClose,
  onDone,
}: {
  payslip: PayslipRecord;
  onClose: () => void;
  onDone: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (!file) return setError("Please choose a new payslip file.");
    setBusy(true);
    const r = await replacePayslipFile(payslip.id, file);
    setBusy(false);
    if (!r.ok) return setError(r.error || "Unable to replace payslip.");
    onDone();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-[#111726] border border-white/10 rounded-[14px] w-full max-w-[440px] shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h3 className="text-base font-bold text-white">Replace Payslip</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-[13px] text-slate-400">
            Replace the existing payslip for{" "}
            <span className="text-white">
              {periodLabel(payslip.month, payslip.year)}
            </span>
            ?
          </p>
          <div>
            <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
              New Payslip File
            </label>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full text-[13px] text-slate-300 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-amber-500/20 file:text-amber-200 file:font-semibold file:cursor-pointer"
            />
            <div className="text-[11px] text-slate-500 mt-1">
              Accepted formats: PDF, JPG, JPEG, PNG · Max 4 MB
            </div>
          </div>
          {error && (
            <div className="text-[12px] text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-white/10">
          <AdminBtn variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </AdminBtn>
          <AdminBtn variant="primary" onClick={submit} disabled={busy}>
            {busy ? "Replacing..." : "Replace"}
          </AdminBtn>
        </div>
      </div>
    </div>
  );
}
