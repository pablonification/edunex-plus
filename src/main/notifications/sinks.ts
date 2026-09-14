import type * as EffectModule from "effect" with { "resolution-mode": "import" };
import { effectRuntime } from "../effect/effect-runtime";
import type { InAppNotification, OutboundNotification } from "../../shared/notifications";
import { toInAppNotification } from "../../shared/notifications";
import type { NotificationStore } from "./notification-store";
import { NotificationPersistenceService } from "./persistence";
import { Clock, ElectronPlatform, type ClockService } from "../platform/services";
import { systemClock } from "../platform/node";

/**
 * The notification spine (#23, extended by #24): one sink interface, two
 * implementations. The dispatcher fans an outbound notification out to
 * every sink; a throwing sink must never take the others (or the sync
 * tick) down with it. Task bursts arrive coalesced as single/digest;
 * Presence-open alerts arrive one per window and are never coalesced.
 */
export interface NotificationSink {
  /** The account is optional for compatibility with the original sink seam. */
  show(notification: OutboundNotification, accountId?: string): void;
}

export function createFanoutSink(sinks: NotificationSink[]): NotificationSink {
  return {
    show(notification, accountId) {
      for (const sink of sinks) {
        try {
          sink.show(notification, accountId);
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
  clock?: ClockService;
}

/** Second sink: persists the fallback feed entry and pushes it to the renderer. */
export function createInAppSink(deps: InAppSinkDeps): NotificationSink {
  let counter = 0;
  return {
    show(notification, explicitAccountId) {
      const accountId = explicitAccountId ?? deps.getAccountId();
      if (!accountId) return;
      const clock = deps.now?.() ?? deps.clock?.now() ?? systemClock.now();
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

/** Effect operations for the two notification delivery sinks. */
export type NotificationDeliveryEffect<A> = EffectModule.Effect.Effect<A, never, never>;

/**
 * Delivery is a deep module: callers provide one domain notification and the
 * implementation isolates OS, in-app, and renderer failures independently.
 */
export interface NotificationDeliveryServiceShape {
  readonly deliver: (
    accountId: string,
    notification: OutboundNotification,
  ) => NotificationDeliveryEffect<void>;
  /** Alias matching the original sink vocabulary. */
  readonly show: (
    accountId: string,
    notification: OutboundNotification,
  ) => NotificationDeliveryEffect<void>;
}

/** Explicit Context key for notification delivery. */
export class NotificationDeliveryService extends effectRuntime.Context.Service<
  NotificationDeliveryService,
  NotificationDeliveryServiceShape
>()("EdunexPlus/NotificationDeliveryService") {}

export interface NotificationDeliveryLayerOptions {
  /** Called after the in-app entry has been persisted. */
  readonly broadcast?: (accountId: string, entries: InAppNotification[]) => void;
  /** Called by an OS notification click; main owns focus/navigation. */
  readonly onClicked?: (notification: OutboundNotification) => void;
  /** Stable test/application override for in-app ids. */
  readonly createId?: () => string;
}

/**
 * Builds delivery from test or compatibility sink adapters. The fan-out
 * catches each sink independently and therefore always completes successfully.
 */
export function createNotificationDeliveryService(
  sinks: readonly NotificationSink[],
): NotificationDeliveryServiceShape {
  const fanout = createFanoutSink([...sinks]);
  const deliver = (accountId: string, notification: OutboundNotification) =>
    effectRuntime.Effect.sync(() => {
      try {
        fanout.show(notification, accountId);
      } catch {
        // The fanout already isolates individual sinks; keep the service
        // successful even when a custom dispatcher itself is defective.
      }
    });
  return { deliver, show: deliver };
}

/**
 * Production delivery layer. Electron is accessed only through
 * `ElectronPlatform`; in-app persistence is accessed only through the
 * validated notification persistence service. Tests can use
 * `createNotificationDeliveryLayerFromSinks` and never construct Electron
 * notifications.
 */
export function createNotificationDeliveryLayer(
  options: NotificationDeliveryLayerOptions = {},
): EffectModule.Layer.Layer<
  NotificationDeliveryService,
  never,
  ElectronPlatform | NotificationPersistenceService | Clock
> {
  return effectRuntime.Layer.effect(
    NotificationDeliveryService,
    effectRuntime.Effect.gen(function* () {
      const platform = yield* ElectronPlatform;
      const persistence = yield* NotificationPersistenceService;
      const clock = yield* Clock;
      let counter = 0;
      const createId =
        options.createId ?? (() => `inapp-${clock.now()}-${(counter += 1)}`);
      const osSink = createOsSink({
        show: (notificationOptions, onClick) => {
          const notification = platform.createNotification(notificationOptions);
          notification.on("click", onClick);
          notification.show();
        },
        onClicked: options.onClicked,
      });

      const deliver = (
        accountId: string,
        notification: OutboundNotification,
      ): NotificationDeliveryEffect<void> =>
        effectRuntime.Effect.gen(function* () {
          // Keep the pre-migration order: the OS sink is attempted before the
          // in-app sink, and both are independent failure domains.
          yield* safeVoid(() => osSink.show(notification, accountId));

          const entries = yield* effectRuntime.Effect.sync(() =>
            toInAppNotification(notification, createId()),
          ).pipe(
            effectRuntime.Effect.flatMap((entry) => persistence.append(accountId, entry)),
            effectRuntime.Effect.catchCause(() => effectRuntime.Effect.succeed([])),
          );
          if (entries.length > 0 && options.broadcast) {
            yield* safeVoid(() => options.broadcast?.(accountId, entries));
          }
        });

      return { deliver, show: deliver };
    }),
  ) as EffectModule.Layer.Layer<
    NotificationDeliveryService,
    never,
    ElectronPlatform | NotificationPersistenceService | Clock
  >;
}

/** A no-Electron delivery layer for deterministic event-driven tests. */
export function createNotificationDeliveryLayerFromSinks(
  sinks: readonly NotificationSink[],
): EffectModule.Layer.Layer<NotificationDeliveryService, never, never> {
  return effectRuntime.Layer.succeed(
    NotificationDeliveryService,
    createNotificationDeliveryService(sinks),
  );
}

export const NotificationDeliveryServiceLive = createNotificationDeliveryLayer;
export const NotificationSinkService = NotificationDeliveryService;
export const NotificationSinkServiceLive = createNotificationDeliveryLayer;
export const createNotificationSinkLayer = createNotificationDeliveryLayer;

function safeVoid(operation: () => void): NotificationDeliveryEffect<void> {
  return effectRuntime.Effect.sync(() => {
    try {
      operation();
    } catch {
      // Platform and renderer failures are isolated from the sync event.
    }
  });
}
