import { useCallback, useEffect, useState } from "react";
import type { HrNotification } from "@/lib/hr-types";
import { api } from "@/lib/api";

/* How often open screens check the server for new notifications. */
const POLL_MS = 60_000;

/**
 * The logged-in user's notifications, from the server. Every bell and
 * notifications page uses this hook, so a leave approval made by an admin
 * on a laptop reaches the staff member's phone. The server only ever
 * returns the current user's own notifications.
 *
 * `username` is kept as the signature the screens already use; a null
 * username (logged out) means no notifications.
 */
export function useNotifications(username: string | null) {
  const [items, setItems] = useState<HrNotification[]>([]);

  const load = useCallback(async () => {
    if (!username) {
      setItems([]);
      return;
    }
    try {
      const res = await api<{ notifications: HrNotification[] }>("/notifications");
      setItems(res.notifications);
    } catch {
      /* offline or logged out: keep what's on screen */
    }
  }, [username]);

  // Load now, then poll while the page is visible.
  useEffect(() => {
    void load();
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const refresh = useCallback(() => void load(), [load]);

  // Update the screen straight away, then tell the server.
  const markRead = useCallback(
    (id: string) => {
      setItems((list) => list.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
      api(`/notifications/${encodeURIComponent(id)}/read`, { method: "PATCH" }).catch(() => void load());
    },
    [load],
  );

  const markAll = useCallback(() => {
    setItems((list) => list.map((n) => ({ ...n, isRead: true })));
    api("/notifications/read-all", { method: "POST" }).catch(() => void load());
  }, [load]);

  const remove = useCallback(
    (id: string) => {
      setItems((list) => list.filter((n) => n.id !== id));
      api(`/notifications/${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => void load());
    },
    [load],
  );

  const unread = items.filter((n) => !n.isRead).length;

  return { items, unread, refresh, markRead, markAll, remove };
}
