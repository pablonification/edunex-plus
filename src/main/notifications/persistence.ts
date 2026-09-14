import type * as EffectModule from "effect" with { "resolution-mode": "import" };
import { effectRuntime } from "../effect/effect-runtime";
import type { InAppNotification } from "../../shared/notifications";
import {
  createNotificationStore,
  isInAppNotification,
  type NotificationStore,
} from "./notification-store";
import {
  readPresenceLedger,
  writePresenceLedger,
  type PresenceLedgerServices,
} from "./presence-ledger";
import {
  readSeenLedger,
  writeSeenLedger,
  type SeenLedgerServices,
} from "./seen-ledger";
import {
  Clock,
  FileSystem,
  Path,
  Random,
  type ClockService,
  type FileSystemService,
  type PathService,
  type RandomService,
} from "../platform/services";

/** Effect operations exposed by notification persistence. */
export type NotificationPersistenceEffect<A> = EffectModule.Effect.Effect<A, never, never>;

/** Validated state of the version-1 Task seen-ledger. */
export interface TaskLedgerState {
  readonly initialized: boolean;
  readonly seenIds: readonly string[];
}

/** Validated state of the version-1 Presence seen-ledger. */
export interface PresenceLedgerState {
  readonly seenIds: readonly string[];
}

/**
 * The notification persistence seam. The implementation owns account
 * partitioning, validation, corruption fallbacks, and all versioned file
 * formats; notification behavior only sees validated values and operations.
 */
export interface NotificationPersistenceServiceShape {
  readonly list: (accountId: string) => NotificationPersistenceEffect<InAppNotification[]>;
  readonly append: (
    accountId: string,
    entry: InAppNotification,
  ) => NotificationPersistenceEffect<InAppNotification[]>;
  readonly markRead: (
    accountId: string,
    ids: Iterable<string>,
  ) => NotificationPersistenceEffect<InAppNotification[]>;
  readonly markAllRead: (accountId: string) => NotificationPersistenceEffect<InAppNotification[]>;
  readonly readTaskLedger: (accountId: string) => NotificationPersistenceEffect<TaskLedgerState>;
  /** Adds ids to the existing ledger and persists it; it never removes history. */
  readonly saveTaskLedger: (
    accountId: string,
    ids: Iterable<string>,
  ) => NotificationPersistenceEffect<void>;
  readonly readPresenceLedger: (
    accountId: string,
  ) => NotificationPersistenceEffect<PresenceLedgerState>;
  /** Adds ids to the existing Presence ledger and persists it. */
  readonly savePresenceLedger: (
    accountId: string,
    ids: Iterable<string>,
  ) => NotificationPersistenceEffect<void>;
}

/** Explicit Context key for all persisted notification state. */
export class NotificationPersistenceService extends effectRuntime.Context.Service<
  NotificationPersistenceService,
  NotificationPersistenceServiceShape
>()("EdunexPlus/NotificationPersistenceService") {}

// Vocabulary aliases share one Context key.
export const NotificationStoreService = NotificationPersistenceService;
export const NotificationHistoryService = NotificationPersistenceService;
export const NotificationStateService = NotificationPersistenceService;
export type NotificationStoreServiceShape = NotificationPersistenceServiceShape;
export type NotificationHistoryServiceShape = NotificationPersistenceServiceShape;
export type NotificationStateServiceShape = NotificationPersistenceServiceShape;

export interface NotificationPersistenceServices {
  readonly fileSystem?: FileSystemService;
  readonly path?: PathService;
  readonly clock?: ClockService;
  readonly random?: RandomService;
}

export interface NotificationPersistenceServiceOptions {
  readonly ledgerRoot: string;
  readonly feedRoot: string;
  readonly services?: NotificationPersistenceServices;
  /** Test adapter for the in-app feed; production uses the validated store. */
  readonly storeFor?: (accountId: string) => NotificationStore;
}

/**
 * Builds the persistence implementation directly. The synchronous platform
 * ports make each load/mutate/atomic-write operation indivisible on the main
 * thread, while the per-account maps keep a single validated state owner for
 * each ledger during the process lifetime.
 */
export function createNotificationPersistenceService(
  options: NotificationPersistenceServiceOptions,
): NotificationPersistenceServiceShape {
  const fileSystem = options.services?.fileSystem;
  const path = options.services?.path;
  const clock = options.services?.clock;
  const random = options.services?.random;
  const persistence: SeenLedgerServices = { fileSystem, path, clock, random };
  const presencePersistence: PresenceLedgerServices = { fileSystem, path, clock, random };
  const storeFor =
    options.storeFor ??
    ((accountId: string) =>
      createNotificationStore(options.feedRoot, accountId, {
        fileSystem,
        path,
        clock,
        random,
      }));
  const stores = new Map<string, NotificationStore>();
  const taskLedgers = new Map<string, TaskLedgerState>();
  const presenceLedgers = new Map<string, PresenceLedgerState>();

  function store(accountId: string): NotificationStore {
    const existing = stores.get(accountId);
    if (existing) return existing;
    const created = storeFor(accountId);
    stores.set(accountId, created);
    return created;
  }

  function taskLedger(accountId: string): TaskLedgerState {
    const existing = taskLedgers.get(accountId);
    if (existing) return existing;
    const loaded = readSeenLedger(options.ledgerRoot, accountId, persistence);
    const state: TaskLedgerState = {
      initialized: loaded.initialized,
      seenIds: [...loaded.seenIds],
    };
    taskLedgers.set(accountId, state);
    return state;
  }

  function presenceLedger(accountId: string): PresenceLedgerState {
    const existing = presenceLedgers.get(accountId);
    if (existing) return existing;
    const loaded = readPresenceLedger(options.ledgerRoot, accountId, presencePersistence);
    const state: PresenceLedgerState = { seenIds: [...loaded.seenIds] };
    presenceLedgers.set(accountId, state);
    return state;
  }

  function addIds(ids: Iterable<string>, existing: readonly string[]): string[] {
    const next = new Set(existing);
    for (const id of ids) {
      if (typeof id === "string" && id.length > 0) next.add(id);
    }
    return [...next];
  }

  function saveTaskLedger(accountId: string, ids: Iterable<string>): void {
    const current = taskLedger(accountId);
    const nextIds = addIds(ids, current.seenIds);
    // Keep in-memory state aligned even when the disk write fails. This is the
    // old ledger's behavior: a failed write can suppress a duplicate until a
    // restart, while the next process can still observe the crash window.
    const next: TaskLedgerState = {
      initialized: current.initialized,
      seenIds: nextIds,
    };
    taskLedgers.set(accountId, next);
    try {
      writeSeenLedger(options.ledgerRoot, accountId, nextIds, persistence);
      taskLedgers.set(accountId, { initialized: true, seenIds: nextIds });
    } catch (error) {
      console.error("[notifications] task ledger save failed", error);
    }
  }

  function savePresenceLedger(accountId: string, ids: Iterable<string>): void {
    const current = presenceLedger(accountId);
    const nextIds = addIds(ids, current.seenIds);
    presenceLedgers.set(accountId, { seenIds: nextIds });
    try {
      writePresenceLedger(options.ledgerRoot, accountId, nextIds, presencePersistence);
    } catch (error) {
      console.error("[notifications] presence ledger save failed", error);
    }
  }

  return {
    list: (accountId) => safeSync(() => [...store(accountId).list()], []),
    append: (accountId, entry) =>
      safeSync(() => {
        // Keep the write boundary runtime-validated as well as typed. This
        // prevents an untrusted IPC/test value from poisoning the feed.
        if (!isInAppNotification(entry)) return [];
        return store(accountId).append(entry);
      }, []),
    markRead: (accountId, ids) => safeSync(() => store(accountId).markRead(ids), []),
    markAllRead: (accountId) => safeSync(() => store(accountId).markAllRead(), []),
    readTaskLedger: (accountId) =>
      safeSync(() => {
        const state = taskLedger(accountId);
        return { initialized: state.initialized, seenIds: [...state.seenIds] };
      }, { initialized: false, seenIds: [] }),
    saveTaskLedger: (accountId, ids) =>
      safeSync(() => saveTaskLedger(accountId, ids), undefined),
    readPresenceLedger: (accountId) =>
      safeSync(() => {
        const state = presenceLedger(accountId);
        return { seenIds: [...state.seenIds] };
      }, { seenIds: [] }),
    savePresenceLedger: (accountId, ids) =>
      safeSync(() => savePresenceLedger(accountId, ids), undefined),
  };
}

export interface NotificationPersistenceLayerOptions {
  /** Preferred explicit roots; this preserves the two existing locations. */
  readonly ledgerRoot?: string;
  readonly feedRoot?: string;
  /** Convenience root: `<rootDir>/seen-ledger` and `<rootDir>/notifications`. */
  readonly rootDir?: string;
}

/**
 * Live persistence layer. All filesystem, path, clock, and randomness effects
 * are supplied by the platform layer, so the same service runs against an
 * in-memory filesystem in tests.
 */
export function createNotificationPersistenceLayer(
  options: NotificationPersistenceLayerOptions,
): EffectModule.Layer.Layer<
  NotificationPersistenceService,
  never,
  FileSystem | Path | Clock | Random
> {
  return effectRuntime.Layer.effect(
    NotificationPersistenceService,
    effectRuntime.Effect.gen(function* () {
      const fileSystem = yield* FileSystem;
      const path = yield* Path;
      const clock = yield* Clock;
      const random = yield* Random;
      const roots = notificationRoots(options, path);
      return createNotificationPersistenceService({
        ...roots,
        services: { fileSystem, path, clock, random },
      });
    }),
  ) as EffectModule.Layer.Layer<
    NotificationPersistenceService,
    never,
    FileSystem | Path | Clock | Random
  >;
}

export function createNotificationPersistenceLayerFromService(
  service: NotificationPersistenceServiceShape,
): EffectModule.Layer.Layer<NotificationPersistenceService, never, never> {
  return effectRuntime.Layer.succeed(NotificationPersistenceService, service);
}

export const NotificationPersistenceServiceLive = createNotificationPersistenceLayer;
export const NotificationStoreServiceLive = createNotificationPersistenceLayer;
export const NotificationHistoryServiceLive = createNotificationPersistenceLayer;
export const createNotificationStoreServiceLayer = createNotificationPersistenceLayer;
export const createNotificationHistoryLayer = createNotificationPersistenceLayer;

function notificationRoots(
  options: NotificationPersistenceLayerOptions,
  path: PathService,
): { readonly ledgerRoot: string; readonly feedRoot: string } {
  const rootDir = options.rootDir ?? ".";
  return {
    ledgerRoot: options.ledgerRoot ?? path.join(rootDir, "seen-ledger"),
    feedRoot: options.feedRoot ?? path.join(rootDir, "notifications"),
  };
}

function safeSync<A>(operation: () => A, fallback: A): NotificationPersistenceEffect<A> {
  return effectRuntime.Effect.sync(() => {
    try {
      return operation();
    } catch {
      return fallback;
    }
  });
}
