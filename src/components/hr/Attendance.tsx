import { useEffect, useRef, useState } from "react";
import type { UseHrSession } from "@/hooks/use-hr-session";
import { fmtDate, fmtTime, todayISO, workHours } from "@/lib/hr-store";
import { clockIn, clockOut, fetchMyAttendance } from "@/lib/api-attendance";
import { SelfieCapture } from "./SelfieCapture";

interface Props {
  hr: UseHrSession;
}

/* ---------- shared geolocation ----------
   One reliable function used by both Clock In and Clock Out. Returns
   structured coordinates so we never persist the UI string "Location
   unavailable" as a database value. A generous timeout (15s) is used
   because the first geolocation call triggers the browser permission
   prompt — the previous 8s timeout expired while the user was still
   reading that dialog, which is why Clock In saved "Location
   unavailable" while Clock Out (permission already granted) worked. */
interface GeoCoords {
  latitude: number;
  longitude: number;
  accuracy: number;
}
interface GeoResult {
  coords: GeoCoords | null;
  error: string | null;
}

function getCurrentLocation(): Promise<GeoResult> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({
        coords: null,
        error: "Geolocation is not supported by your browser.",
      });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        resolve({
          coords: { latitude, longitude, accuracy },
          error: null,
        });
      },
      (err) => {
        let message = "Unable to retrieve your location. Please try again.";
        switch (err.code) {
          case err.PERMISSION_DENIED:
            message =
              "Location access is required to clock in. Please allow location permission in your browser and try again.";
            break;
          case err.POSITION_UNAVAILABLE:
            message =
              "Your location is currently unavailable. Please try again.";
            break;
          case err.TIMEOUT:
            message =
              "Location request timed out. Please allow location permission and try again.";
            break;
        }
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.warn("[geolocation] error", err.code, err.message);
        }
        resolve({ coords: null, error: message });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

function formatLocation(c: GeoCoords): string {
  return `Lat ${c.latitude.toFixed(5)}, Lng ${c.longitude.toFixed(5)} (±${Math.round(c.accuracy)}m)`;
}

type SelfieMode = "clockIn" | "clockOut";

export function Attendance({ hr }: Props) {
  const session = hr.session!;
  const rec = [...session.attendance.records].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  const today = rec.find((r) => r.date === todayISO());
  const [clock, setClock] = useState("--:--:--");
  const [locating, setLocating] = useState(false);
  const [locError, setLocError] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [selfieMode, setSelfieMode] = useState<SelfieMode>("clockIn");
  const [pendingSelfie, setPendingSelfie] = useState<string | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState("");
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<number | null>(null);

  // Load the latest records from the server (e.g. a clock-in made on
  // another device) whenever the Attendance screen opens.
  const updateAttendance = hr.updateAttendance;
  const refreshFromServer = async () => {
    const records = await fetchMyAttendance();
    updateAttendance({ records });
  };
  useEffect(() => {
    refreshFromServer().catch(() => {
      /* offline: keep what's on screen */
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString("en-GB"));
    tick();
    timerRef.current = window.setInterval(tick, 1000);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, []);

  // Step 1 of clock-in: request location, then open the camera for a selfie.
  const startClockIn = async () => {
    setLocating(true);
    setLocError("");
    const result = await getCurrentLocation();
    setLocating(false);
    if (!result.coords) {
      setLocError(result.error || "Unable to retrieve your location.");
      return;
    }
    // Stash the location; the selfie must be captured before we persist.
    setPendingSelfie(null);
    setSelfieMode("clockIn");
    setCameraOpen(true);
  };

  // Step 1 of clock-out: open the camera directly (location was already
  // recorded at clock-in, but we capture a fresh location + selfie).
  const startClockOut = async () => {
    setLocating(true);
    setLocError("");
    const result = await getCurrentLocation();
    setLocating(false);
    if (!result.coords) {
      setLocError(result.error || "Unable to retrieve your location.");
      return;
    }
    setPendingSelfie(null);
    setSelfieMode("clockOut");
    setCameraOpen(true);
  };

  // After the selfie is captured, complete the attendance write.
  const confirmSelfie = (dataUrl: string) => {
    setSelfiePreview(dataUrl);
    setCameraOpen(false);

    if (selfieMode === "clockIn") {
      // Re-derive location synchronously (it was validated moments ago).
      void finalizeClockIn(dataUrl);
    } else {
      void finalizeClockOut(dataUrl);
    }
  };

  // Send the clock-in/out to the server (location + selfie), then reload.
  const save = async (kind: "in" | "out", selfie: string) => {
    const result = await getCurrentLocation();
    if (!result.coords) {
      setLocError(result.error || "Unable to retrieve your location.");
      return;
    }
    setSaving(true);
    setLocError("");
    try {
      const location = formatLocation(result.coords);
      if (kind === "in") await clockIn(location, selfie);
      else await clockOut(location, selfie);
      await refreshFromServer();
      setSuccessMsg(kind === "in" ? "Clocked in successfully." : "Clocked out successfully.");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (e) {
      setLocError(e instanceof Error ? e.message : "Couldn't save. Please try again.");
      // Already clocked in/out on another device: show the real state.
      refreshFromServer().catch(() => undefined);
    } finally {
      setSaving(false);
      setSelfiePreview(null);
      setPendingSelfie(null);
    }
  };
  const finalizeClockIn = (selfie: string) => save("in", selfie);
  const finalizeClockOut = (selfie: string) => save("out", selfie);

  return (
    <>
      <div className="flex items-start justify-between gap-5 mb-[22px]">
        <div>
          <h1 className="text-2xl">Attendance</h1>
          <div className="text-muted-foreground text-[13.5px] mt-1">
            Clock in / clock out, location & selfie verified for each record.
          </div>
        </div>
      </div>
      <div
        className="bg-card border border-border rounded-[10px] p-[18px]"
        style={{
          boxShadow:
            "0 1px 2px rgba(22,35,59,0.06), 0 2px 10px rgba(22,35,59,0.05)",
        }}
      >
        <div className="flex items-center justify-between gap-5 flex-wrap">
          <div>
            <div className="font-mono-hr text-[34px] font-semibold">
              {clock}
            </div>
            <div className="text-muted-foreground text-[13px] mt-0.5">
              {new Date().toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground mb-2">
              {today
                ? today.clockOut
                  ? "Today's record complete"
                  : `Clocked in at ${fmtTime(today.clockIn)}`
                : "Not clocked in today"}
            </div>
            <div className="flex gap-2 flex-wrap justify-end">
              <button
                onClick={startClockIn}
                disabled={!!today || locating || saving}
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-border bg-transparent text-[hsl(var(--ink))] text-sm font-semibold hover:bg-[hsl(var(--paper-2))] transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
              >
                {locating
                  ? "Getting location..."
                  : saving
                    ? "Saving…"
                    : "Clock In (+selfie & location)"}
              </button>
              <button
                onClick={startClockOut}
                disabled={!today || !!today.clockOut || locating || saving}
                className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-[hsl(var(--ink))] bg-[hsl(var(--ink))] text-white text-sm font-semibold hover:bg-[hsl(var(--blue-dark))] hover:border-[hsl(var(--blue-dark))] transition-colors disabled:opacity-45 disabled:cursor-not-allowed"
              >
                {locating ? "Getting location..." : saving ? "Saving…" : "Clock Out"}
              </button>
            </div>
            {locError && (
              <div className="text-[12px] text-[hsl(var(--red))] mt-2 max-w-[320px]">
                {locError}
              </div>
            )}
            {successMsg && (
              <div className="text-[12px] text-[hsl(var(--green))] mt-2 max-w-[320px]">
                {successMsg}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="text-[13px] uppercase tracking-[0.06em] text-muted-foreground mt-[26px] mb-2.5">
        Recent records
      </div>
      <div className="bg-card border border-border rounded-[10px] overflow-hidden shadow-[0_1px_2px_rgba(22,35,59,0.06),0_2px_10px_rgba(22,35,59,0.05)]">
        <table className="w-full border-collapse text-[13.5px]">
          <thead>
            <tr>
              {[
                "Date",
                "Clock In",
                "Clock In Selfie",
                "Clock Out",
                "Clock Out Selfie",
                "Hours Worked",
              ].map((h) => (
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
            {rec.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="p-6 text-center text-muted-foreground text-[13.5px]"
                >
                  No records yet.
                </td>
              </tr>
            ) : (
              rec.slice(0, 14).map((r, i) => (
                <tr key={i}>
                  <td className="px-4 py-2.5 border-b border-border font-mono-hr last:border-b-0">
                    {fmtDate(r.date)}
                  </td>
                  <td className="px-4 py-2.5 border-b border-border font-mono-hr last:border-b-0">
                    {r.clockIn ? fmtTime(r.clockIn) : "-"}
                  </td>
                  <td className="px-4 py-2.5 border-b border-border last:border-b-0">
                    <SelfieThumb
                      src={
                        r.clockInSelfie ||
                        (r.selfie && !r.selfie.includes("simulated")
                          ? r.selfie
                          : "")
                      }
                    />
                  </td>
                  <td className="px-4 py-2.5 border-b border-border font-mono-hr last:border-b-0">
                    {r.clockOut ? fmtTime(r.clockOut) : "-"}
                  </td>
                  <td className="px-4 py-2.5 border-b border-border last:border-b-0">
                    <SelfieThumb src={r.clockOutSelfie} />
                  </td>
                  <td className="px-4 py-2.5 border-b border-border font-mono-hr last:border-b-0">
                    {r.clockOut ? (
                      `${workHours(r).toFixed(1)} hrs${r.clockOutByAdmin ? " (set by HR)" : ""}`
                    ) : r.date < todayISO() ? (
                      // Forgot to clock out on an earlier day; HR can fill it in.
                      <span className="text-[hsl(var(--red))] text-xs">Missed clock-out</span>
                    ) : (
                      "-"
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <SelfieCapture
        open={cameraOpen}
        title={
          selfieMode === "clockIn" ? "Clock In Selfie" : "Clock Out Selfie"
        }
        confirmLabel={
          selfieMode === "clockIn" ? "Confirm Clock In" : "Confirm Clock Out"
        }
        onConfirm={confirmSelfie}
        onClose={() => setCameraOpen(false)}
      />
    </>
  );
}

/* Small selfie thumbnail that opens a full-size lightbox on click. */
function SelfieThumb({ src }: { src?: string }) {
  const [open, setOpen] = useState(false);
  if (!src) {
    return <span className="text-[12px] text-muted-foreground italic">—</span>;
  }
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="block rounded-[6px] overflow-hidden border border-border hover:opacity-80 transition-opacity"
        title="View selfie"
      >
        <img
          src={src}
          alt="Attendance selfie"
          className="w-[44px] h-[44px] object-cover"
        />
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/70"
          onClick={() => setOpen(false)}
        >
          <img
            src={src}
            alt="Attendance selfie (full size)"
            className="max-w-[90vw] max-h-[85vh] rounded-[10px] shadow-2xl"
          />
        </div>
      )}
    </>
  );
}
