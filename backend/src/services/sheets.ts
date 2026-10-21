import { config } from "../config";
import { attendanceDto } from "./records";
import { toProfile, UserRow } from "./users";

const timeOf = (iso: string | null | undefined) =>
    iso 
        ? new Intl.DateTimeFormat("en-GB", {
            timeZone: config.timezone,
            hour: "2-digit",
            minute: "2-digit",
            hour12: false, 
        }).format(new Date(iso))
    : "";

export function sendAttendanceToSheet(user: UserRow, row: Record<string, any>): void {
    if (!config.sheetsWebhookUrl) return;
    void (async () => {
        try {
            const profile = await toProfile(user);
            const rec = attendanceDto(row, "admin");
            const res = await fetch(config.sheetsWebhookUrl, {
                method:"POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    secret: config.sheetsSecret,
                    recordId: rec.id,
                    date: rec.date,
                    employeeId: profile.employeeId || "",
                    fullName: profile.fullName,
                    username: profile.username,
                    company: profile.company || "",
                    department: profile.departmentId ? profile.department : "",
                    clockIn: timeOf(rec.clockIn),
                    clockInLocation: rec.location || "",
                    late: rec.late,
                    clockOut: timeOf(rec.clockOut),
                    clockOutLocation: rec.clockOutLocation || "",
                    hours: rec.hours == null ? "" : Math.round(rec.hours * 100) / 100,
                }),
                signal: AbortSignal.timeout(15000),
            });
            if (!res.ok) console.error(`Google Sheet update failed: HTTP ${res.status}`);
        } catch (e) {
            console.error("Google Sheet update failed:", e instanceof Error ? e.message : e);
        }
    })();
}