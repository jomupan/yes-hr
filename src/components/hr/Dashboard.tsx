import { useEffect } from "react";
import type { ModuleId } from "@/lib/hr-types";
import { MODULES } from "@/lib/hr-constants";
import type { UseHrSession } from "@/hooks/use-hr-session";
import { fmtTime, todayISO, daysBetween, workHours } from "@/lib/hr-store";
import {
  getNotifications,
  notifyDopeExpiring,
  notifyDopeRequired,
} from "@/lib/notification-store";

interface Props {
  hr: UseHrSession;
  onNavigate: (id: ModuleId) => void;
}

export function Dashboard({ hr, onNavigate }: Props) {
  const session = hr.session!;
  const status = session.status;
  const rec = session.attendance.records;
  const todayRec = rec.find((r) => r.date === todayISO());
  const thisMonth = rec.filter(
    (r) => daysBetween(r.date, todayISO()) < 30 && r.clockOut,
  );
  const totalHrs = thisMonth.reduce((s, r) => s + workHours(r), 0);
  const pendingLeave = session.leave.applications.filter(
    (a) => a.status === "Pending",
  ).length;
  const pendingClaim = session.claim.claims.filter(
    (c) => c.status === "Pending",
  ).length;

  // Generate Dope Personality Test notifications once per relevant state.
  // Guarded by an existing-notification check so we don't spam duplicates.
  useEffect(() => {
    const username = session.username;
    const existing = getNotifications(username);
    const hasDopeNotif = existing.some((n) => n.category === "dopetest");
    if (status.state === "first_time" && !hasDopeNotif) {
      notifyDopeRequired(username);
    } else if (
      status.state === "reminder" &&
      status.daysLeft !== undefined &&
      !hasDopeNotif
    ) {
      notifyDopeExpiring(username, status.daysLeft);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.state, status.daysLeft]);

  let banner: React.ReactNode = null;
  if (status.state === "reminder" && status.daysLeft !== undefined) {
    banner = (
      <div
        className="flex items-start gap-3 p-3.5 rounded-[10px] mb-[22px] border"
        style={{ background: "hsl(var(--amber-pale))", borderColor: "#E7CE9C" }}
      >
        <div className="text-[18px] leading-none">⚠</div>
        <div>
          <div className="font-semibold text-[13.5px] mb-0.5">
            Reminder: Your Dope Personality Test is expiring
          </div>
          <div className="text-[13px] text-muted-foreground leading-relaxed">
            Valid for only {status.daysLeft} more days. Please schedule your
            next Dope Personality Test before the expiry date to avoid access
            restrictions.
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-start justify-between gap-5 mb-[22px]">
        <div>
          <h1 className="text-2xl">
            Welcome back, {session.profile.fullName.split(" ")[0]}
          </h1>
          <div className="text-muted-foreground text-[13.5px] mt-1">
            {new Date().toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
          </div>
        </div>
        <Stamp status={status} />
      </div>
      {banner}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <Metric
          label="Today's status"
          value={
            todayRec
              ? todayRec.clockOut
                ? "Completed"
                : "Working"
              : "Not clocked in"
          }
          valueSize="16px"
          sub={
            todayRec
              ? fmtTime(todayRec.clockIn) +
                (todayRec.clockOut ? " - " + fmtTime(todayRec.clockOut) : "")
              : "Attendance"
          }
        />
        <Metric
          label="Hours worked (30 days)"
          value={`${totalHrs.toFixed(1)}`}
          unit="hrs"
          sub={`${thisMonth.length} days recorded`}
        />
        <Metric
          label="Annual leave balance"
          value={`${session.leave.balance.Annual}`}
          unit="days"
          sub={`${pendingLeave} pending applications`}
        />
        <Metric label="Pending claims" value={`${pendingClaim}`} sub="Claims" />
      </div>

      <div className="text-[13px] uppercase tracking-[0.06em] text-muted-foreground mt-[26px] mb-2.5">
        HR Modules
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
        {MODULES.filter((m) => m.id !== "dashboard").map((m) => (
          <button
            key={m.id}
            onClick={() => onNavigate(m.id)}
            className="text-left bg-card border border-border rounded-[10px] p-[18px] cursor-pointer hover:border-[hsl(var(--blue-light))] transition-colors"
            style={{
              boxShadow:
                "0 1px 2px rgba(22,35,59,0.06), 0 2px 10px rgba(22,35,59,0.05)",
            }}
          >
            <div className="font-mono-hr text-[hsl(var(--blue))] text-xs mb-1.5">
              0{m.num}
            </div>
            <h3 className="text-[15px]">{m.label}</h3>
            <div className="text-[13px] text-muted-foreground mt-1">
              {m.blurb}
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

function Metric({
  label,
  value,
  unit,
  valueSize,
  sub,
}: {
  label: string;
  value: string;
  unit?: string;
  valueSize?: string;
  sub?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-[10px] p-4">
      <div className="text-[11.5px] text-muted-foreground uppercase tracking-[0.05em]">
        {label}
      </div>
      <div
        className="font-mono-hr font-semibold mt-1.5"
        style={{ fontSize: valueSize || "22px" }}
      >
        {value}
        {unit && <span className="text-[13px] ml-1">{unit}</span>}
      </div>
      {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
    </div>
  );
}

function Stamp({ status }: { status: import("@/lib/hr-types").DopeStatus }) {
  let cls = "pass";
  let l2 = "PASSED";
  let l3 = "";
  if (status.state === "first_time") {
    cls = "overdue";
    l2 = "REQUIRED";
    l3 = "complete now";
  } else if (status.state === "valid" && status.daysLeft !== undefined) {
    cls = "pass";
    l3 = `${status.daysLeft} days left`;
  } else if (status.state === "reminder" && status.daysLeft !== undefined) {
    cls = "due";
    l2 = "DUE SOON";
    l3 = `${status.daysLeft} days left`;
  } else {
    cls = "overdue";
    l2 = "OVERDUE";
    l3 = "can be renewed";
  }
  const color =
    cls === "pass"
      ? "hsl(var(--green))"
      : cls === "due"
        ? "hsl(var(--amber))"
        : "hsl(var(--red))";
  return (
    <div
      className="border-[2.5px] rounded-full w-24 h-24 flex-shrink-0 flex items-center justify-center text-center -rotate-[8deg] font-mono-hr p-1.5"
      style={{ borderColor: color, color }}
    >
      <div>
        <div className="text-[9px] tracking-[0.08em] uppercase">
          Dope Personality Test
        </div>
        <div className="text-[13px] font-semibold tracking-[0.03em] my-0.5">
          {l2}
        </div>
        <div className="text-[8.5px]">{l3}</div>
      </div>
    </div>
  );
}
