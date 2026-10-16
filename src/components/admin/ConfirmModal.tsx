import { X } from "lucide-react";

export function ConfirmModal({
  title,
  message,
  confirmLabel,
  danger,
  error,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"
      onClick={onCancel}
    >
      <div
        className="bg-[#111726] border border-white/10 rounded-[14px] w-full max-w-[420px] shadow-2xl"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="p-5">
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-base font-bold text-white">{title}</h3>
            <button
              onClick={onCancel}
              className="text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <p className="text-[13px] text-slate-400 leading-relaxed">
            {message}
          </p>
          {error && (
            <div className="mt-3 text-[12px] text-rose-400 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          <div className="flex gap-2 mt-5 justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2.5 rounded-lg border border-white/15 text-slate-300 hover:bg-white/5 text-sm font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className={[
                "px-4 py-2.5 rounded-lg border text-sm font-semibold transition-colors",
                danger
                  ? "bg-rose-500 text-white border-rose-500 hover:bg-rose-600"
                  : "bg-emerald-500 text-slate-950 border-emerald-500 hover:bg-emerald-400",
              ].join(" ")}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
