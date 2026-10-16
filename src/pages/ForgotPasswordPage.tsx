import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "@/lib/api";

const YES_EMPIRE_LOGO =
  "https://vibe.filesafe.space/1786075267723187770/attachments/4e504305-8d67-43cf-b05f-f75e9736b640.webp";

/**
 * /forgot-password — Step 1 of the reset flow.
 *
 * The backend issues a single-use token (30 minutes). There is no email
 * service yet, so outside production the backend returns the token and we
 * show a link to /reset-password?token=... instead of emailing it.
 * The message shown to the user never reveals whether an account matched.
 */
export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (busy) return;
    if (!identifier.trim()) {
      setError("Please enter your email, Staff ID or username.");
      return;
    }
    setError("");
    setBusy(true);
    try {
      const res = await authApi.forgotPassword(identifier.trim());
      setSubmitted(true);
      // Only returned while there's no email service (never in production).
      setToken(res.devToken ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
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
        <h1 className="text-[24px] leading-[1.15] mb-[18px] text-center">
          Forgot your password?
        </h1>

        {!submitted ? (
          <>
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed text-center">
              Enter your registered email, Staff ID or username to continue.
            </p>
            <div className="mb-3.5">
              <label
                htmlFor="fp-id"
                className="block text-xs text-muted-foreground mb-1.5"
              >
                Email / Staff ID / Username
              </label>
              <input
                id="fp-id"
                type="text"
                placeholder="Enter your email, Staff ID or username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                className="w-full px-3 py-2.5 border border-border rounded-lg bg-[hsl(var(--paper))] text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--blue-light))] focus:border-[hsl(var(--blue))]"
              />
            </div>
            {error && (
              <div className="text-[hsl(var(--red))] text-xs mb-3">{error}</div>
            )}
            <button
              onClick={submit}
              disabled={busy}
              className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-[hsl(var(--ink))] bg-[hsl(var(--ink))] text-white text-sm font-semibold hover:bg-[hsl(var(--blue-dark))] hover:border-[hsl(var(--blue-dark))] transition-colors disabled:opacity-50"
            >
              {busy ? "Please wait…" : "Continue"}
            </button>
          </>
        ) : (
          <div className="text-center">
            <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
              If an account matches the information provided, password reset
              instructions will be sent.
            </p>
            {token ? (
              <>
                <p className="text-xs text-muted-foreground mb-2 leading-relaxed">
                  (Demo only — no email is sent.) Use the secure link below to
                  set a new password. This link expires in 30 minutes and works
                  once.
                </p>
                <button
                  onClick={() =>
                    navigate(
                      `/reset-password?token=${encodeURIComponent(token)}`,
                    )
                  }
                  className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-[hsl(var(--ink))] bg-[hsl(var(--ink))] text-white text-sm font-semibold hover:bg-[hsl(var(--blue-dark))] hover:border-[hsl(var(--blue-dark))] transition-colors"
                >
                  Continue to reset password
                </button>
              </>
            ) : (
              <button
                onClick={() => navigate("/login")}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-[hsl(var(--ink))] bg-[hsl(var(--ink))] text-white text-sm font-semibold hover:bg-[hsl(var(--blue-dark))] hover:border-[hsl(var(--blue-dark))] transition-colors"
              >
                Back to Log In
              </button>
            )}
          </div>
        )}

        <div className="text-xs text-muted-foreground mt-4 leading-relaxed text-center">
          Remembered it?{" "}
          <button
            onClick={() => navigate("/login")}
            className="bg-none border-none text-[hsl(var(--blue))] text-[13px] underline cursor-pointer p-0"
          >
            Log in
          </button>
        </div>
      </div>
    </div>
  );
}
