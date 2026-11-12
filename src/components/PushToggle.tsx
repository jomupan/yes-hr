import { useEffect, useState } from "react";
import { BellRing } from "lucide-react";
import { disablePush, enablePush, getPushState, type PushState } from "@/lib/push";

const MESSAGES: Record<PushState, string> = {
  unsupported: "This browser can't show phone notifications. Try Chrome on Android, or the installed app on iPhone.",
  "needs-install":
    "On iPhone: tap Share, then 'Add to Home Screen', open the app from the new icon, and turn this on there.",
  "server-off": "Phone notifications aren't set up on the server yet. Please ask HR.",
  blocked: "Notifications are blocked for this app. Allow them in your phone's Settings, then come back here.",
  off: "Get a notification on this phone for approvals, new calendar notes, and clock-in / clock-out reminders.",
  on: "Notifications are on for this phone.",
};

/** "Phone notifications" on/off card. `dark` for the admin portal. */
export function PushToggle({ dark = false }: { dark?: boolean }) {
  const [state, setState] = useState<PushState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getPushState()
      .then(setState)
      .catch(() => setState("unsupported"));
  }, []);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      setState(state === "on" ? await disablePush() : await enablePush());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't change notifications. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (!state) return null;
  const canToggle = state === "on" || state === "off";
  const box = dark
    ? "bg-[#111726] border border-white/10 rounded-[12px] p-4 mb-5"
    : "bg-card border border-border rounded-[10px] p-4 mb-[18px]";
  const title = dark ? "text-sm font-semibold text-white" : "text-[14px] font-semibold";
  const text = dark ? "text-[12.5px] text-slate-400" : "text-[12.5px] text-muted-foreground";

  return (
    <div className={box}>
      <div className="flex items-start gap-3">
        <BellRing className={`w-5 h-5 flex-shrink-0 mt-0.5 ${dark ? "text-amber-300" : "text-[hsl(var(--blue))]"}`} />
        <div className="flex-1 min-w-0">
          <div className={title}>Phone notifications</div>
          <div className={`${text} mt-0.5`}>{MESSAGES[state]}</div>
          {error && <div className="text-xs text-rose-500 mt-1">{error}</div>}
        </div>
        {canToggle && (
          <button
            type="button"
            onClick={() => void toggle()}
            disabled={busy}
            className={[
              "flex-shrink-0 px-3.5 py-2 rounded-lg text-[13px] font-semibold transition-colors disabled:opacity-60",
              state === "on"
                ? dark
                  ? "border border-white/15 text-slate-300 hover:bg-white/5"
                  : "border border-border text-[hsl(var(--ink))] hover:bg-[hsl(var(--paper-2))]"
                : dark
                  ? "bg-amber-500 text-black hover:bg-amber-400"
                  : "bg-[hsl(var(--ink))] text-white hover:bg-[hsl(var(--blue-dark))]",
            ].join(" ")}
          >
            {busy ? "…" : state === "on" ? "Turn off" : "Turn on"}
          </button>
        )}
      </div>
    </div>
  );
}
