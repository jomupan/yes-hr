import { useCallback, useEffect, useState } from "react";
import type { HrNotification } from "@/lib/hr-types";
import {
  deleteNotification as delNotif,
  getNotifications,
  markAllRead,
  markNotificationRead,
} from "@/lib/notification-store";

/**
 * Per-user notification state. A user can only ever read their own
 * notifications (keyed by username in the store), so this hook always
 * scopes to the current session username.
 */
export function useNotifications(username: string | null) {
  const [items, setItems] = useState<HrNotification[]>([]);
  const [tick, setTick] = useState(0);

  // Re-read from the store whenever the user or tick changes.
  useEffect(() => {
    if (!username) {
      setItems([]);
      return;
    }
    setItems(getNotifications(username));
  }, [username, tick]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const markRead = useCallback(
    (id: string) => {
      if (!username) return;
      markNotificationRead(username, id);
      setItems(getNotifications(username));
    },
    [username],
  );

  const markAll = useCallback(() => {
    if (!username) return;
    markAllRead(username);
    setItems(getNotifications(username));
  }, [username]);

  const remove = useCallback(
    (id: string) => {
      if (!username) return;
      delNotif(username, id);
      setItems(getNotifications(username));
    },
    [username],
  );

  const unread = items.filter((n) => !n.isRead).length;

  return { items, unread, refresh, markRead, markAll, remove };
}
