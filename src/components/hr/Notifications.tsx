import { useState } from "react";
import { CheckCheck, Trash2 } from "lucide-react";
import type { ModuleId, NotificationCategory } from "@/lib/hr-types";
import type { UseHrSession } from "@/hooks/use-hr-session";
import { useNotifications } from "@/hooks/use-notifications";
import { fmtDate, fmtTime } from "@/lib/hr-store";
import { PushToggle } from "@/components/PushToggle";

interface Props {
  hr: UseHrSession;
  onNavigate?: (mod: ModuleId) => void;
}

type Filter = "all" | "unread" | NotificationCategory;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "leave", label: "Leave" },
  { id: "claim", label: "Claims" },
  { id: "payslip", label: "Payslip" },
  { id: "evaluation", label: "Evaluation" },
  { id: "system", label: "System" },
];

const CATEGORY_COLOR: Record<string, string> = {
  leave: "hsl(var(--blue))",
  claim: "hsl(var(--amber))",
  payslip: "hsl(var(--green))",
  evaluation: "hsl(var(--blue-dark))",
  system: "hsl(var(--muted))",
  dopetest: "hsl(var(--red))",
  attendance: "hsl(var(--blue-light))",
};

export function Notifications({ hr, onNavigate }: Props) {
  const session = hr.session!;
  const { items, unread, markRead, markAll, remove } = useNotifications(
    session.username,
  );
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = items.filter((n) => {
    if (filter === "all") return true;
    if (filter === "unread") return !n.isRead;
    return n.category === filter;
  });

  const handleAction = (n: (typeof items)[number]) => {
    markRead(n.id);
    if (n.actionModule && onNavigate) onNavigate(n.actionModule);
  };

  return (
    <>
      <div className="flex items-start justify-between gap-5 mb-[22px]">
        <div>
          <h1 className="text-2xl">Notifications</h1>
          <div className="text-muted-foreground text-[13.5px] mt-1">
            Your HR notifications and updates.
          </div>
        </div>
        {unread > 0 && (
          <button
            onClick={markAll}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card text-[13px] text-[hsl(var(--blue))] hover:bg-[hsl(var(--paper-2))] transition-colors"
          >
            <CheckCheck style={{ width: 15, height: 15 }} />
            Mark all as read
          </button>
        )}
      </div>

      <PushToggle />

      <div className="flex gap-2 flex-wrap mb-5">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={[
              "px-3.5 py-2 rounded-full border text-[13px] cursor-pointer transition-colors",
              f.id === filter
                ? "bg-[hsl(var(--ink))] text-white border-[hsl(var(--ink))]"
                : "bg-card text-[hsl(var(--ink))] border-border hover:bg-[hsl(var(--paper-2))]",
            ].join(" ")}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="bg-card border border-border rounded-[10px] overflow-hidden shadow-[0_1px_2px_rgba(22,35,59,0.06),0_2px_10px_rgba(22,35,59,0.05)]">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-muted-foreground text-[13.5px]">
            No notifications.
          </div>
        ) : (
          filtered.map((n) => (
            <div
              key={n.id}
              className={[
                "flex gap-2.5 px-4 py-3.5 border-b border-border last:border-b-0 transition-colors hover:bg-[hsl(var(--paper-2))]",
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
                  <div className="font-semibold text-[13.5px] truncate">
                    {n.title}
                  </div>
                  <button
                    onClick={() => remove(n.id)}
                    className="text-muted-foreground hover:text-[hsl(var(--red))] flex-shrink-0"
                    title="Delete"
                  >
                    <Trash2 style={{ width: 14, height: 14 }} />
                  </button>
                </div>
                <div className="text-[13px] text-muted-foreground mt-0.5 whitespace-pre-line leading-relaxed">
                  {n.message}
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <div className="font-mono-hr text-[11px] text-muted-foreground">
                    {fmtDate(n.createdAt)} · {fmtTime(n.createdAt)}
                  </div>
                  <div className="flex items-center gap-3">
                    {!n.isRead && (
                      <button
                        onClick={() => markRead(n.id)}
                        className="text-[11px] text-muted-foreground hover:text-foreground"
                      >
                        Mark read
                      </button>
                    )}
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
            </div>
          ))
        )}
      </div>
    </>
  );
}
