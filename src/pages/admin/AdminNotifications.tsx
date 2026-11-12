import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card } from "@/components/admin/ui";
import { useAdminSession } from "@/hooks/use-admin-session";
import { useNotifications } from "@/hooks/use-notifications";
import { timeAgo } from "@/components/admin/AdminNotificationBell";
import type { NotificationCategory } from "@/lib/hr-types";
import { PushToggle } from "@/components/PushToggle";

type Filter = "all" | "unread" | NotificationCategory;

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "leave", label: "Leave" },
  { id: "claim", label: "Claim" },
  { id: "employee", label: "Employee" },
  { id: "dopetest", label: "Personality" },
  { id: "system", label: "System" },
];

const CATEGORY_ICON: Record<string, string> = {
  leave: "📅",
  claim: "🧾",
  employee: "👤",
  dopetest: "🧠",
  system: "⚙️",
  payslip: "💵",
  evaluation: "📊",
  attendance: "⏰",
};

export function AdminNotifications() {
  const session = useAdminSession();
  const navigate = useNavigate();
  const username = session.username;
  const { items, unread, markRead, markAll } = useNotifications(username);
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = items.filter((n) => {
    if (filter === "all") return true;
    if (filter === "unread") return !n.isRead;
    return n.category === filter;
  });

  const open = (id: string, path?: string) => {
    markRead(id);
    if (path) navigate(path);
  };

  return (
    <AdminLayout>
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            Notifications
          </h2>
          <p className="text-slate-400 text-sm mt-1">
            Staff activity that needs your attention.
          </p>
        </div>
        {unread > 0 && (
          <button
            onClick={markAll}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/15 text-slate-200 hover:bg-white/5 text-[13px] font-semibold transition-colors"
          >
            <CheckCheck className="w-4 h-4" />
            Mark all as read
          </button>
        )}
      </div>

      <PushToggle dark />

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        {FILTERS.map((f) => {
          const count =
            f.id === "all"
              ? items.length
              : f.id === "unread"
                ? unread
                : items.filter((n) => n.category === f.id).length;
          const active = filter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={[
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[12.5px] font-medium transition-colors",
                active
                  ? "bg-amber-500 text-slate-950 border-amber-500"
                  : "bg-transparent text-slate-300 border-white/15 hover:bg-white/5",
              ].join(" ")}
            >
              {f.label}
              {count > 0 && (
                <span
                  className={[
                    "min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center",
                    active
                      ? "bg-slate-950/20 text-slate-950"
                      : "bg-white/10 text-slate-300",
                  ].join(" ")}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* List */}
      <Card className="overflow-hidden">
        {filtered.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <div className="text-3xl mb-3">🔔</div>
            <div className="text-sm text-slate-300 font-medium">
              No notifications
            </div>
            <div className="text-xs text-slate-500 mt-1">
              You're all caught up.
            </div>
          </div>
        ) : (
          filtered.map((n) => (
            <button
              key={n.id}
              onClick={() => open(n.id, n.adminPath)}
              className={[
                "w-full text-left flex gap-3 px-4 sm:px-5 py-4 border-b border-white/5 last:border-b-0 transition-colors hover:bg-white/5",
                !n.isRead ? "bg-amber-500/[0.06]" : "",
              ].join(" ")}
            >
              <div className="text-lg flex-shrink-0 mt-0.5">
                {CATEGORY_ICON[n.category] || "🔔"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {!n.isRead && (
                    <span className="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0" />
                  )}
                  <div
                    className={[
                      "text-[14px] text-white truncate",
                      !n.isRead ? "font-semibold" : "font-medium",
                    ].join(" ")}
                  >
                    {n.title}
                  </div>
                  {n.priority === "high" && (
                    <span className="ml-auto flex-shrink-0 text-[10px] font-bold uppercase tracking-wide text-amber-300 bg-amber-500/15 px-1.5 py-0.5 rounded">
                      Action
                    </span>
                  )}
                </div>
                <div className="text-[13px] text-slate-400 mt-1 whitespace-pre-line leading-relaxed">
                  {n.message}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="font-mono-hr text-[11px] text-slate-500">
                    {timeAgo(n.createdAt)}
                  </div>
                  {n.adminPath && (
                    <span className="text-[12px] text-amber-300 font-medium">
                      {n.actionLabel || "View"} →
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))
        )}
      </Card>

      {items.length === 0 && (
        <div className="flex items-center justify-center gap-2 mt-6 text-slate-500 text-xs">
          <Bell className="w-3.5 h-3.5" />
          Admin notifications appear here when staff submit leave, claims, or
          register.
        </div>
      )}
    </AdminLayout>
  );
}
