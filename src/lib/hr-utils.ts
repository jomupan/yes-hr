/* Pure date/time/identity helpers used across the HR system. Extracted from
   hr-store.ts so that file stays focused on storage + auth. Re-exported from
   hr-store.ts for backward compatibility with components importing from there. */

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function nowISO(): string {
  return new Date().toISOString();
}

export function fmtDate(iso: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function fmtTime(iso: string): string {
  if (!iso) return "-";
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

export function daysBetween(a: string, b: string): number {
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return Math.floor(ms / 86400000);
}

export function initials(name: string): string {
  return (name || "?")
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

export function workHours(r: {
  clockIn: string;
  clockOut: string | null;
}): number {
  if (!r.clockIn || !r.clockOut) return 0;
  return Math.max(
    0,
    (new Date(r.clockOut).getTime() - new Date(r.clockIn).getTime()) / 3600000,
  );
}
