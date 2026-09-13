import type { InAppNotification, OutboundNotification } from "../../shared/notifications";
import { toInAppNotification } from "../../shared/notifications";
import type { NotificationStore } from "./notification-store";

/**
 * The notification spine (#23, extended by #24): one sink interface, two
 * implementations. The dispatcher fans an outbound notification out to
 * every sink; a throwing sink must never take the others (or the sync
 * tick) down with it. Task bursts arrive coalesced as single/digest;
 * Presence-open alerts arrive one per window and are never coalesced.
 */
export interface NotificationSink {
  show(notification: OutboundNotification): void;
}

export function createFanoutSink(sinks: NotificationSink[]): NotificationSink {
  return {
    show(notification) {
      for (const sink of sinks) {
        try {
          sink.show(notification);
        } catch (error) {
          console.error("[notifications] sink failed:", error);
        }
      }
    },
  };
}

export interface OsSinkDeps {
  /** Shows one OS notification; the click handler focuses + navigates. */
  show: (options: { title: string; body: string }, onClick: () => void) => void;
  /** Fired when the OS notification is clicked (main focuses + navigates). */
  onClicked?: (notification: OutboundNotification) => void;
}

/** First sink: one OS notification per emission (single, digest, or presence). */
export function createOsSink(deps: OsSinkDeps): NotificationSink {
  return {
    show(notification) {
      try {
        deps.show({ title: notification.title, body: notification.body }, () => {
          try {
            deps.onClicked?.(notification);
          } catch (error) {
            console.error("[notifications] click handler failed:", error);
          }
        });
      } catch (error) {
        console.error("[notifications] OS sink failed:", error);
      }
    },
  };
}

/**
 * Test seam for the OS sink: production passes Electron's Notification,
 * tests pass a fake show and assert on the emitted payloads.
 */
export function createRecordingSink(): NotificationSink & { shown: OutboundNotification[] } {
  const shown: OutboundNotification[] = [];
  return {
    shown,
    show: (notification) => {
      shown.push(notification);
    },
  };
}

export interface InAppSinkDeps {
  storeFor: (accountId: string) => NotificationStore;
  getAccountId: () => string | null;
  broadcast: (accountId: string, entries: InAppNotification[]) => void;
  createId?: () => string;
  now?: () => number;
}

/** Second sink: persists the fallback feed entry and pushes it to the renderer. */
export function createInAppSink(deps: InAppSinkDeps): NotificationSink {
  let counter = 0;
  return {
    show(notification) {
      const accountId = deps.getAccountId();
      if (!accountId) return;
      const clock = deps.now?.() ?? Date.now();
      const createdId = deps.createId?.() ?? `inapp-${clock}-${(counter += 1)}`;
      const entry = toInAppNotification(notification, createdId);
      try {
        const entries = deps.storeFor(accountId).append(entry);
        deps.broadcast(accountId, entries);
      } catch (error) {
        console.error("[notifications] in-app sink failed:", error);
      }
    },
  };
}
