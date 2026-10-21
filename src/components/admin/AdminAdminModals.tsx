import { useState } from "react";
import {
  X,
  Plus,
  KeyRound,
  Mail,
  Lock,
  Check,
  ShieldCheck,
} from "lucide-react";
import { AdminBtn, AdminInput } from "@/components/admin/ui";

/* ---------- shared form shell ---------- */

export function AdminFormModal({
  title,
  icon,
  onClose,
  error,
  submitLabel,
  onSubmit,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  onClose: () => void;
  error: string;
  submitLabel: string;
  onSubmit: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-[#111726] border border-white/10 rounded-[14px] w-full max-w-[480px] shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <span className="text-amber-300">{icon}</span> {title}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {children}
          {error && (
            <div className="text-[12px] text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-white/10">
          <AdminBtn variant="secondary" onClick={onClose}>
            Cancel
          </AdminBtn>
          <AdminBtn variant="primary" onClick={onSubmit}>
            <Check className="w-4 h-4" /> {submitLabel}
          </AdminBtn>
        </div>
      </div>
    </div>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[11px] uppercase tracking-wide text-slate-500 mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

export function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[12px] text-slate-500">{label}</span>
      <span
        className={`text-[13px] text-slate-200 ${mono ? "font-mono-hr" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

export interface AdminRow {
  username: string;
  fullName: string;
  email: string;
  role: string;
  employeeId: string;
  active: boolean;
  isSelf: boolean;
  createdAt: string;
}

export interface CreateAdminInput {
  fullName: string;
  username: string;
  email: string;
  password: string;
  role: string;
}

/* ---------- Create modal ---------- */

export function CreateAdminModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (input: CreateAdminInput) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("HR Administrator");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (!fullName.trim() || !username.trim()) {
      setError("Full name and username are required.");
      return;
    }
    if (!email.trim() || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError("A valid email is required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    const r = await onSubmit({ fullName, username, email, password, role });
    if (r.ok) onClose();
    else setError(r.error || "Unable to create the admin account.")
  };

  return (
    <AdminFormModal
      title="Add Admin Account"
      icon={<Plus className="w-4 h-4" />}
      onClose={onClose}
      error={error}
      submitLabel="Create Admin"
      onSubmit={submit}
    >
      <Field label="Full Name">
        <AdminInput
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="e.g. Nurul Aina"
        />
      </Field>
      <Field label="Username">
        <AdminInput
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. nurul.aina"
        />
      </Field>
      <Field label="Email">
        <div className="relative">
          <Mail className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <AdminInput
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@yesempire.com"
            className="pl-8"
          />
        </div>
      </Field>
      <Field label="Job Title">
        <AdminInput
          value={role}
          onChange={(e) => setRole(e.target.value)}
          placeholder="HR Administrator"
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Password">
          <div className="relative">
            <Lock className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <AdminInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 8 characters"
              className="pl-8"
            />
          </div>
        </Field>
        <Field label="Confirm Password">
          <AdminInput
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat password"
          />
        </Field>
      </div>
      <div className="text-[11px] text-slate-500 bg-white/[0.03] border border-white/5 rounded-lg px-3 py-2 flex items-start gap-2">
        <ShieldCheck className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-amber-400/70" />
        The new admin will be able to log in immediately using these credentials
        and access the full Admin Portal.
      </div>
    </AdminFormModal>
  );
}

/* ---------- View modal ---------- */

export function ViewAdminModal({
  row,
  onClose,
}: {
  row: AdminRow;
  onClose: () => void;
}) {
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
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">
                {row.fullName}
              </h3>
              <div className="text-[11px] text-slate-500 font-mono-hr">
                @{row.username}
              </div>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <Row label="Employee ID" value={row.employeeId} mono />
          <Row label="Email" value={row.email} />
          <Row label="Job Title" value={row.role} />
          <Row label="Account Created" value={row.createdAt || "-"} />
          <div className="flex items-center justify-between pt-1">
            <span className="text-[12px] text-slate-500">Status</span>
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
          </div>
          {row.isSelf && (
            <div className="text-[11px] text-amber-300/80 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2 mt-1">
              This is the account you are currently signed in as.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Change / Reset password modal ---------- */

export function ChangePasswordModal({
  title,
  row,
  showCurrent,
  onClose,
  onSubmit,
}: {
  title: string;
  row: AdminRow;
  showCurrent: boolean;
  onClose: () => void;
  onSubmit: (current: string, next: string) => Promise<{ ok: boolean; error?: string }>;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  const submit = async () => {
    setError("");
    if (showCurrent && !current) {
      setError("Enter the current password.");
      return;
    }
    if (next.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (next !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    const r = await onSubmit(current, next);
    if (r.ok) onClose();
    else setError(r.error || "Unable to update the password.");
  };

  return (
    <AdminFormModal
      title={title}
      icon={<KeyRound className="w-4 h-4" />}
      onClose={onClose}
      error={error}
      submitLabel={showCurrent ? "Update Password" : "Reset Password"}
      onSubmit={submit}
    >
      <div className="text-[12px] text-slate-500 bg-white/[0.03] border border-white/5 rounded-lg px-3 py-2">
        Account: <span className="text-slate-300">{row.fullName}</span>
      </div>
      {showCurrent && (
        <Field label="Current Password">
          <div className="relative">
            <Lock className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <AdminInput
              type="password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              placeholder="Enter current password"
              className="pl-8"
            />
          </div>
        </Field>
      )}
      <Field label="New Password">
        <AdminInput
          type="password"
          value={next}
          onChange={(e) => setNext(e.target.value)}
          placeholder="Min 8 characters"
        />
      </Field>
      <Field label="Confirm New Password">
        <AdminInput
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Repeat new password"
        />
      </Field>
    </AdminFormModal>
  );
}
