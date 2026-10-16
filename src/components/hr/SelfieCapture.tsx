import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, Check, AlertTriangle, X } from "lucide-react";

/**
 * Reusable camera dialog for capturing a clock-in / clock-out selfie.
 *
 * Requests `getUserMedia` (video only), shows a live preview, captures a
 * frame to a compressed JPEG data URL, and lets the user retake before
 * confirming. The stream is always stopped when the dialog closes or the
 * component unmounts — no stream is kept alive outside this modal.
 *
 * Captured images are returned as base64 data URLs so they can be persisted
 * with the existing localStorage attendance store (same convention used for
 * leave attachments).
 */
export function SelfieCapture({
  open,
  title,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  confirmLabel: string;
  onConfirm: (dataUrl: string) => void;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [captured, setCaptured] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "starting" | "ready" | "error">(
    "idle",
  );
  const [error, setError] = useState("");

  // Stop the camera stream + release the hardware.
  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  // Start the camera whenever the dialog opens.
  const startCamera = useCallback(async () => {
    setStatus("starting");
    setError("");
    setCaptured(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("error");
      setError("Camera is not supported by this browser.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 1280 },
          height: { ideal: 960 },
        },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }
      setStatus("ready");
    } catch (err: unknown) {
      setStatus("error");
      const e = err as DOMException;
      if (e?.name === "NotAllowedError" || e?.name === "SecurityError") {
        setError(
          "Camera access is required to verify your attendance. Please allow camera permission in your browser and try again.",
        );
      } else if (
        e?.name === "NotFoundError" ||
        e?.name === "DevicesNotFoundError"
      ) {
        setError("No camera was found on this device.");
      } else if (e?.name === "NotReadableError") {
        setError("Your camera is already in use by another application.");
      } else {
        setError("Unable to access the camera. Please try again.");
      }
    }
  }, []);

  useEffect(() => {
    if (open) startCamera();
    return () => {
      stopStream();
    };
  }, [open, startCamera, stopStream]);

  // Capture a frame from the live <video> to a compressed JPEG data URL.
  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    const maxW = 640;
    const scale = Math.min(1, maxW / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    // Mirror to match the on-screen preview.
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setCaptured(canvas.toDataURL("image/jpeg", 0.8));
    stopStream();
  };

  const retake = () => {
    setCaptured(null);
    startCamera();
  };

  const confirm = () => {
    if (!captured) return;
    onConfirm(captured);
  };

  const close = () => {
    stopStream();
    setCaptured(null);
    setStatus("idle");
    setError("");
    onClose();
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60"
      onClick={close}
    >
      <div
        className="bg-card border border-border rounded-[14px] w-full max-w-[420px] shadow-2xl overflow-hidden"
        style={{
          boxShadow:
            "0 10px 40px -10px rgba(0,0,0,0.5), 0 2px 10px rgba(0,0,0,0.3)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-[15px] font-bold text-[hsl(var(--ink))] flex items-center gap-2">
            <Camera className="w-4 h-4 text-[hsl(var(--blue))]" /> {title}
          </h3>
          <button
            onClick={close}
            className="text-muted-foreground hover:text-[hsl(var(--ink))]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          {/* Live camera / captured preview */}
          <div className="relative bg-[hsl(var(--paper-2))] rounded-[10px] overflow-hidden aspect-[4/3] mb-3 flex items-center justify-center">
            {captured ? (
              <img
                src={captured}
                alt="Captured selfie"
                className="w-full h-full object-cover"
              />
            ) : status === "error" ? (
              <div className="text-center p-4">
                <AlertTriangle className="w-8 h-8 text-[hsl(var(--amber))] mx-auto mb-2" />
                <p className="text-[13px] text-[hsl(var(--ink))]">{error}</p>
              </div>
            ) : (
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ transform: "scaleX(-1)" }}
              />
            )}
            {status === "starting" && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                <span className="text-[13px] text-[hsl(var(--ink))]">
                  Starting camera...
                </span>
              </div>
            )}
          </div>

          {!captured && status === "ready" && (
            <p className="text-[12px] text-muted-foreground text-center mb-3">
              Position your face in the frame, then capture.
            </p>
          )}

          {/* Action buttons */}
          <div className="flex gap-2">
            {captured ? (
              <>
                <button
                  onClick={retake}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-border bg-transparent text-[hsl(var(--ink))] text-sm font-semibold hover:bg-[hsl(var(--paper-2))] transition-colors"
                >
                  <RefreshCw className="w-4 h-4" /> Retake
                </button>
                <button
                  onClick={confirm}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-[hsl(var(--green))] bg-[hsl(var(--green))] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  <Check className="w-4 h-4" /> {confirmLabel}
                </button>
              </>
            ) : status === "ready" ? (
              <button
                onClick={capture}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-[hsl(var(--ink))] bg-[hsl(var(--ink))] text-white text-sm font-semibold hover:bg-[hsl(var(--blue-dark))] transition-colors"
              >
                <Camera className="w-4 h-4" /> Capture Selfie
              </button>
            ) : status === "error" ? (
              <button
                onClick={startCamera}
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-border bg-transparent text-[hsl(var(--ink))] text-sm font-semibold hover:bg-[hsl(var(--paper-2))] transition-colors"
              >
                <RefreshCw className="w-4 h-4" /> Try Again
              </button>
            ) : (
              <button
                disabled
                className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg border border-border bg-transparent text-muted-foreground text-sm font-semibold opacity-60 cursor-not-allowed"
              >
                {status === "starting" ? "Starting..." : "Loading camera..."}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
