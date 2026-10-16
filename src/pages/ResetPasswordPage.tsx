import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { validatePassword, passwordStrength } from "@/lib/hr-store";
import { authApi } from "@/lib/api";

const YES_EMPIRE_LOGO =
  "https://vibe.filesafe.space/1786075267723187770/attachments/4e504305-8d67-43cf-b05f-f75e9736b640.webp";

/** /reset-password?token=... — set a new password using a single-use token. */
export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get("token") || "";

  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const [busy, setBusy] = useState(false);
  // null = still checking the link with the server.
  const [valid, setValid] = useState<boolean | null>(token ? null : false);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    authApi
      .checkResetToken(token)
      .then((r) => !cancelled && setValid(r.valid))
      .catch(() => !cancelled && setValid(false));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const submit = async () => {
    if (busy) return;
    setError("");
    const v = validatePassword(pw);
    if (!v.ok) {
      setError(v.errors[0]);
      return;
    }
    if (pw !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setBusy(true);
    try {
      await authApi.resetPassword(token, pw);
      setDone(true);
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? e.message
          : "This reset link is invalid or has expired. Please request a new one.",
      );
    } finally {
      setBusy(false);
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
        onClick={() => navigate("/login")}
        className="absolute top-6 left-6 text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1.5 transition-colors bg-white/50 dark:bg-black/20 px-3 py-1.5 rounded-lg border border-border"
      >
        ← Back to Login
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

        {done ? (
          <div className="text-center">
            <h1 className="text-[22px] leading-[1.2] mb-3">
              Your password has been reset successfully.
            </h1>
            <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
              You can now log in with your new password.
            </p>
            <button
              onClick={() => navigate("/login")}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-[hsl(var(--ink))] bg-[hsl(var(--ink))] text-white text-sm font-semibold hover:bg-[hsl(var(--blue-dark))] hover:border-[hsl(var(--blue-dark))] transition-colors"
            >
              Back to Log In
            </button>
          </div>
        ) : valid === null ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            Checking your reset link…
          </p>
        ) : !valid ? (
          <div className="text-center">
            <h1 className="text-[22px] leading-[1.2] mb-3">
              Invalid or expired link
            </h1>
            <p className="text-xs text-muted-foreground mb-5 leading-relaxed">
              This password reset link is invalid or has expired. Please request
              a new one.
            </p>
            <button
              onClick={() => navigate("/forgot-password")}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-[hsl(var(--ink))] bg-[hsl(var(--ink))] text-white text-sm font-semibold hover:bg-[hsl(var(--blue-dark))] hover:border-[hsl(var(--blue-dark))] transition-colors"
            >
              Request new link
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-[24px] leading-[1.15] mb-[18px] text-center">
              Create new password
            </h1>
            <div className="mb-3.5">
              <label
                htmlFor="rp-pw"
                className="block text-xs text-muted-foreground mb-1.5"
              >
                New password
              </label>
              <div className="relative">
                <input
                  id="rp-pw"
                  type={show ? "text" : "password"}
                  placeholder="Enter your new password"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
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
            {pw && (
              <div className="mb-3.5 -mt-1">
                <div className="h-1.5 w-full rounded-full bg-[hsl(var(--paper-2))] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width:
                        passwordStrength(pw) === "strong"
                          ? "100%"
                          : passwordStrength(pw) === "medium"
                            ? "66%"
                            : "33%",
                      background:
                        passwordStrength(pw) === "strong"
                          ? "hsl(var(--green))"
                          : passwordStrength(pw) === "medium"
                            ? "hsl(var(--amber))"
                            : "hsl(var(--red))",
                    }}
                  />
                </div>
                <div className="text-[11px] text-muted-foreground mt-1 capitalize">
                  {passwordStrength(pw)} password
                </div>
              </div>
            )}
            <div className="mb-3.5">
              <label
                htmlFor="rp-confirm"
                className="block text-xs text-muted-foreground mb-1.5"
              >
                Confirm new password
              </label>
              <div className="relative">
                <input
                  id="rp-confirm"
                  type={show ? "text" : "password"}
                  placeholder="Confirm your new password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submit()}
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
            {error && (
              <div className="text-[hsl(var(--red))] text-xs mt-1.5 mb-2.5">
                {error}
              </div>
            )}
            <button
              onClick={submit}
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-[hsl(var(--ink))] bg-[hsl(var(--ink))] text-white text-sm font-semibold hover:bg-[hsl(var(--blue-dark))] hover:border-[hsl(var(--blue-dark))] transition-colors disabled:opacity-50"
            >
              {busy ? "Saving…" : "Reset password"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
