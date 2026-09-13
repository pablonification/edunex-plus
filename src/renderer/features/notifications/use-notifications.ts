import { useCallback, useEffect, useState } from "react";
import type { InAppNotification } from "@shared/notifications";

export interface NotificationsState {
  entries: InAppNotification[];
  unreadCount: number;
  loading: boolean;
}

export type NotificationsReader = Pick<
  Window["edunex"],
  "getNotifications" | "markNotificationsRead" | "markAllNotificationsRead"
>;

/** Reads the persisted in-app fallback feed through the preload seam. */
export function readNotifications(
  reader: NotificationsReader = window.edunex,
): Promise<InAppNotification[]> {
  return reader.getNotifications();
}

/** Subscribes to the fallback feed and exposes mark-read actions. */
export function useNotifications() {
  const [state, setState] = useState<NotificationsState>({
    entries: [],
    unreadCount: 0,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    let updateReceived = false;

    const unsubscribe = window.edunex.onNotificationsUpdated((entries) => {
      if (cancelled) return;
      updateReceived = true;
      setState({
        entries,
        unreadCount: entries.filter((entry) => !entry.read).length,
        loading: false,
      });
    });

    void readNotifications().then(
      (entries) => {
        if (cancelled || updateReceived) return;
        setState({
          entries,
          unreadCount: entries.filter((entry) => !entry.read).length,
          loading: false,
        });
      },
      () => {
        if (cancelled || updateReceived) return;
        setState({ entries: [], unreadCount: 0, loading: false });
      },
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const markRead = useCallback(async (ids: string[]) => {
    try {
      const entries = await window.edunex.markNotificationsRead(ids);
      setState({
        entries,
        unreadCount: entries.filter((entry) => !entry.read).length,
        loading: false,
      });
    } catch {
      // Mark-read is best-effort; the feed stays as-is on failure.
    }
  }, []);

  const markAllRead = useCallback(async () => {
    try {
      const entries = await window.edunex.markAllNotificationsRead();
      setState({
        entries,
        unreadCount: entries.filter((entry) => !entry.read).length,
        loading: false,
      });
    } catch {
      // Best-effort, same as above.
    }
  }, []);

  return { ...state, markRead, markAllRead };
}
