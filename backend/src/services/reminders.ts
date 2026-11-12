import { config } from "../config";
import { db } from "../db/knex";
import { todayISO } from "../lib/time";
import { sendPush } from "./push";

/* Clock-in / clock-out reminders on staff phones, a few minutes before
   work starts and ends (default 8:25 AM and 5:25 PM, Malaysia time).
   Monday to Friday only, and skipped on days marked "Holiday" in the
   calendar. A staff member is only reminded when it makes sense:
     - clock-in reminder: not on approved leave and not clocked in yet;
     - clock-out reminder: clocked in today and not clocked out yet. */

function nowParts() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: config.timezone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  );
  return { weekday: p.weekday as string, minutes: Number(p.hour) * 60 + Number(p.minute) };
}

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

/** Mark a reminder as sent today; false if it was already sent (e.g. after a restart). */
async function claim(kind: "in" | "out", date: string): Promise<boolean> {
  try {
    await db("settings").insert({ key: `reminder:${kind}:${date}`, value: JSON.stringify(new Date().toISOString()) });
    return true;
  } catch {
    return false;
  }
}

export async function staffToRemind(kind: "in" | "out", date: string): Promise<string[]> {
  const staff: { id: string }[] = await db("users").where({ auth_role: "staff", account_status: "active" }).select("id");
  if (!staff.length) return [];
  const todays = await db("attendance").where({ date }).select("user_id", "clock_out");
  const byUser = new Map(todays.map((r) => [r.user_id, r]));
  if (kind === "out") return staff.filter((s) => byUser.has(s.id) && !byUser.get(s.id)!.clock_out).map((s) => s.id);
  const onLeave = new Set(
    await db("leave_applications")
      .where({ status: "Approved" })
      .andWhere("date_from", "<=", date)
      .andWhere("date_to", ">=", date)
      .pluck("user_id"),
  );
  return staff.filter((s) => !byUser.has(s.id) && !onLeave.has(s.id)).map((s) => s.id);
}

async function isWorkday(date: string, weekday: string): Promise<boolean> {
  if (weekday === "Sat" || weekday === "Sun") return false;
  const holiday = await db("calendar_events")
    .where({ category: "holiday" })
    .andWhere("date_from", "<=", date)
    .andWhere("date_to", ">=", date)
    .first();
  return !holiday;
}

/** Called every 30 seconds; sends each reminder once per day inside its window. */
export async function checkReminders(): Promise<void> {
  const { weekday, minutes } = nowParts();
  const date = todayISO();
  const before = config.reminderMinutesBefore;
  const windows = [
    { kind: "in" as const, at: toMinutes(config.workStart) },
    { kind: "out" as const, at: toMinutes(config.workEnd) },
  ];
  for (const w of windows) {
    // From 5 minutes before until the actual time (so a short delay still sends it).
    if (minutes < w.at - before || minutes >= w.at) continue;
    if (!(await isWorkday(date, weekday))) continue;
    if (!(await claim(w.kind, date))) continue;
    const ids = await staffToRemind(w.kind, date);
    const n = await sendPush(ids, {
      title: w.kind === "in" ? "Time to clock in" : "Time to clock out",
      body:
        w.kind === "in"
          ? `Work starts at ${config.workStart}. Don't forget to clock in.`
          : `Work ends at ${config.workEnd}. Remember to clock out before you leave.`,
      url: "/",
      tag: `reminder-${w.kind}`,
    });
    console.log(`Clock-${w.kind} reminder sent to ${n} phone(s).`);
  }
}

export function startReminders(): void {
  const run = () => checkReminders().catch((e) => console.error("Reminder check failed:", e));
  void run();
  setInterval(run, 30 * 1000).unref();
}
