import { useState } from "react";
import { UserRound, KeyRound } from "lucide-react";
import type { UseHrSession } from "@/hooks/use-hr-session";
import type { UserProfile } from "@/lib/hr-types";
import { api } from "@/lib/api";
import { getUser, setJSON, validatePassword } from "@/lib/hr-store";
import { companyOf, departmentOf } from "@/lib/admin-store";

interface Props {
  hr: UseHrSession;
}

const card =
  "bg-card border border-border rounded-[10px] p-5 mb-4";
const cardShadow = {
  boxShadow: "0 1px 2px rgba(22,35,59,0.06), 0 2px 10px rgba(22,35,59,0.05)",
};
const input =
  "w-full px-3 py-2.5 border border-border rounded-lg bg-[hsl(var(--paper))] text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--blue-light))] focus:border-[hsl(var(--blue))]";
const label = "block text-xs text-muted-foreground mb-1.5";
const button =
  "inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-[hsl(var(--ink))] bg-[hsl(var(--ink))] text-white text-sm font-semibold hover:bg-[hsl(var(--blue-dark))] transition-colors disabled:opacity-60";

/** Staff "My Profile": view details, edit name / email / position, and
 *  change password. Company and department are set by HR (admin). */
export function MyProfile({ hr }: Props) {
  const session = hr.session!;
  const p = session.profile;

  const [fullName, setFullName] = useState(p.fullName || "");
  const [email, setEmail] = useState(p.email || "");
  const [role, setRole] = useState(p.role || "");
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsMsg, setDetailsMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const saveDetails = async () => {
    if (savingDetails) return;
    setDetailsMsg(null);
    if (!fullName.trim()) return setDetailsMsg({ ok: false, text: "Please enter your full name." });
    if (!email.trim()) return setDetailsMsg({ ok: false, text: "Please enter your email." });
    setSavingDetails(true);
    try {
      const res = await api<{ profile: UserProfile }>("/me/profile", {
        method: "PATCH",
        body: { fullName: fullName.trim(), email: email.trim(), role: role.trim() },
      });
      // Update this phone's copy so the new name shows everywhere at once.
      const existing = getUser(session.username) || p;
      setJSON(`hr:user:${session.username}`, {
        ...existing,
        ...res.profile,
        companyId: res.profile.companyId ?? undefined,
        departmentId: res.profile.departmentId ?? undefined,
      });
      hr.refresh();
      setDetailsMsg({ ok: true, text: "Your details have been saved." });
    } catch (e) {
      setDetailsMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't save. Please try again." });
    } finally {
      setSavingDetails(false);
    }
  };

  const changePassword = async () => {
    if (savingPw) return;
    setPwMsg(null);
    if (!currentPw) return setPwMsg({ ok: false, text: "Please enter your current password." });
    const v = validatePassword(newPw);
    if (!v.ok) return setPwMsg({ ok: false, text: v.errors[0] });
    if (newPw !== confirmPw) return setPwMsg({ ok: false, text: "New passwords do not match." });
    if (newPw === currentPw)
      return setPwMsg({ ok: false, text: "Your new password must be different from the current one." });
    setSavingPw(true);
    try {
      await api("/auth/change-password", { body: { currentPassword: currentPw, newPassword: newPw } });
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setPwMsg({ ok: true, text: "Password changed. Use your new password next time you log in." });
    } catch (e) {
      setPwMsg({ ok: false, text: e instanceof Error ? e.message : "Couldn't change password. Please try again." });
    } finally {
      setSavingPw(false);
    }
  };

  const Msg = ({ m }: { m: { ok: boolean; text: string } | null }) =>
    m ? (
      <div
        className={[
          "text-xs rounded-lg px-3 py-2.5 mt-3 border",
          m.ok
            ? "text-[hsl(var(--green))] bg-[hsl(var(--paper))] border-border"
            : "text-[hsl(var(--red))] bg-[hsl(var(--paper))] border-border",
        ].join(" ")}
      >
        {m.text}
      </div>
    ) : null;

  return (
    <>
      <div className="mb-[22px]">
        <h1 className="text-2xl">My Profile</h1>
        <div className="text-muted-foreground text-[13.5px] mt-1">
          Check your details and change your password.
        </div>
      </div>

      {/* Details */}
      <div className={card} style={cardShadow}>
        <div className="flex items-center gap-2 mb-4">
          <UserRound className="w-4 h-4 text-[hsl(var(--blue))]" />
          <h3 className="text-[15px]">My details</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 text-[13px]">
          <Info label="Username" value={session.username} />
          <Info label="Staff ID" value={p.employeeId || "-"} />
          <Info label="Company" value={companyOf(p)} />
          <Info label="Department" value={p.departmentId ? departmentOf(p) : "-"} />
        </div>
        <div className="text-[11.5px] text-muted-foreground mb-4">
          To change your company or department, please contact HR.
        </div>

        <div className="mb-3.5">
          <label htmlFor="pf-name" className={label}>Full name</label>
          <input id="pf-name" className={input} value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="mb-3.5">
          <label htmlFor="pf-email" className={label}>Email</label>
          <input id="pf-email" type="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="mb-4">
          <label htmlFor="pf-role" className={label}>Position</label>
          <input
            id="pf-role"
            className={input}
            value={role}
            placeholder="e.g. Executive, Marketing"
            onChange={(e) => setRole(e.target.value)}
          />
        </div>
        <button type="button" className={button} onClick={() => void saveDetails()} disabled={savingDetails}>
          {savingDetails ? "Saving…" : "Save details"}
        </button>
        <Msg m={detailsMsg} />
      </div>

      {/* Password */}
      <div className={card} style={cardShadow}>
        <div className="flex items-center gap-2 mb-4">
          <KeyRound className="w-4 h-4 text-[hsl(var(--blue))]" />
          <h3 className="text-[15px]">Change password</h3>
        </div>
        <div className="mb-3.5">
          <label htmlFor="pf-cur" className={label}>Current password</label>
          <input
            id="pf-cur"
            type="password"
            autoComplete="current-password"
            className={input}
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
          />
        </div>
        <div className="mb-3.5">
          <label htmlFor="pf-new" className={label}>New password</label>
          <input
            id="pf-new"
            type="password"
            autoComplete="new-password"
            className={input}
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
          />
        </div>
        <div className="mb-4">
          <label htmlFor="pf-confirm" className={label}>Confirm new password</label>
          <input
            id="pf-confirm"
            type="password"
            autoComplete="new-password"
            className={input}
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
          />
        </div>
        <button type="button" className={button} onClick={() => void changePassword()} disabled={savingPw}>
          {savingPw ? "Saving…" : "Change password"}
        </button>
        <Msg m={pwMsg} />
      </div>
    </>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[hsl(var(--paper))] border border-border rounded-lg px-3 py-2.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="text-foreground font-medium break-words">{value}</div>
    </div>
  );
}