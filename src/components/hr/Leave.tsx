import { useEffect, useState } from "react";
import { Paperclip, X } from "lucide-react";
import type { LeaveAttachment, LeaveType } from "@/lib/hr-types";
import type { UseHrSession } from "@/hooks/use-hr-session";
import {
  buildAttachment,
  daysBetween,
  downloadAttachment,
  fmtDate,
  formatFileSize,
  validateAttachment,
} from "@/lib/hr-store";
import { applyLeave, fetchMyLeave } from "@/lib/api-hr";

interface Props {
  hr: UseHrSession;
}

export function Leave({ hr }: Props) {
  const session = hr.session!;
  // "Annual" / "Medical" / "Emergency", or "rep:<id>" for a replacement leave.
  const [type, setType] = useState<string>("Annual");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [attachment, setAttachment] = useState<LeaveAttachment | null>(null);
  const [fileError, setFileError] = useState("");
  const [saving, setSaving] = useState(false);

  // Show the latest status from the server (e.g. approved by an admin).
  const updateLeave = hr.updateLeave;
  const refreshFromServer = async () => updateLeave(await fetchMyLeave());
  useEffect(() => {
    refreshFromServer().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const types = Object.keys(session.leave.balance) as LeaveType[];
  // Replacement leave given by HR. Only unexpired ones with days left can be applied for.
  const reps = session.leave.replacement || [];
  const usableReps = reps.filter((r) => !r.expired && r.balance > 0);
  const selectedRep = type.startsWith("rep:")
    ? reps.find((r) => `rep:${r.id}` === type)
    : undefined;
  const apps = [...session.leave.applications].sort(
    (a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime(),
  );

  // Medical leave conventionally requires a supporting document (MC / letter).
  const attachmentRequired = type === "Medical";
  // Replacement leave needs no reason or supporting document.
  const isReplacement = type.startsWith("rep:");

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError("");
    const file = e.target.files?.[0];
    if (!file) return;
    const v = validateAttachment(file);
    if (!v.ok) {
      setFileError(v.error || "Invalid file.");
      setAttachment(null);
      e.target.value = "";
      return;
    }
    try {
      const att = await buildAttachment(file);
      if (!att) {
        setFileError("Could not process the file.");
        return;
      }
      setAttachment(att);
    } catch {
      setFileError("Could not read the file.");
    } finally {
      e.target.value = "";
    }
  };

  const submit = async () => {
    if (saving) return;
    if (!from || !to || (!isReplacement && !reason.trim())) {
      setError("Please complete all fields.");
      return;
    }
    if (new Date(to) < new Date(from)) {
      setError("End date must be after the start date.");
      return;
    }
    if (attachmentRequired && !attachment) {
      setError("A supporting document is required for Medical leave.");
      return;
    }
    const days = daysBetween(from, to) + 1;
    if (selectedRep) {
      if (days > selectedRep.balance) {
        setError(`Insufficient ${selectedRep.name} balance.`);
        return;
      }
      if (selectedRep.expiresOn && to > selectedRep.expiresOn) {
        setError(
          `${selectedRep.name} must be used by ${fmtDate(selectedRep.expiresOn)}.`,
        );
        return;
      }
    } else if (days > session.leave.balance[type as LeaveType]) {
      setError(`Insufficient ${type} leave balance.`);
      return;
    }
    setSaving(true);
    try {
      // The server re-checks everything (balance, overlapping dates,
      // Medical certificate, replacement expiry) and notifies the admins.
      await applyLeave({
        type: selectedRep ? "Replacement" : (type as LeaveType),
        replacementId: selectedRep?.id,
        from,
        to,
        reason: isReplacement ? "" : reason.trim(),
        attachment: isReplacement ? null : attachment,
      });
      await refreshFromServer();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Couldn't submit. Please try again.",
      );
      return;
    } finally {
      setSaving(false);
    }
    setFrom("");
    setTo("");
    setReason("");
    setAttachment(null);
    setFileError("");
    setError("");
  };

  return (
    <>
      <div className="flex items-start justify-between gap-5 mb-[22px]">
        <div>
          <h1 className="text-2xl">Leave</h1>
          <div className="text-muted-foreground text-[13.5px] mt-1">
            Apply for leave and check your leave balance.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {types.map((t) => (
          <div
            key={t}
            className="bg-card border border-border rounded-[10px] p-4"
          >
            <div className="text-[11.5px] text-muted-foreground uppercase tracking-[0.05em]">
              {t}
            </div>
            <div className="font-mono-hr text-[22px] font-semibold mt-1.5">
              {session.leave.balance[t]}
              <span className="text-[13px] ml-1">days</span>
            </div>
          </div>
        ))}
        {reps.map((r) => (
          <div
            key={r.id}
            className={[
              "bg-card border border-border rounded-[10px] p-4",
              r.expired || r.balance === 0 ? "opacity-60" : "",
            ].join(" ")}
          >
            <div className="text-[11.5px] text-muted-foreground uppercase tracking-[0.05em]">
              {r.name}
            </div>
            <div className="font-mono-hr text-[22px] font-semibold mt-1.5">
              {r.balance}
              <span className="text-[13px] ml-1">days</span>
            </div>
            {r.expiresOn && (
              <div
                className={[
                  "text-[11.5px] mt-1",
                  r.expired
                    ? "text-[hsl(var(--red))]"
                    : "text-muted-foreground",
                ].join(" ")}
              >
                {r.expired ? "Expired" : "Use by"} {fmtDate(r.expiresOn)}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="text-[13px] uppercase tracking-[0.06em] text-muted-foreground mt-[26px] mb-2.5">
        Apply for leave
      </div>
      <div
        className="bg-card border border-border rounded-[10px] p-[18px]"
        style={{
          boxShadow:
            "0 1px 2px rgba(22,35,59,0.06), 0 2px 10px rgba(22,35,59,0.05)",
        }}
      >
        <div className="flex gap-2 flex-wrap">
          {types.map((t) => (
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
          {usableReps.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setType(`rep:${r.id}`)}
              className={[
                "px-3.5 py-2 rounded-full border text-[13px] cursor-pointer transition-colors",
                type === `rep:${r.id}`
                  ? "bg-[hsl(var(--ink))] text-white border-[hsl(var(--ink))]"
                  : "bg-card text-[hsl(var(--ink))] border-border hover:bg-[hsl(var(--paper-2))]",
              ].join(" ")}
            >
              {r.name}
            </button>
          ))}
        </div>
        {selectedRep?.expiresOn && (
          <div className="text-[12px] text-muted-foreground mt-2">
            {selectedRep.name}: {selectedRep.balance} day(s) left, use by{" "}
            {fmtDate(selectedRep.expiresOn)}.
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3.5">
          <div>
            <label
              htmlFor="lv-from"
              className="block text-xs text-muted-foreground mb-1.5"
            >
              Start date
            </label>
            <input
              id="lv-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-lg bg-[hsl(var(--paper))] text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--blue-light))] focus:border-[hsl(var(--blue))]"
            />
          </div>
          <div>
            <label
              htmlFor="lv-to"
              className="block text-xs text-muted-foreground mb-1.5"
            >
              End date
            </label>
            <input
              id="lv-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full px-3 py-2.5 border border-border rounded-lg bg-[hsl(var(--paper))] text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--blue-light))] focus:border-[hsl(var(--blue))]"
            />
          </div>
        </div>
        {!isReplacement && (
          <>
            <div className="mt-3">
              <label
                htmlFor="lv-reason"
                className="block text-xs text-muted-foreground mb-1.5"
              >
                Reason
              </label>
              <textarea
                id="lv-reason"
                rows={2}
                placeholder="State the reason for your leave application"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2.5 border border-border rounded-lg bg-[hsl(var(--paper))] text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-[hsl(var(--blue-light))] focus:border-[hsl(var(--blue))]"
              />
            </div>

            {/* Supporting document */}
            <div className="mt-3">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs text-muted-foreground">
                  Supporting document
                  {attachmentRequired && (
                    <span className="text-[hsl(var(--red))] ml-1">
                      * Required
                    </span>
                  )}
                </label>
              </div>
              {attachment ? (
                <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-border bg-[hsl(var(--paper))]">
                  <div className="flex items-center gap-2 min-w-0">
                    <Paperclip
                      className="text-[hsl(var(--blue))] flex-shrink-0"
                      style={{ width: 16, height: 16 }}
                    />
                    <div className="min-w-0">
                      <div className="text-sm truncate">{attachment.name}</div>
                      <div className="font-mono-hr text-[11px] text-muted-foreground">
                        {formatFileSize(attachment.size)}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttachment(null)}
                    className="text-muted-foreground hover:text-[hsl(var(--red))] flex-shrink-0"
                    title="Remove file"
                  >
                    <X style={{ width: 16, height: 16 }} />
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-border bg-[hsl(var(--paper))] text-sm text-muted-foreground cursor-pointer hover:border-[hsl(var(--blue-light))] transition-colors">
                  <Paperclip style={{ width: 16, height: 16 }} />
                  Upload supporting document
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                    onChange={onFileChange}
                    className="hidden"
                  />
                </label>
              )}
              <div className="text-[11px] text-muted-foreground mt-1">
                Accepted formats: PDF, JPG, JPEG, PNG · Maximum file size: 4 MB
              </div>
              {fileError && (
                <div className="text-[hsl(var(--red))] text-xs mt-1">
                  {fileError}
                </div>
              )}
            </div>
          </>
        )}
        {error && (
          <div className="text-[hsl(var(--red))] text-xs mt-1.5">{error}</div>
        )}
        <button
          onClick={submit}
          disabled={saving}
          className="mt-1.5 inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-[hsl(var(--ink))] bg-[hsl(var(--ink))] text-white text-sm font-semibold hover:bg-[hsl(var(--blue-dark))] hover:border-[hsl(var(--blue-dark))] transition-colors disabled:opacity-50"
        >
          {saving ? "Submitting…" : "Submit application"}
        </button>
      </div>

      <div className="text-[13px] uppercase tracking-[0.06em] text-muted-foreground mt-[26px] mb-2.5">
        Application history
      </div>
        <div className="bg-card border border-border rounded-[10px] overflow-x-auto shadow-[0_1px_2px_rgba(22,35,59,0.06),0_2px_10px_rgba(22,35,59,0.05)]">
        <table className="w-full min-w-[640px] border-collapse text-[13.5px]">
          <thead>
            <tr>
              {["Type", "Period", "Reason", "Attachment", "Status"].map((h) => (
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
            {apps.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="p-6 text-center text-muted-foreground text-[13.5px]"
                >
                  No applications yet.
                </td>
              </tr>
            ) : (
              apps.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-2.5 border-b border-border align-top last:border-b-0">
                    {a.typeLabel || a.type}
                  </td>
                  <td className="px-4 py-2.5 border-b border-border font-mono-hr align-top last:border-b-0">
                    {fmtDate(a.from)} → {fmtDate(a.to)}
                  </td>
                  <td className="px-4 py-2.5 border-b border-border align-top last:border-b-0">
                    {a.reason}
                    {a.status === "Rejected" && a.rejectionReason && (
                      <div className="text-[12px] text-[hsl(var(--red))] mt-1">
                        Reason: {a.rejectionReason}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 border-b border-border align-top last:border-b-0">
                    {a.attachment ? (
                      <button
                        onClick={() => downloadAttachment(a.attachment!)}
                        className="text-[hsl(var(--blue))] text-xs underline hover:opacity-70 inline-flex items-center gap-1"
                      >
                        <Paperclip style={{ width: 13, height: 13 }} />
                        View
                      </button>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 border-b border-border align-top last:border-b-0">
                    <StatusBadge status={a.status} />
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

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    pending: { bg: "hsl(var(--amber-pale))", color: "#8A6218" },
    approved: { bg: "hsl(var(--green-pale))", color: "hsl(var(--green))" },
    rejected: { bg: "hsl(var(--red-pale))", color: "hsl(var(--red))" },
    paid: { bg: "hsl(var(--blue-pale))", color: "hsl(var(--blue-dark))" },
  };
  const s = map[status.toLowerCase()] || map.pending;
  return (
    <span
      className="inline-block px-2.5 py-[3px] rounded-full text-[11px] font-semibold"
      style={{ background: s.bg, color: s.color }}
    >
      {status}
    </span>
  );
}
