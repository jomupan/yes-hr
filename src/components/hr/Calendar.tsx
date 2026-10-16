import { useState } from "react";
import type { UseHrSession } from "@/hooks/use-hr-session";
import { HOLIDAYS_2026 } from "@/lib/hr-constants";
import { fmtDate, todayISO } from "@/lib/hr-store";
import {
  CATEGORY_LABEL,
  notesOn,
  useCalendarNotes,
  type CalendarCategory,
  type CalendarNote,
} from "@/lib/api-calendar";

/* Colours for company notes, from the app's own palette. */
const NOTE_STYLE: Record<CalendarCategory, { bg: string; fg: string }> = {
  event: { bg: "hsl(var(--blue-pale))", fg: "hsl(var(--blue))" },
  holiday: { bg: "hsl(var(--amber-pale))", fg: "hsl(var(--amber))" },
  reminder: { bg: "hsl(var(--green-pale))", fg: "hsl(var(--green))" },
};

function noteDates(n: CalendarNote): string {
  return n.from === n.to ? fmtDate(n.from) : `${fmtDate(n.from)} – ${fmtDate(n.to)}`;
}

interface Props {
  hr: UseHrSession;
}

const DOWS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarView({ hr }: Props) {
  const [offset, setOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

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
  // Notes the admin has added for this month (shared with all staff).
  const { notes } = useCalendarNotes(year, month);

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < firstDow; i++) {
    cells.push(<div key={`e-${i}`} className="aspect-square" />);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const isToday = iso === todayISO();
    const holiday = HOLIDAYS_2026[iso];
    const dayNotes = notesOn(notes, iso);
    const selected = selectedDay === iso;
    cells.push(
      <button
        type="button"
        key={iso}
        onClick={() => setSelectedDay(selected ? null : iso)}
        aria-label={`${fmtDate(iso)}${dayNotes.length ? `, ${dayNotes.length} note(s)` : ""}`}
        className={[
          "aspect-square rounded-lg border p-1 sm:p-1.5 text-xs flex flex-col relative text-left overflow-hidden",
          holiday ? "border-[#E7CE9C]" : "border-border",
        ].join(" ")}
        style={{
          background: holiday ? "hsl(var(--amber-pale))" : "hsl(var(--card))",
          outline: selected
            ? "2px solid hsl(var(--ink))"
            : isToday
              ? "2px solid hsl(var(--blue))"
              : undefined,
          outlineOffset: selected || isToday ? "-2px" : undefined,
        }}
      >
        <div className="font-mono-hr font-semibold">{d}</div>
        <div className="mt-auto space-y-0.5 min-w-0">
          {holiday && (
            <div className="hidden sm:block text-[9.5px] text-[hsl(var(--amber))] leading-tight truncate">
              {holiday}
            </div>
          )}
          {dayNotes.slice(0, 1).map((n) => (
            <div
              key={n.id}
              className="hidden sm:block text-[9.5px] leading-tight truncate rounded px-1"
              style={{ background: NOTE_STYLE[n.category].bg, color: NOTE_STYLE[n.category].fg }}
            >
              {n.title}
            </div>
          ))}
          {dayNotes.length > 1 && (
            <div className="hidden sm:block text-[9px] text-muted-foreground">
              +{dayNotes.length - 1} more
            </div>
          )}
          {/* Phones: small dots instead of text */}
          {(dayNotes.length > 0 || holiday) && (
            <div className="flex gap-0.5 sm:hidden">
              {holiday && <span className="w-1.5 h-1.5 rounded-full" style={{ background: "hsl(var(--amber))" }} />}
              {dayNotes.slice(0, 3).map((n) => (
                <span key={n.id} className="w-1.5 h-1.5 rounded-full" style={{ background: NOTE_STYLE[n.category].fg }} />
              ))}
            </div>
          )}
        </div>
      </button>,
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

      {/* Notes for the tapped day */}
      {selectedDay && (
        <div className="mt-4 bg-card border border-border rounded-[10px] p-4">
          <div className="text-[13px] font-semibold mb-2">{fmtDate(selectedDay)}</div>
          {HOLIDAYS_2026[selectedDay] && (
            <div className="text-[13px] text-[hsl(var(--amber))] mb-2">
              Public holiday: {HOLIDAYS_2026[selectedDay]}
            </div>
          )}
          {notesOn(notes, selectedDay).length === 0 && !HOLIDAYS_2026[selectedDay] ? (
            <div className="text-[13px] text-muted-foreground">Nothing scheduled.</div>
          ) : (
            <NoteList notes={notesOn(notes, selectedDay)} />
          )}
        </div>
      )}

      <div className="text-[13px] uppercase tracking-[0.06em] text-muted-foreground mt-[26px] mb-2.5">
        Company notes this month
      </div>
      <div className="bg-card border border-border rounded-[10px] p-4 shadow-[0_1px_2px_rgba(22,35,59,0.06),0_2px_10px_rgba(22,35,59,0.05)]">
        {notes.length === 0 ? (
          <div className="text-[13.5px] text-muted-foreground text-center py-2">
            No notes from HR this month.
          </div>
        ) : (
          <NoteList notes={notes} />
        )}
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

function NoteList({ notes }: { notes: CalendarNote[] }) {
  return (
    <ul className="space-y-3">
      {notes.map((n) => (
        <li key={n.id} className="flex gap-3">
          <span
            className="mt-1 w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ background: NOTE_STYLE[n.category].fg }}
          />
          <div className="min-w-0">
            <div className="text-[14px] font-semibold leading-snug">{n.title}</div>
            <div className="text-[12px] text-muted-foreground">
              {noteDates(n)} · {CATEGORY_LABEL[n.category]}
            </div>
            {n.note && (
              <div className="text-[13px] mt-1 whitespace-pre-line break-words">{n.note}</div>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
