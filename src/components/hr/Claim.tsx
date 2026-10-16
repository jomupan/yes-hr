import { useState } from "react";
import type { ClaimType } from "@/lib/hr-types";
import type { UseHrSession } from "@/hooks/use-hr-session";
import { fmtDate, uid } from "@/lib/hr-store";
import {
  notifyClaimSubmitted,
  notifyAdminClaimSubmitted,
} from "@/lib/notification-store";
import { StatusBadge } from "./Leave";

interface Props {
  hr: UseHrSession;
}

const TYPES: ClaimType[] = ["Travel", "Medical", "Equipment", "Others"];

export function Claim({ hr }: Props) {
  const session = hr.session!;
  const [type, setType] = useState<ClaimType>("Travel");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [desc, setDesc] = useState("");
  const [error, setError] = useState("");

  const claims = [...session.claim.claims].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  const total = claims
    .filter((c) => c.status === "Approved")
    .reduce((s, c) => s + Number(c.amount), 0);

  const submit = () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0 || !date || !desc.trim()) {
      setError("Please complete all fields.");
      return;
    }
    const newClaim = {
      id: uid(),
      type,
      amount: amt,
      date,
      desc: desc.trim(),
      status: "Pending" as const,
    };
    const updated = {
      claims: [...session.claim.claims, newClaim],
    };
    hr.updateClaim(updated);
    notifyClaimSubmitted(session.username, newClaim.id);
    notifyAdminClaimSubmitted(session.profile.fullName, amt, newClaim.id);
    setAmount("");
    setDate("");
    setDesc("");
    setError("");
  };

  return (
    <>
      <div className="flex items-start justify-between gap-5 mb-[22px]">
        <div>
          <h1 className="text-2xl">Claim</h1>
          <div className="text-muted-foreground text-[13.5px] mt-1">
            Submit and track expense claims.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <div className="bg-card border border-border rounded-[10px] p-4">
          <div className="text-[11.5px] text-muted-foreground uppercase tracking-[0.05em]">
            Approved (total)
          </div>
          <div className="font-mono-hr text-[22px] font-semibold mt-1.5">
            RM {total.toFixed(0)}
          </div>
        </div>
        <div className="bg-card border border-border rounded-[10px] p-4">
          <div className="text-[11.5px] text-muted-foreground uppercase tracking-[0.05em]">
            Pending
          </div>
          <div className="font-mono-hr text-[22px] font-semibold mt-1.5">
            {claims.filter((c) => c.status === "Pending").length}
          </div>
        </div>
        <div className="bg-card border border-border rounded-[10px] p-4">
          <div className="text-[11.5px] text-muted-foreground uppercase tracking-[0.05em]">
            Rejected
          </div>
          <div className="font-mono-hr text-[22px] font-semibold mt-1.5">
            {claims.filter((c) => c.status === "Rejected").length}
          </div>
        </div>
      </div>

      <div className="text-[13px] uppercase tracking-[0.06em] text-muted-foreground mt-[26px] mb-2.5">
        Submit a new claim
      </div>
      <div
        className="bg-card border border-border rounded-[10px] p-[18px]"
        style={{
          boxShadow:
            "0 1px 2px rgba(22,35,59,0.06), 0 2px 10px rgba(22,35,59,0.05)",
        }}
      >
        <div className="flex gap-2 flex-wrap">
          {TYPES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={[
                "px-3.5 py-2 rounded-full border text-[13px] cursor-pointer transition-colors",
                t === type
                  ? "bg-[hsl(var(--ink))] text-white border-[hsl(var(--ink))]"
                  : "bg-card text-[hsl(var(--ink))] border-border hover:bg-[hsl(var(--paper-2))]",
              ].join(" ")}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3.5">
          <div>
            <label
              htmlFor="cl-amount"
              className="block text-xs text-muted-foreground mb-1.5"
            >
              Amount (RM)
            </label>
            <input
              id="cl-amount"
              type="number"
              min={0}
              step={0.01}
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-lg bg-[hsl(var(--paper))] text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--blue-light))] focus:border-[hsl(var(--blue))]"
            />
          </div>
          <div>
            <label
              htmlFor="cl-date"
              className="block text-xs text-muted-foreground mb-1.5"
            >
              Expense date
            </label>
            <input
              id="cl-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-lg bg-[hsl(var(--paper))] text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--blue-light))] focus:border-[hsl(var(--blue))]"
            />
          </div>
        </div>
        <div className="mt-3">
          <label
            htmlFor="cl-desc"
            className="block text-xs text-muted-foreground mb-1.5"
          >
            Description
          </label>
          <textarea
            id="cl-desc"
            rows={2}
            placeholder="Claim description"
            value={desc}
            onChange={(e) => setDesc(e.target.value)}
            className="w-full px-3 py-2.5 border border-border rounded-lg bg-[hsl(var(--paper))] text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--blue-light))] focus:border-[hsl(var(--blue))]"
          />
        </div>
        {error && (
          <div className="text-[hsl(var(--red))] text-xs mt-1.5">{error}</div>
        )}
        <button
          onClick={submit}
          className="mt-1.5 inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-[hsl(var(--ink))] bg-[hsl(var(--ink))] text-white text-sm font-semibold hover:bg-[hsl(var(--blue-dark))] hover:border-[hsl(var(--blue-dark))] transition-colors"
        >
          Submit claim
        </button>
      </div>

      <div className="text-[13px] uppercase tracking-[0.06em] text-muted-foreground mt-[26px] mb-2.5">
        Claim history
      </div>
      <div className="bg-card border border-border rounded-[10px] overflow-hidden shadow-[0_1px_2px_rgba(22,35,59,0.06),0_2px_10px_rgba(22,35,59,0.05)]">
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr>
              {["Type", "Description", "Amount", "Date", "Status"].map((h) => (
                <th
                  key={h}
                  className="text-left text-[11px] uppercase tracking-[0.04em] text-muted-foreground px-4 py-2.5 border-b border-border"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {claims.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="p-6 text-center text-muted-foreground text-[13.5px]"
                >
                  No claims yet.
                </td>
              </tr>
            ) : (
              claims.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2.5 border-b border-border last:border-b-0">
                    {c.type}
                  </td>
                  <td className="px-4 py-2.5 border-b border-border last:border-b-0">
                    {c.desc}
                  </td>
                  <td className="px-4 py-2.5 border-b border-border font-mono-hr last:border-b-0">
                    RM {Number(c.amount).toFixed(2)}
                  </td>
                  <td className="px-4 py-2.5 border-b border-border font-mono-hr last:border-b-0">
                    {fmtDate(c.date)}
                  </td>
                  <td className="px-4 py-2.5 border-b border-border last:border-b-0">
                    <StatusBadge status={c.status} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
