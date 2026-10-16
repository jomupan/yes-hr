import type { UseHrSession } from "@/hooks/use-hr-session";

interface Props {
  hr: UseHrSession;
}

export function Evaluation({ hr }: Props) {
  const session = hr.session!;
  const evals = session.evaluation.evaluations;

  if (!evals.length) {
    return (
      <>
        <div className="flex items-start justify-between gap-5 mb-[22px]">
          <h1 className="text-2xl">Evaluation & Performance</h1>
        </div>
        <div className="p-6 text-center text-muted-foreground text-[13.5px]">
          No evaluations yet.
        </div>
      </>
    );
  }

  const latest = evals[evals.length - 1];
  const history = [...evals].reverse();

  return (
    <>
      <div className="flex items-start justify-between gap-5 mb-[22px]">
        <div>
          <h1 className="text-2xl">Evaluation & Performance Overview</h1>
          <div className="text-muted-foreground text-[13.5px] mt-1">
            Latest evaluation: {latest.period}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        <div className="bg-card border border-border rounded-[10px] p-4">
          <div className="text-[11.5px] text-muted-foreground uppercase tracking-[0.05em]">
            Overall score
          </div>
          <div className="font-mono-hr text-[22px] font-semibold mt-1.5">
            {latest.overall}
            <span className="text-[13px] ml-1">/100</span>
          </div>
        </div>
        <div className="bg-card border border-border rounded-[10px] p-4">
          <div className="text-[11.5px] text-muted-foreground uppercase tracking-[0.05em]">
            Evaluation period
          </div>
          <div className="font-mono-hr text-[16px] font-semibold mt-1.5">
            {latest.period}
          </div>
        </div>
        <div className="bg-card border border-border rounded-[10px] p-4">
          <div className="text-[11.5px] text-muted-foreground uppercase tracking-[0.05em]">
            Number of evaluations
          </div>
          <div className="font-mono-hr text-[22px] font-semibold mt-1.5">
            {evals.length}
          </div>
        </div>
      </div>

      <div className="text-[13px] uppercase tracking-[0.06em] text-muted-foreground mt-[26px] mb-2.5">
        Score breakdown
      </div>
      <div
        className="bg-card border border-border rounded-[10px] p-[18px]"
        style={{
          boxShadow:
            "0 1px 2px rgba(22,35,59,0.06), 0 2px 10px rgba(22,35,59,0.05)",
        }}
      >
        {Object.entries(latest.categories).map(([k, v]) => (
          <div key={k} className="flex items-center gap-2.5 mb-2.5 last:mb-0">
            <div className="w-[150px] text-[13px] flex-shrink-0">
              {k.replace(/_/g, " ")}
            </div>
            <div className="flex-1 h-2 rounded-full bg-[hsl(var(--paper-2))] overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{ width: `${v}%`, background: "hsl(var(--blue))" }}
              />
            </div>
            <div className="w-[34px] text-right font-mono-hr text-[12.5px] font-semibold">
              {v}
            </div>
          </div>
        ))}
      </div>

      <div className="text-[13px] uppercase tracking-[0.06em] text-muted-foreground mt-[26px] mb-2.5">
        Evaluation history
      </div>
      <div className="bg-card border border-border rounded-[10px] overflow-hidden shadow-[0_1px_2px_rgba(22,35,59,0.06),0_2px_10px_rgba(22,35,59,0.05)]">
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr>
              {["Period", "Score", "Comments"].map((h) => (
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
            {history.map((e, i) => (
              <tr key={i}>
                <td className="px-4 py-2.5 border-b border-border last:border-b-0">
                  {e.period}
                </td>
                <td className="px-4 py-2.5 border-b border-border font-mono-hr last:border-b-0">
                  {e.overall}/100
                </td>
                <td className="px-4 py-2.5 border-b border-border last:border-b-0">
                  {e.comments}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
