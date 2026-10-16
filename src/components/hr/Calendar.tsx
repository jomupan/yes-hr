import { useState } from "react";
import type { UseHrSession } from "@/hooks/use-hr-session";
import { HOLIDAYS_2026 } from "@/lib/hr-constants";
import { fmtDate, todayISO } from "@/lib/hr-store";

interface Props {
  hr: UseHrSession;
}

const DOWS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarView({ hr }: Props) {
  const [offset, setOffset] = useState(0);

  const base = new Date();
  const view0 = new Date(base.getFullYear(), base.getMonth() + offset, 1);
  const year = view0.getFullYear();
  const month = view0.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = view0.toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < firstDow; i++) {
    cells.push(<div key={`e-${i}`} className="aspect-square" />);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const isToday = iso === todayISO();
    const holiday = HOLIDAYS_2026[iso];
    cells.push(
      <div
        key={iso}
        className={[
          "aspect-square rounded-lg border p-1.5 text-xs flex flex-col relative",
          holiday ? "border-[#E7CE9C]" : "border-border",
        ].join(" ")}
        style={{
          background: holiday ? "hsl(var(--amber-pale))" : "hsl(var(--card))",
          outline: isToday ? "2px solid hsl(var(--blue))" : undefined,
          outlineOffset: isToday ? "-2px" : undefined,
        }}
      >
        <div className="font-mono-hr font-semibold">{d}</div>
        {holiday && (
          <div className="text-[9.5px] text-[hsl(var(--amber))] mt-auto leading-tight">
            {holiday}
          </div>
        )}
      </div>,
    );
  }

  const upcoming = Object.entries(HOLIDAYS_2026)
    .filter(([d]) => new Date(d) >= new Date(todayISO()))
    .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
    .slice(0, 5);

  return (
    <>
      <div className="flex items-start justify-between gap-5 mb-[22px] flex-wrap">
        <div>
          <h1 className="text-2xl">Calendar</h1>
          <div className="text-muted-foreground text-[13.5px] mt-1">
            Company calendar and public holidays.
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setOffset((o) => o - 1)}
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-border bg-transparent text-[hsl(var(--ink))] text-sm font-semibold hover:bg-[hsl(var(--paper-2))] transition-colors"
          >
            ←
          </button>
          <div className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-border bg-transparent text-[hsl(var(--ink))] text-sm font-semibold cursor-default">
            {monthLabel}
          </div>
          <button
            onClick={() => setOffset((o) => o + 1)}
            className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-border bg-transparent text-[hsl(var(--ink))] text-sm font-semibold hover:bg-[hsl(var(--paper-2))] transition-colors"
          >
            →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {DOWS.map((d) => (
          <div
            key={d}
            className="text-[11px] text-muted-foreground text-center pb-1 uppercase"
          >
            {d}
          </div>
        ))}
        {cells}
      </div>

      <div className="text-[13px] uppercase tracking-[0.06em] text-muted-foreground mt-[26px] mb-2.5">
        Upcoming public holidays
      </div>
      <div className="bg-card border border-border rounded-[10px] overflow-hidden shadow-[0_1px_2px_rgba(22,35,59,0.06),0_2px_10px_rgba(22,35,59,0.05)]">
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr>
              {["Date", "Holiday"].map((h) => (
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
            {upcoming.length === 0 ? (
              <tr>
                <td
                  colSpan={2}
                  className="p-6 text-center text-muted-foreground text-[13.5px]"
                >
                  No holidays scheduled.
                </td>
              </tr>
            ) : (
              upcoming.map(([d, name]) => (
                <tr key={d}>
                  <td className="px-4 py-2.5 border-b border-border font-mono-hr last:border-b-0">
                    {fmtDate(d)}
                  </td>
                  <td className="px-4 py-2.5 border-b border-border last:border-b-0">
                    {name}
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
