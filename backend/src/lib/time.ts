import { config } from "../config";

/* All "business day" logic runs in APP_TIMEZONE (default Asia/Kuala_Lumpur)
   so "today" and the 08:15 late cut-off are correct regardless of where the
   server is hosted. Timestamps are always stored as UTC ISO strings. */

function parts(d: Date, tz = config.timezone): Record<string, string> {
  const out: Record<string, string> = {};
  new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(d)
    .forEach((p) => (out[p.type] = p.value));
  return out;
}

/** YYYY-MM-DD for the given instant in the business timezone. */
export function localDate(d: Date = new Date()): string {
  const p = parts(d);
  return `${p.year}-${p.month}-${p.day}`;
}

export function todayISO(): string {
  return localDate(new Date());
}

export function nowISO(): string {
  return new Date().toISOString();
}

/** Minutes after local midnight for the given instant. */
export function localMinutes(d: Date): number {
  const p = parts(d);
  return Number(p.hour) * 60 + Number(p.minute);
}

/** Whole days from date a to date b (YYYY-MM-DD), matching the frontend. */
export function daysBetween(a: string, b: string): number {
  const ms = Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`);
  return Math.floor(ms / 86400000);
}

export function isValidDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}

/** e.g. "05 Mar 2026" — used in notification copy, same as the frontend. */
export function fmtDate(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

/** Clock-in after 08:15 local time counts as Late. */
export function isLateClockIn(clockInISO: string): boolean {
  const { hour, minute } = config.rules.lateAfter;
  return localMinutes(new Date(clockInISO)) > hour * 60 + minute;
}

export function hoursBetween(a: string, b: string | null): number | null {
  if (!a || !b) return null;
  return Math.max(0, (Date.parse(b) - Date.parse(a)) / 3600000);
}
