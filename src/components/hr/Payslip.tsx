import { useEffect, useMemo, useState } from "react";
import { Download, FileText, Image as ImageIcon, Eye } from "lucide-react";
import type { UseHrSession } from "@/hooks/use-hr-session";
import {
  getPayslipsForUser,
  downloadPayslip,
  periodLabel,
  syncMyPayslips,
  type PayslipRecord,
} from "@/lib/payslips";
import { formatFileSize } from "@/lib/attachment";

interface Props {
  hr: UseHrSession;
}

function isImage(type: string): boolean {
  return type.startsWith("image/");
}

export function Payslip({ hr }: Props) {
  const session = hr.session!;
  const username = session.username;
  const [tick, setTick] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Only the logged-in employee's payslips — filtered by username at the
  // store level so another employee's payslip can never be read here.
  const payslips: PayslipRecord[] = useMemo(
    () => getPayslipsForUser(username),
    [username, tick],
  );

  const selected =
    payslips.find((p) => p.id === selectedId) || payslips[0] || null;

  const refresh = () => setTick((t) => t + 1);

  // Load the latest payslips from the server each time this screen opens.
  useEffect(() => {
    syncMyPayslips()
      .then(refresh)
      .catch(() => undefined);
  }, [username]);

  return (
    <>
      <div className="flex items-start justify-between gap-5 mb-[22px]">
        <div>
          <h1 className="text-2xl">Payslip</h1>
          <div className="text-muted-foreground text-[13.5px] mt-1">
            View your monthly payslips uploaded by HR.
          </div>
        </div>
      </div>

      {payslips.length === 0 ? (
        <div
          className="bg-card border border-border rounded-[10px] p-8 text-center"
          style={{
            boxShadow:
              "0 1px 2px rgba(22,35,59,0.06), 0 2px 10px rgba(22,35,59,0.05)",
          }}
        >
          <FileText className="w-10 h-10 mx-auto mb-3 text-muted-foreground" />
          <div className="text-[15px] font-semibold text-foreground">
            No payslip is available yet.
          </div>
          <div className="text-[13px] text-muted-foreground mt-1">
            Please contact HR if you believe your payslip should be available.
          </div>
        </div>
      ) : (
        <>
          <div className="flex gap-2 flex-wrap">
            {payslips.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedId(p.id)}
                className={[
                  "px-3.5 py-2 rounded-full border text-[13px] cursor-pointer transition-colors",
                  selected?.id === p.id
                    ? "bg-[hsl(var(--ink))] text-white border-[hsl(var(--ink))]"
                    : "bg-card text-[hsl(var(--ink))] border-border hover:bg-[hsl(var(--paper-2))]",
                ].join(" ")}
              >
                {periodLabel(p.month, p.year)}
              </button>
            ))}
          </div>

          {selected && (
            <div
              className="mt-4 bg-card border border-border rounded-[10px] overflow-hidden"
              style={{
                boxShadow:
                  "0 1px 2px rgba(22,35,59,0.06), 0 2px 10px rgba(22,35,59,0.05)",
              }}
            >
              <div
                className="p-[18px] px-[22px]"
                style={{ background: "hsl(var(--ink))", color: "#fff" }}
              >
                <div className="text-[16px]">YES EMPIRE Sdn Bhd</div>
                <div
                  className="font-mono-hr text-xs mt-0.5"
                  style={{ color: "hsl(var(--blue-light))" }}
                >
                  PAYSLIP ·{" "}
                  {periodLabel(selected.month, selected.year).toUpperCase()}
                </div>
              </div>
              <div className="p-5 px-[22px]">
                <div className="text-[13px] text-muted-foreground mb-3.5">
                  {session.profile.fullName} · {session.profile.role}
                </div>

                <PayslipRow
                  label="Payslip Period"
                  amt={periodLabel(selected.month, selected.year)}
                />
                <PayslipRow label="File" amt={selected.file.name} />
                <PayslipRow
                  label="File Size"
                  amt={formatFileSize(selected.file.size)}
                />
                {selected.note && (
                  <PayslipRow label="Note" amt={selected.note} />
                )}
                <PayslipRow
                  label="Uploaded"
                  amt={new Date(selected.createdAt).toLocaleDateString(
                    "en-GB",
                    {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    },
                  )}
                />

                {/* Preview */}
                <div className="mt-4">
                  {isImage(selected.file.type) ? (
                    <div>
                      <img
                        src={selected.file.dataUrl}
                        alt={`Payslip ${periodLabel(selected.month, selected.year)}`}
                        className="w-full rounded-lg border border-border"
                      />
                      <div className="flex gap-2 flex-wrap mt-3">
                        <a
                          href={selected.file.dataUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-border bg-transparent text-[hsl(var(--ink))] text-sm font-semibold hover:bg-[hsl(var(--paper-2))] transition-colors"
                        >
                          <Eye className="w-4 h-4" /> View Full Size
                        </a>
                        <button
                          onClick={() => downloadPayslip(selected)}
                          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-[hsl(var(--ink))] bg-[hsl(var(--ink))] text-white text-sm font-semibold hover:bg-[hsl(var(--blue-dark))] transition-colors"
                        >
                          <Download className="w-4 h-4" /> Download Payslip
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center gap-2 text-[hsl(var(--ink))] bg-[hsl(var(--paper))] border border-border rounded-lg px-4 py-3">
                        <FileText className="w-5 h-5 text-[hsl(var(--blue))]" />
                        <span className="text-sm">PDF document</span>
                      </div>
                      <div className="flex gap-2 flex-wrap mt-3">
                        <a
                          href={selected.file.dataUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-border bg-transparent text-[hsl(var(--ink))] text-sm font-semibold hover:bg-[hsl(var(--paper-2))] transition-colors"
                        >
                          <Eye className="w-4 h-4" /> View Payslip
                        </a>
                        <button
                          onClick={() => downloadPayslip(selected)}
                          className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-[hsl(var(--ink))] bg-[hsl(var(--ink))] text-white text-sm font-semibold hover:bg-[hsl(var(--blue-dark))] transition-colors"
                        >
                          <Download className="w-4 h-4" /> Download Payslip
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

function PayslipRow({ label, amt }: { label: string; amt: string }) {
  return (
    <div className="flex justify-between py-1.5 text-[13.5px] border-b border-dashed border-border">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono-hr text-foreground text-right max-w-[60%] truncate">
        {amt}
      </span>
    </div>
  );
}
