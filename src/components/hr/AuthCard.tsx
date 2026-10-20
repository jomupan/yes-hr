import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { UseHrSession } from "@/hooks/use-hr-session";
import { passwordStrength, validatePassword } from "@/lib/hr-store";
import {
  getActiveDepartmentsByCompany,
  type Department,
} from "@/lib/departments";
import { getActiveCompanies, type Company } from "@/lib/companies";
import { api } from "@/lib/api";

interface Props {
  hr: UseHrSession;
}

export function AuthCard({ hr }: Props) {
  if (hr.view === "register") return <RegisterCard hr={hr} />;
  return <LoginCard hr={hr} />;
}

const YES_EMPIRE_LOGO =
  "https://vibe.filesafe.space/1786075267723187770/attachments/4e504305-8d67-43cf-b05f-f75e9736b640.webp";

function LoginCard({ hr }: Props) {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  // Ticked by default: staff log in once on their own phone and the app
  // then opens straight to Attendance. Untick on a shared device, so the
  // login ends when the app is closed (and after 30 minutes idle).
  const [remember, setRemember] = useState(true);
  const idleLogout =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("reason") === "idle";
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (submitting) return;
    setSubmitting(true);
    const role = await hr.loginWithCredentials(identifier, password, remember);
    setSubmitting(false);
    if (!role) return; // error message set in hr.authError
    // Role-based redirect
    if (role === "admin") {
      navigate("/admin/dashboard");
    } else {
      navigate("/dashboard");
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 relative"
      style={{
        background: `radial-gradient(circle at 85% -10%, hsl(var(--blue-light)/0.35), transparent 45%),
          radial-gradient(circle at 100% 10%, hsl(var(--ink)/0.25), transparent 40%),
          hsl(var(--paper))`,
      }}
    >
      <button
        onClick={hr.goToLanding}
        className="absolute top-6 left-6 text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors bg-white/50 dark:bg-black/20 px-3 py-1.5 rounded-lg border border-border"
      >
        ← Back to Home
      </button>

      <div className="w-full max-w-[380px] bg-card border border-border rounded-2xl p-8 shadow-[0_1px_2px_rgba(22,35,59,0.06),0_2px_10px_rgba(22,35,59,0.05)]">
        <div className="flex justify-center mb-4">
          <img
            src={YES_EMPIRE_LOGO}
            alt="YES EMPIRE"
            className="h-8 object-contain"
          />
        </div>
        <div className="font-mono-hr text-[11px] tracking-[0.12em] uppercase text-[hsl(var(--blue))] mb-1.5 text-center">
          HR System &middot; YES EMPIRE
        </div>
        <h1 className="text-[24px] leading-[1.15] mb-[18px] text-center">
          Log in to your account
        </h1>
        {idleLogout && (
          <div className="text-xs text-center text-muted-foreground bg-[hsl(var(--paper-2))] border border-border rounded-lg px-3 py-2 mb-4">
            You were logged out after 30 minutes of inactivity.
          </div>
        )}

        {/* Identifier */}
        <div className="mb-3.5">
          <label
            htmlFor="li-id"
            className="block text-xs text-muted-foreground mb-1.5"
          >
            Email / Staff ID
          </label>
          <input
            id="li-id"
            type="text"
            placeholder="Enter your email or Staff ID"
            autoComplete="off"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="w-full px-3 py-2.5 border border-border rounded-lg bg-[hsl(var(--paper))] text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--blue-light))] focus:border-[hsl(var(--blue))]"
          />
        </div>

        {/* Password */}
        <div className="mb-2">
          <label
            htmlFor="li-pw"
            className="block text-xs text-muted-foreground mb-1.5"
          >
            Password
          </label>
          <div className="relative">
            <input
              id="li-pw"
              type={showPw ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              className="w-full px-3 py-2.5 pr-10 border border-border rounded-lg bg-[hsl(var(--paper))] text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--blue-light))] focus:border-[hsl(var(--blue))]"
            />
            <button
              type="button"
              onClick={() => setShowPw((s) => !s)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
              tabIndex={-1}
            >
              {showPw ? "Hide" : "Show"}
            </button>
          </div>
        </div>

        {/* Remember + forgot */}
        <div className="flex items-center justify-between mb-3.5 mt-2">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="w-3.5 h-3.5 accent-[hsl(var(--blue))]"
            />
            Remember me
          </label>
          <button
            type="button"
            onClick={() => navigate("/forgot-password")}
            className="text-xs text-[hsl(var(--blue))] hover:underline"
          >
            Forgot password?
          </button>
        </div>

        {hr.authError && (
          <div className="text-[hsl(var(--red))] text-xs mt-1.5 mb-2.5">
            {hr.authError}
          </div>
        )}

        <button
          onClick={submit}
          disabled={submitting}
          className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-[hsl(var(--ink))] bg-[hsl(var(--ink))] text-white text-sm font-semibold hover:bg-[hsl(var(--blue-dark))] hover:border-[hsl(var(--blue-dark))] transition-colors disabled:opacity-50"
        >
          {submitting ? "Signing in…" : "Log in"}
        </button>

        <div className="text-xs text-muted-foreground mt-4 leading-relaxed">
          Don't have an account?{" "}
          <button
            onClick={hr.goToRegister}
            className="bg-none border-none text-[hsl(var(--blue))] text-[13px] underline cursor-pointer p-0"
          >
            Register as new staff
          </button>
        </div>
      </div>
    </div>
  );
}

function PasswordField({
  id,
  label,
  placeholder,
  value,
  onChange,
}: {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="mb-3.5">
      <label
        htmlFor={id}
        className="block text-xs text-muted-foreground mb-1.5"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? "text" : "password"}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2.5 pr-10 border border-border rounded-lg bg-[hsl(var(--paper))] text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--blue-light))] focus:border-[hsl(var(--blue))]"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
          tabIndex={-1}
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}

function StrengthBar({ pw }: { pw: string }) {
  if (!pw) return null;
  const level = passwordStrength(pw);
  const color =
    level === "strong"
      ? "hsl(var(--green))"
      : level === "medium"
        ? "hsl(var(--amber))"
        : "hsl(var(--red))";
  const width =
    level === "strong" ? "100%" : level === "medium" ? "66%" : "33%";
  return (
    <div className="mb-3.5 -mt-1">
      <div className="h-1.5 w-full rounded-full bg-[hsl(var(--paper-2))] overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width, background: color }}
        />
      </div>
      <div className="text-[11px] text-muted-foreground mt-1 capitalize">
        {level} password
      </div>
    </div>
  );
}

function RegisterCard({ hr }: Props) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Companies and departments come from the backend (active ones only), so
  // anything an admin adds shows up here. Until the server answers, or if
  // it can't be reached, the lists from this browser are shown instead.
  const [serverCompanies, setServerCompanies] = useState<Company[] | null>(null);
  const [serverDepartments, setServerDepartments] = useState<Department[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api<{ companies: Company[] }>("/public/companies", { auth: false }),
      api<{ departments: Department[] }>("/public/departments", { auth: false }),
    ])
      .then(([c, d]) => {
        if (cancelled) return;
        setServerCompanies(c.companies);
        setServerDepartments(d.departments);
      })
      .catch(() => {
        /* keep the local lists */
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const companies: Company[] = useMemo(
    () => serverCompanies ?? getActiveCompanies(),
    [serverCompanies],
  );
  // Departments are filtered by the selected company so staff can only pick a
  // department that actually belongs to their subsidiary.
  const departments: Department[] = useMemo(() => {
    if (!companyId) return [];
    if (serverDepartments) return serverDepartments.filter((d) => d.companyId === companyId);
    return getActiveDepartmentsByCompany(companyId);
  }, [companyId, serverDepartments]);

  const submit = async () => {
    if (submitting) return;
    setLocalError("");
    if (!companyId) {
      setLocalError("Please select your company.");
      return;
    }
    if (departments.length > 0 && !departmentId) {
      setLocalError("Please select your department.");
      return;
    }
    const v = validatePassword(pw);
    if (!v.ok) {
      setLocalError(v.errors[0]);
      return;
    }
    if (pw !== confirm) {
      setLocalError("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    await hr.register(name, username, role, pw, email, departmentId, companyId);
    setSubmitting(false);
  };

  const error = localError || hr.regError;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6 relative"
      style={{
        background: `radial-gradient(circle at 85% -10%, hsl(var(--blue-light)/0.35), transparent 45%),
          radial-gradient(circle at 100% 10%, hsl(var(--ink)/0.25), transparent 40%),
          hsl(var(--paper))`,
      }}
    >
      <button
        onClick={hr.goToLanding}
        className="absolute top-6 left-6 text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors bg-white/50 dark:bg-black/20 px-3 py-1.5 rounded-lg border border-border"
      >
        ← Back to Home
      </button>

      <div className="w-full max-w-[380px] bg-card border border-border rounded-2xl p-8 shadow-[0_1px_2px_rgba(22,35,59,0.06),0_2px_10px_rgba(22,35,59,0.05)]">
        <div className="flex justify-center mb-4">
          <img
            src={YES_EMPIRE_LOGO}
            alt="YES EMPIRE"
            className="h-8 object-contain"
          />
        </div>
        <div className="font-mono-hr text-[11px] tracking-[0.12em] uppercase text-[hsl(var(--blue))] mb-1.5 text-center">
          HR System &middot; YES EMPIRE
        </div>
        <h1 className="text-[24px] leading-[1.15] mb-[18px] text-center">
          Register as new staff
        </h1>
        <div className="mb-3.5">
          <label
            htmlFor="rg-name"
            className="block text-xs text-muted-foreground mb-1.5"
          >
            Full name
          </label>
          <input
            id="rg-name"
            type="text"
            placeholder="e.g. Aiman Hakim"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2.5 border border-border rounded-lg bg-[hsl(var(--paper))] text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--blue-light))] focus:border-[hsl(var(--blue))]"
          />
        </div>
        <div className="mb-3.5">
          <label
            htmlFor="rg-username"
            className="block text-xs text-muted-foreground mb-1.5"
          >
            Username
          </label>
          <input
            id="rg-username"
            type="text"
            placeholder="e.g. aiman.hakim"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-3 py-2.5 border border-border rounded-lg bg-[hsl(var(--paper))] text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--blue-light))] focus:border-[hsl(var(--blue))]"
          />
        </div>
        <div className="mb-3.5">
          <label
            htmlFor="rg-email"
            className="block text-xs text-muted-foreground mb-1.5"
          >
            Work email
          </label>
          <input
            id="rg-email"
            type="email"
            placeholder="e.g. aiman.hakim@yesempire.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2.5 border border-border rounded-lg bg-[hsl(var(--paper))] text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--blue-light))] focus:border-[hsl(var(--blue))]"
          />
        </div>
        <div className="mb-3.5">
          <label
            htmlFor="rg-co"
            className="block text-xs text-muted-foreground mb-1.5"
          >
            Company / Subsidiary
          </label>
          {companies.length === 0 ? (
            <div className="text-xs text-[hsl(var(--red))] bg-[hsl(var(--paper))] border border-border rounded-lg px-3 py-2.5">
              No companies are currently available. Please contact HR.
            </div>
          ) : (
            <select
              id="rg-co"
              value={companyId}
              onChange={(e) => {
                setCompanyId(e.target.value);
                setDepartmentId("");
              }}
              className="w-full px-3 py-2.5 border border-border rounded-lg bg-[hsl(var(--paper))] text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--blue-light))] focus:border-[hsl(var(--blue))]"
            >
              <option value="">Select company</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.code ? ` (${c.code})` : ""}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="mb-3.5">
          <label
            htmlFor="rg-dept"
            className="block text-xs text-muted-foreground mb-1.5"
          >
            Department
          </label>
          {!companyId ? (
            <div className="text-xs text-muted-foreground bg-[hsl(var(--paper))] border border-border rounded-lg px-3 py-2.5">
              Select a company first.
            </div>
          ) : departments.length === 0 ? (
            <div className="text-xs text-muted-foreground bg-[hsl(var(--paper))] border border-border rounded-lg px-3 py-2.5">
              No departments needed for this company.
            </div>
          ) : (
            <select
              id="rg-dept"
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-lg bg-[hsl(var(--paper))] text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--blue-light))] focus:border-[hsl(var(--blue))]"
            >
              <option value="">Select department</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                  {d.code ? ` (${d.code})` : ""}
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="mb-3.5">
          <label
            htmlFor="rg-role"
            className="block text-xs text-muted-foreground mb-1.5"
          >
            Position
          </label>
          <input
            id="rg-role"
            type="text"
            placeholder="e.g. Executive, Marketing"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full px-3 py-2.5 border border-border rounded-lg bg-[hsl(var(--paper))] text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--blue-light))] focus:border-[hsl(var(--blue))]"
          />
        </div>
        <PasswordField
          id="rg-pw"
          label="Create password"
          placeholder="Create your password"
          value={pw}
          onChange={setPw}
        />
        <StrengthBar pw={pw} />
        <PasswordField
          id="rg-confirm"
          label="Confirm password"
          placeholder="Confirm your password"
          value={confirm}
          onChange={setConfirm}
        />
        {error && (
          <div className="text-[hsl(var(--red))] text-xs mt-1.5 mb-2.5">
            {error}
          </div>
        )}
        <button
          onClick={submit}
          disabled={submitting}
          className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-[hsl(var(--ink))] bg-[hsl(var(--ink))] text-white text-sm font-semibold hover:bg-[hsl(var(--blue-dark))] hover:border-[hsl(var(--blue-dark))] transition-colors disabled:opacity-50"
        >
          {submitting ? "Creating account…" : "Register & continue"}
        </button>
        <div className="text-xs text-muted-foreground mt-4 leading-relaxed">
          After registering, you will be asked to complete the{" "}
          <strong>Dope Personality Test</strong> before full access is granted.
          <br />
          <br />
          Already have an account?{" "}
          <button
            onClick={hr.goToLogin}
            className="bg-none border-none text-[hsl(var(--blue))] text-[13px] underline cursor-pointer p-0"
          >
            Log in
          </button>
        </div>
      </div>
    </div>
  );
}
