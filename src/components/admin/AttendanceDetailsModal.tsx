import { useState } from "react";
import { MapPin, Clock, Camera, User, Maximize2 } from "lucide-react";
import { type AdminAttendanceRow } from "@/lib/admin-store";

export function AttendanceDetailsModal({
  row,
  onClose,
  onViewHistory,
}: {
  row: AdminAttendanceRow;
  onClose: () => void;
  onViewHistory: () => void;
}) {
  const rec = row.record;
  const clockInCoords = parseCoords(rec.location);
  const clockOutCoords = parseCoords(rec.clockOutLocation);
  const [lightbox, setLightbox] = useState<string | null>(null);

  // Resolve the clock-in selfie from the new field, falling back to the
  // legacy `selfie` string only if it holds a real data URL (not the old
  // "Selfie captured (simulated)" placeholder text).
  const clockInSelfie =
    rec.clockInSelfie ||
    (rec.selfie && rec.selfie.startsWith("data:") ? rec.selfie : "");
  const clockOutSelfie = rec.clockOutSelfie || "";

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
        onClick={onClose}
      >
        <div
          className="bg-[#111726] border border-white/10 rounded-[14px] w-full max-w-[520px] max-h-[88vh] overflow-hidden flex flex-col shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between p-5 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold text-[14px]">
                {row.fullName
                  .split(/\s+/)
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </div>
              <div>
                <h3 className="text-base font-bold text-white">
                  {row.fullName}
                </h3>
                <div className="text-[12px] text-slate-400">
                  {row.employeeId} · {row.department}
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white text-xl leading-none"
            >
              ×
            </button>
          </div>

          <div className="p-5 overflow-y-auto space-y-5">
            {/* Date + status + hours */}
            <div className="grid grid-cols-3 gap-3">
              <DetailBox
                label="Date"
                value={rec.date ? fmtDateOnly(rec.date) : "-"}
              />
              <DetailBox
                label="Working Hours"
                value={
                  !rec.clockIn
                    ? "-"
                    : row.hours == null
                      ? "In Progress"
                      : `${row.hours.toFixed(1)} hrs`
                }
              />
              <div>
                <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-1">
                  Status
                </div>
                <div className="text-sm font-semibold text-white">
                  {row.status}
                </div>
              </div>
            </div>

            {/* Clock In verification */}
            <VerificationBlock
              title="Clock In Verification"
              time={rec.clockIn ? fmtTime(rec.clockIn) : "-"}
              location={rec.location}
              coords={clockInCoords}
              selfie={clockInSelfie}
              onZoom={setLightbox}
            />

            {/* Clock Out verification */}
            <VerificationBlock
              title="Clock Out Verification"
              time={rec.clockOut ? fmtTime(rec.clockOut) : "-"}
              location={rec.clockOutLocation}
              coords={clockOutCoords}
              selfie={clockOutSelfie}
              emptyLabel={rec.clockOut ? undefined : "Not clocked out yet"}
              onZoom={setLightbox}
            />
          </div>

          <div className="p-4 border-t border-white/10 flex gap-2">
            <button
              onClick={onViewHistory}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 text-sm font-semibold transition-colors"
            >
              <Clock className="w-4 h-4" /> View Full History
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 text-sm font-semibold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Full-size selfie lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80"
          onClick={() => setLightbox(null)}
        >
          <img
            src={lightbox}
            alt="Attendance selfie (full size)"
            className="max-w-[92vw] max-h-[88vh] rounded-[10px] shadow-2xl"
          />
        </div>
      )}
    </>
  );
}

function VerificationBlock({
  title,
  time,
  location,
  coords,
  selfie,
  emptyLabel,
  onZoom,
}: {
  title: string;
  time: string;
  location: string;
  coords: { lat: number; lng: number; acc: number } | null;
  selfie?: string;
  emptyLabel?: string;
  onZoom: (src: string) => void;
}) {
  const hasData = !!time || time !== "-";
  return (
    <div className="bg-[#0e1320] border border-white/10 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-[13px] font-semibold text-white">{title}</h4>
        <div className="flex items-center gap-1.5 text-slate-300 text-sm">
          <Clock className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-mono-hr">{time}</span>
        </div>
      </div>
      {hasData || location ? (
        <div className="space-y-2.5">
          <div className="flex items-start gap-2.5">
            <MapPin className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-[13px] text-slate-300 leading-relaxed">
              {location ? (
                location
              ) : (
                <span className="text-slate-500">Location unavailable</span>
              )}
            </div>
          </div>
          {coords && (
            <div className="grid grid-cols-3 gap-2 text-[11px] text-slate-400 pl-6">
              <Coord label="Latitude" value={coords.lat.toFixed(5)} />
              <Coord label="Longitude" value={coords.lng.toFixed(5)} />
              <Coord label="Accuracy" value={`±${Math.round(coords.acc)}m`} />
            </div>
          )}
          {selfie ? (
            <div className="pl-6 mt-2">
              <button
                onClick={() => onZoom(selfie)}
                className="group relative block rounded-[8px] overflow-hidden border border-white/10 hover:border-amber-400/40 transition-colors"
                title="View full size"
              >
                <img
                  src={selfie}
                  alt={`${title} selfie`}
                  className="w-[120px] h-[90px] object-cover"
                />
                <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-colors">
                  <Maximize2 className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-[12px] text-slate-500 pl-6 mt-2">
              <Camera className="w-3.5 h-3.5" />
              <span>No selfie captured</span>
            </div>
          )}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-[13px] text-slate-500">
          <User className="w-4 h-4" />
          <span>{emptyLabel || "No record"}</span>
        </div>
      )}
    </div>
  );
}

function DetailBox({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-slate-500 mb-0.5">
        {label}
      </div>
      <div className="text-sm text-slate-200">{value}</div>
    </div>
  );
}

function Coord({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white/[0.03] rounded px-2 py-1 text-center">
      <div className="text-slate-500 mb-0.5">{label}</div>
      <div className="font-mono-hr text-slate-300">{value}</div>
    </div>
  );
}

function fmtTime(iso: string): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDateOnly(iso: string): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/* Parse the location string the Staff Attendance module writes, e.g.
   "Lat 3.12666, Lng 101.64335 (±87m)" into structured coordinates. */
function parseCoords(
  location: string,
): { lat: number; lng: number; acc: number } | null {
  if (!location) return null;
  const latMatch = location.match(/Lat\s*(-?\d+\.?\d*)/i);
  const lngMatch = location.match(/Lng\s*(-?\d+\.?\d*)/i);
  const accMatch = location.match(/±\s*(\d+)\s*m/i);
  if (!latMatch || !lngMatch) return null;
  return {
    lat: parseFloat(latMatch[1]),
    lng: parseFloat(lngMatch[1]),
    acc: accMatch ? parseInt(accMatch[1], 10) : 0,
  };
}
