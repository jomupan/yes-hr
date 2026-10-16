import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck, X } from "lucide-react";
import type { NotificationCategory } from "@/lib/hr-types";
import { useNotifications } from "@/hooks/use-notifications";

/** Human-friendly relative/absolute time for notifications. */
export function timeAgo(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min} minute${min === 1 ? "" : "s"} ago`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24 && isToday(d)) {
    return `Today, ${d.toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function isToday(d: Date): boolean {
  const now = new Date();
  return (
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear()
  );
}

const CATEGORY_ICON: Record<string, string> = {
  leave: "🌴",
  claim: "🧾",
  employee: "👤",
  dopetest: "🧠",
  attendance: "⏰",
  payslip: "💰",
  evaluation: "📊",
  system: "⚙️",
};

interface Props {
  username: string;
}

export function AdminNotificationBell({ username }: Props) {
  const navigate = useNavigate();
  const { items, unread, markRead, markAll } = useNotifications(username);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleAction = (n: (typeof items)[number]) => {
    markRead(n.id);
    setOpen(false);
    if (n.adminPath) navigate(n.adminPath);
  };

  const recent = items.slice(0, 8);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative w-9 h-9 rounded-lg border border-white/10 bg-white/5 text-slate-300 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
        aria-label="Notifications"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-slate-950 text-[9px] font-bold flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-[360px] max-w-[calc(100vw-2rem)] bg-[#111726] border border-white/10 rounded-[12px] shadow-[0_8px_30px_rgba(0,0,0,0.4)] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <div className="font-semibold text-sm text-white">
              Notifications
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  onClick={markAll}
                  className="flex items-center gap-1 text-[11px] text-amber-300 hover:text-amber-200 px-1.5 py-1 rounded"
                  title="Mark all as read"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[380px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center">
                <div className="text-2xl mb-2">🔔</div>
                <div className="text-sm text-slate-300 font-medium">
                  No new notifications
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  You're all caught up.
                </div>
              </div>
            ) : (
              recent.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleAction(n)}
                  className={[
                    "w-full text-left flex gap-2.5 px-4 py-3 border-b border-white/5 last:border-b-0 transition-colors hover:bg-white/5",
                    !n.isRead ? "bg-amber-500/[0.06]" : "",
                  ].join(" ")}
                >
                  <div className="text-base flex-shrink-0 mt-0.5">
                    {CATEGORY_ICON[n.category] || "🔔"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {!n.isRead && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" />
                      )}
                      <div
                        className={[
                          "text-[13px] truncate text-white",
                          !n.isRead ? "font-semibold" : "font-medium",
                        ].join(" ")}
                      >
                        {n.title}
                      </div>
                    </div>
                    <div className="text-[12px] text-slate-400 mt-0.5 whitespace-pre-line leading-relaxed line-clamp-2">
                      {n.message}
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="font-mono-hr text-[10.5px] text-slate-500">
                        {timeAgo(n.createdAt)}
                      </div>
                      {n.adminPath && (
                        <span className="text-[11px] text-amber-300 font-medium">
                          {n.actionLabel || "View"}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          {/* Footer */}
          {items.length > 0 && (
            <button
              onClick={() => {
                setOpen(false);
                navigate("/admin/notifications");
              }}
              className="w-full text-center py-2.5 text-[12px] text-amber-300 hover:text-amber-200 hover:bg-white/5 border-t border-white/10 font-medium transition-colors"
            >
              View all notifications
            </button>
          )}
        </div>
      )}
    </div>
  );
}
