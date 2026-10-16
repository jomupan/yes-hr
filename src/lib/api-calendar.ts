/* Company calendar notes: admins add them, every staff member sees them. */

import { useCallback, useEffect, useState } from "react";
import { api } from "./api";

export type CalendarCategory = "event" | "holiday" | "reminder";

export interface CalendarNote {
  id: string;
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD (same as `from` for one day)
  title: string;
  note: string;
  category: CalendarCategory;
  createdBy: string;
}

export interface CalendarNoteInput {
  title: string;
  note: string;
  from: string;
  to: string;
  category: CalendarCategory;
  notifyStaff?: boolean;
}

export const CATEGORY_LABEL: Record<CalendarCategory, string> = {
  event: "Event",
  holiday: "Holiday",
  reminder: "Reminder",
};

/** First and last day (YYYY-MM-DD) of a month (month is 0-based). */
export function monthRange(year: number, month: number): { from: string; to: string } {
  const p = (n: number) => String(n).padStart(2, "0");
  const last = new Date(year, month + 1, 0).getDate();
  return { from: `${year}-${p(month + 1)}-01`, to: `${year}-${p(month + 1)}-${p(last)}` };
}

/** Notes covering a given day. */
export function notesOn(notes: CalendarNote[], iso: string): CalendarNote[] {
  return notes.filter((n) => n.from <= iso && n.to >= iso);
}

/** Notes overlapping the month being viewed; reloads when the month changes. */
export function useCalendarNotes(year: number, month: number) {
  const [notes, setNotes] = useState<CalendarNote[]>([]);
  const [error, setError] = useState(false);
  const { from, to } = monthRange(year, month);

  const reload = useCallback(async () => {
    try {
      const res = await api<{ events: CalendarNote[] }>(`/calendar?from=${from}&to=${to}`);
      setNotes(res.events);
      setError(false);
    } catch {
      setError(true);
    }
  }, [from, to]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { notes, error, reload };
}

/* ---------- admin ---------- */

export function createCalendarNote(input: CalendarNoteInput) {
  return api("/admin/calendar", { body: input });
}

export function updateCalendarNote(id: string, input: CalendarNoteInput) {
  return api(`/admin/calendar/${encodeURIComponent(id)}`, { method: "PUT", body: input });
}

export function deleteCalendarNote(id: string) {
  return api(`/admin/calendar/${encodeURIComponent(id)}`, { method: "DELETE" });
}
