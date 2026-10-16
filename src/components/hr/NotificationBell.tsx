import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, Trash2, X } from "lucide-react";
import type { ModuleId } from "@/lib/hr-types";
import { useNotifications } from "@/hooks/use-notifications";
import { fmtDate, fmtTime } from "@/lib/hr-store";

interface Props {
  username: string;
  onNavigate?: (mod: ModuleId) => void;
}

const CATEGORY_COLOR: Record<string, string> = {
  leave: "hsl(var(--blue))",
  claim: "hsl(var(--amber))",
  payslip: "hsl(var(--green))",
  evaluation: "hsl(var(--blue-dark))",
  system: "hsl(var(--muted))",
  dopetest: "hsl(var(--red))",
  attendance: "hsl(var(--blue-light))",
};

export function NotificationBell({ username, onNavigate }: Props) {
  const { items, unread, markRead, markAll, remove } =
    useNotifications(username);
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
    if (n.actionModule && onNavigate) onNavigate(n.actionModule);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative w-9 h-9 rounded-lg border border-border bg-card text-foreground flex items-center justify-center hover:bg-[hsl(var(--paper-2))] transition-colors"
        aria-label="Notifications"
      >
        <Bell style={{ width: 18, height: 18 }} />
        {unread > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
            style={{ background: "hsl(var(--amber))" }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-[340px] max-w-[calc(100vw-2rem)] bg-card border border-border rounded-[12px] shadow-[0_8px_30px_rgba(22,35,59,0.18)] overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="font-semibold text-sm">Notifications</div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  onClick={markAll}
                  className="flex items-center gap-1 text-[11px] text-[hsl(var(--blue))] hover:opacity-70 px-1.5 py-1 rounded"
                  title="Mark all as read"
                >
                  <CheckCheck style={{ width: 14, height: 14 }} />
                  Mark all read
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                <X style={{ width: 15, height: 15 }} />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-[360px] overflow-y-auto">
            {items.length === 0 ? (
              <div className="px-4 py-8 text-center text-muted-foreground text-sm">
                No notifications yet.
              </div>
            ) : (
              items.map((n) => (
                <div
                  key={n.id}
                  className={[
                    "flex gap-2.5 px-4 py-3 border-b border-border last:border-b-0 transition-colors hover:bg-[hsl(var(--paper-2))]",
                    !n.isRead ? "bg-[hsl(var(--blue-pale))]/40" : "",
                  ].join(" ")}
                >
                  <div
                    className="w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0"
                    style={{
                      background: n.isRead
                        ? "transparent"
                        : CATEGORY_COLOR[n.category] || "hsl(var(--blue))",
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold text-[13px] truncate">
                        {n.title}
                      </div>
                      <button
                        onClick={() => remove(n.id)}
                        className="text-muted-foreground hover:text-[hsl(var(--red))] flex-shrink-0"
                        title="Delete"
                      >
                        <Trash2 style={{ width: 13, height: 13 }} />
                      </button>
                    </div>
                    <div className="text-[12.5px] text-muted-foreground mt-0.5 whitespace-pre-line leading-relaxed">
                      {n.message}
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <div className="font-mono-hr text-[10.5px] text-muted-foreground">
                        {fmtDate(n.createdAt)} · {fmtTime(n.createdAt)}
                      </div>
                      {n.actionModule && (
                        <button
                          onClick={() => handleAction(n)}
                          className="text-[11px] text-[hsl(var(--blue))] hover:opacity-70 font-medium"
                        >
                          {n.actionLabel || "View"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
