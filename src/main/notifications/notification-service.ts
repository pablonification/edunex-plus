import type * as EffectModule from "effect" with { "resolution-mode": "import" };
import { effectRuntime } from "../effect/effect-runtime";
import {
  buildPresenceNotification,
  buildTaskNotification,
  type InAppNotification,
  type PresenceNotification,
  type TaskNotification,
} from "../../shared/notifications";
import { diffNewTasks, extractTodoTasks } from "./task-detector";
import { extractPresenceWindows, openWindows } from "./presence-detector";
import {
  NotificationPersistenceService,
  type NotificationPersistenceLayerOptions,
  type NotificationPersistenceServiceShape,
  createNotificationPersistenceLayer,
} from "./persistence";
import {
  NotificationDeliveryService,
  type NotificationDeliveryLayerOptions,
  type NotificationDeliveryServiceShape,
  type NotificationSink,
  createNotificationDeliveryLayer,
  createNotificationDeliveryLayerFromSinks,
} from "./sinks";
import { Clock, type ClockService } from "../platform/services";
import type { TaskNotifier } from "./task-notifier";
import type { PresenceNotifier } from "./presence-notifier";

/** Effect operations exposed by the notification domain service. */
export type NotificationEffect<A> = EffectModule.Effect.Effect<A, never, never>;

export type NotificationEvent =
  | {
      readonly kind: "task-sync";
      readonly accountId: string | null;
      readonly previous: unknown;
      readonly current: unknown;
    }
  | {
      readonly kind: "presence-sync";
      readonly accountId: string | null;
      readonly current: unknown;
    };

export type NotificationEventResult = TaskNotification | PresenceNotification[] | null;

/**
 * The small external seam for notification behavior. A caller supplies a
 * domain event or asks for history; persistence, duplicate suppression,
 * delivery ordering, and failure isolation stay behind this interface.
 */
export interface NotificationServiceShape {
  readonly handleTaskSync: (
    accountId: string | null,
    previous: unknown,
    current: unknown,
  ) => NotificationEffect<TaskNotification | null>;
  readonly handlePresenceSync: (
    accountId: string | null,
    current: unknown,
  ) => NotificationEffect<PresenceNotification[]>;
  readonly handle: (event: NotificationEvent) => NotificationEffect<NotificationEventResult>;
  readonly list: (accountId: string | null) => NotificationEffect<InAppNotification[]>;
  readonly get: (accountId: string | null) => NotificationEffect<InAppNotification[]>;
  readonly markRead: (
    accountId: string | null,
    ids: Iterable<string>,
  ) => NotificationEffect<InAppNotification[]>;
  readonly markAllRead: (
    accountId: string | null,
  ) => NotificationEffect<InAppNotification[]>;
}

/** Explicit Context key for task/Presence notification behavior. */
export class NotificationService extends effectRuntime.Context.Service<
  NotificationService,
  NotificationServiceShape
>()("EdunexPlus/NotificationService") {}

export interface NotificationServiceDependencies {
  readonly persistence: NotificationPersistenceServiceShape;
  readonly delivery: NotificationDeliveryServiceShape;
  readonly clock: ClockService;
}

/**
 * Constructs the domain implementation from its two replaceable adapters.
 * Every public operation recovers at the notification seam, so a malformed
 * feed, failed sink, or persistence defect cannot stop synchronization.
 */
export function createNotificationService(
  dependencies: NotificationServiceDependencies,
): NotificationServiceShape {
  const { persistence, delivery, clock } = dependencies;

  const handleTaskSync = (
    accountId: string | null,
    previous: unknown,
    current: unknown,
  ): NotificationEffect<TaskNotification | null> =>
    effectRuntime.Effect.gen(function* () {
      if (!accountId) return null;

      const ledger = yield* persistence.readTaskLedger(accountId);
      const tasks = extractTodoTasks(current);
      if (!ledger.initialized) {
        // First sync is a silent baseline: the existing backlog is history,
        // not a new notification.
        yield* isolate(persistence.saveTaskLedger(accountId, tasks.map((task) => task.id)));
        return null;
      }

      const seenIds = new Set(ledger.seenIds);
      for (const task of extractTodoTasks(previous)) seenIds.add(task.id);
      const fresh = diffNewTasks(previous, current, seenIds);
      const notification = buildTaskNotification(
        fresh,
        new Date(clock.now()).toISOString(),
      );
      if (!notification) return null;

      // Deliberately retain the existing crash window: delivery happens before
      // the ledger write, so a stop between these effects may replay once on
      // the next process. The in-app history still records the delivery.
      yield* isolate(delivery.deliver(accountId, notification));
      yield* isolate(
        persistence.saveTaskLedger(accountId, tasks.map((task) => task.id)),
      );
      return notification;
    }).pipe(recover(null));

  const handlePresenceSync = (
    accountId: string | null,
    current: unknown,
  ): NotificationEffect<PresenceNotification[]> =>
    effectRuntime.Effect.gen(function* () {
      if (!accountId) return [];

      const ledger = yield* persistence.readPresenceLedger(accountId);
      const open = openWindows(extractPresenceWindows(current), clock.now());
      const fresh = open.filter((window) => !ledger.seenIds.includes(window.id));
      if (fresh.length === 0) return [];

      const createdAt = new Date(clock.now()).toISOString();
      const emitted: PresenceNotification[] = [];
      for (const window of fresh) {
        const notification = buildPresenceNotification(window, createdAt);
        yield* isolate(delivery.deliver(accountId, notification));
        emitted.push(notification);
      }
      yield* isolate(
        persistence.savePresenceLedger(accountId, fresh.map((window) => window.id)),
      );
      return emitted;
    }).pipe(recover([]));

  const list = (accountId: string | null): NotificationEffect<InAppNotification[]> =>
    accountId ? persistence.list(accountId).pipe(recover([])) : effectRuntime.Effect.succeed([]);
  const markRead = (
    accountId: string | null,
    ids: Iterable<string>,
  ): NotificationEffect<InAppNotification[]> =>
    accountId
      ? persistence.markRead(accountId, ids).pipe(recover([]))
      : effectRuntime.Effect.succeed([]);
  const markAllRead = (
    accountId: string | null,
  ): NotificationEffect<InAppNotification[]> =>
    accountId
      ? persistence.markAllRead(accountId).pipe(recover([]))
      : effectRuntime.Effect.succeed([]);
  const handle = (event: NotificationEvent): NotificationEffect<NotificationEventResult> =>
    event.kind === "task-sync"
      ? handleTaskSync(event.accountId, event.previous, event.current)
      : handlePresenceSync(event.accountId, event.current);

  return {
    handleTaskSync,
    handlePresenceSync,
    handle,
    list,
    get: list,
    markRead,
    markAllRead,
  };
}

export interface NotificationLayerOptions
  extends NotificationPersistenceLayerOptions,
    NotificationDeliveryLayerOptions {
  /** Test/compatibility adapters; production leaves this unset. */
  readonly sinks?: readonly NotificationSink[];
}

export type NotificationLayer = EffectModule.Layer.Layer<
  NotificationService,
  never,
  | import("../platform/services").FileSystem
  | import("../platform/services").Path
  | Clock
  | import("../platform/services").Random
  | import("../platform/services").ElectronPlatform
>;

/** Builds the service against already-provided persistence and delivery services. */
export function createNotificationServiceLayer(): EffectModule.Layer.Layer<
  NotificationService,
  never,
  NotificationPersistenceService | NotificationDeliveryService | Clock
> {
  return effectRuntime.Layer.effect(
    NotificationService,
    effectRuntime.Effect.gen(function* () {
      const persistence = yield* NotificationPersistenceService;
      const delivery = yield* NotificationDeliveryService;
      const clock = yield* Clock;
      return createNotificationService({ persistence, delivery, clock });
    }),
  ) as EffectModule.Layer.Layer<
    NotificationService,
    never,
    NotificationPersistenceService | NotificationDeliveryService | Clock
  >;
}

/**
 * Full application layer: versioned persistence, platform delivery, and the
 * domain service are composed together so main only learns one seam.
 */
export function createNotificationLayer(
  options: NotificationLayerOptions & { readonly sinks: readonly NotificationSink[] },
): EffectModule.Layer.Layer<
  NotificationService,
  never,
  | import("../platform/services").FileSystem
  | import("../platform/services").Path
  | Clock
  | import("../platform/services").Random
>;
export function createNotificationLayer(options: NotificationLayerOptions): NotificationLayer;
export function createNotificationLayer(options: NotificationLayerOptions): NotificationLayer {
  const persistenceLayer = createNotificationPersistenceLayer(options);
  const deliveryLayer = options.sinks
    ? createNotificationDeliveryLayerFromSinks(options.sinks)
    : createNotificationDeliveryLayer(options);
  const deliveryWithPersistence = options.sinks
    ? deliveryLayer
    : deliveryLayer.pipe(effectRuntime.Layer.provide(persistenceLayer));
  const dependencies = effectRuntime.Layer.mergeAll(
    persistenceLayer,
    deliveryWithPersistence,
  );
  return createNotificationServiceLayer().pipe(
    effectRuntime.Layer.provide(dependencies),
  ) as NotificationLayer;
}

/** Layer helper for unit tests that already own in-memory adapters. */
export function createNotificationLayerFromServices(
  dependencies: NotificationServiceDependencies,
): EffectModule.Layer.Layer<NotificationService, never, never> {
  return effectRuntime.Layer.succeed(
    NotificationService,
    createNotificationService(dependencies),
  );
}

/** Adapt the Effect service to the synchronous legacy sync-engine seam. */
export function toSyncTaskNotifier(
  service: NotificationServiceShape,
  runSync: <A>(effect: NotificationEffect<A>) => A,
): Pick<TaskNotifier, "handleSync"> {
  return {
    handleSync: (accountId, previous, current) =>
      runSync(service.handleTaskSync(accountId, previous, current)),
  };
}

/** Adapt the Effect service to the synchronous legacy sync-engine seam. */
export function toSyncPresenceNotifier(
  service: NotificationServiceShape,
  runSync: <A>(effect: NotificationEffect<A>) => A,
): Pick<PresenceNotifier, "handleSync"> {
  return {
    handleSync: (accountId, current) =>
      runSync(service.handlePresenceSync(accountId, current)),
  };
}

export function toSyncNotificationNotifiers(
  service: NotificationServiceShape,
  runSync: <A>(effect: NotificationEffect<A>) => A,
): {
  readonly taskNotifier: Pick<TaskNotifier, "handleSync">;
  readonly presenceNotifier: Pick<PresenceNotifier, "handleSync">;
} {
  return {
    taskNotifier: toSyncTaskNotifier(service, runSync),
    presenceNotifier: toSyncPresenceNotifier(service, runSync),
  };
}

export const NotificationServiceLive = createNotificationLayer;
export const TaskNotificationService = NotificationService;
export const PresenceNotificationService = NotificationService;
export const TaskNotificationServiceLive = createNotificationLayer;
export const PresenceNotificationServiceLive = createNotificationLayer;
export const createNotificationApplicationLayer = createNotificationLayer;
export const createNotificationDomainLayer = createNotificationLayer;

function isolate<A>(effect: NotificationEffect<A>): NotificationEffect<A> {
  return effect.pipe(
    effectRuntime.Effect.catchCause(() => effectRuntime.Effect.succeed(undefined as A)),
  );
}

function recover<F>(fallback: F) {
  return <A>(effect: NotificationEffect<A>): NotificationEffect<A | F> =>
    effect.pipe(
      effectRuntime.Effect.catchCause(() => effectRuntime.Effect.succeed(fallback)),
    );
}
