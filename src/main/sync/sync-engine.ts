import type * as EffectModule from "effect" with { "resolution-mode": "import" };
import { effectRuntime } from "../effect/effect-runtime";
import { formatSafeCause } from "../effect/conventions";
import {
  ACTIVE_COURSES_PATH,
  type ApiResult,
} from "../api/client";
import { extractPresenceWindows, nextPresenceDelay } from "../notifications/presence-detector";
import { type FeedKey, type FeedSnapshot } from "../../shared/feeds";
import {
  AuthService,
  type AuthServiceShape,
} from "../auth/auth-service";
import {
  CognisiaService,
  type CognisiaServiceShape,
} from "../api/api-service";
import {
  SnapshotCacheService,
  type SnapshotCacheServiceShape,
} from "./snapshot-cache";
import {
  NotificationService,
  type NotificationServiceShape,
} from "../notifications/notification-service";
import {
  Clock,
  Random,
  type ClockService,
  type RandomService,
} from "../platform/services";

export const DEFAULT_SYNC_INTERVAL_MS = 90_000;
export const DEFAULT_SYNC_JITTER_MS = 30_000;
export const MIN_SYNC_INTERVAL_MS = 60_000;
export const DEFAULT_MAX_BACKOFF_MS = 15 * 60_000;

export const FEED_ENDPOINTS: ReadonlyArray<{ key: FeedKey; path: string }> = [
  { key: "todo", path: "/todo" },
  { key: "courses", path: ACTIVE_COURSES_PATH },
  { key: "exams", path: "/exam/exams" },
  { key: "agenda", path: "/course/agenda" },
  { key: "presences", path: "/course/presences/list" },
  { key: "materials", path: "/course/materials" },
];

function isSuccessful(result: ApiResult) {
  return result.ok || (result.status >= 200 && result.status < 300);
}

export type SyncTickKind = "success" | "failed" | "unauthorized" | "not-ready" | "stopped";

export interface SyncTickResult {
  kind: SyncTickKind;
  updated: FeedSnapshot[];
  failedFeeds: FeedKey[];
}

// ---------------------------------------------------------------------------
// Effect-owned synchronization
// ---------------------------------------------------------------------------

/** The background service intentionally has no failure channel. A feed error
 * becomes data on the tick result so one ordinary failure cannot tear down the
 * session's long-lived fiber. Interruptions still propagate normally. */
export type SyncEffect<A> = EffectModule.Effect.Effect<A, never, never>;

export interface SyncServiceShape {
  /** Starts one immediate tick and owns all later work in one fiber. */
  readonly start: () => SyncEffect<boolean>;
  /** Invalidates the current session generation and interrupts pending work. */
  readonly stop: () => SyncEffect<void>;
  readonly isRunning: () => SyncEffect<boolean>;
  /** Runs exactly one tick without installing another schedule. */
  readonly tick: () => SyncEffect<SyncTickResult>;
  /** Reads only the current account's persisted snapshot. */
  readonly read: (feed: FeedKey) => SyncEffect<FeedSnapshot | null>;
}

export class SyncService extends effectRuntime.Context.Service<
  SyncService,
  SyncServiceShape
>()("EdunexPlus/SyncService") {}

/** Configuration for the session-owned synchronization fiber. */
export interface SyncServiceOptions {
  readonly intervalMs?: number;
  readonly jitterMs?: number;
  readonly minIntervalMs?: number;
  readonly maxBackoffMs?: number;
  /** Main-process publication boundary; never runs in the renderer. */
  readonly onFeedUpdated?: (snapshot: FeedSnapshot) => void;
  /** Set false only for a host that deliberately has no notification service. */
  readonly alignPresence?: boolean;
}

/** Replaceable dependencies used by the service implementation and tests. */
export interface SyncServiceDependencies {
  readonly auth: Pick<AuthServiceShape, "accountId" | "status" | "handleUnauthorized">;
  readonly api: Pick<CognisiaServiceShape, "get"> &
    Partial<
      Pick<
        CognisiaServiceShape,
        "getTodo" | "getCourses" | "getExams" | "getAgenda" | "getPresences" | "getMaterials"
      >
    >;
  readonly cache: Pick<SnapshotCacheServiceShape, "read" | "write">;
  readonly notifications?: Pick<
    NotificationServiceShape,
    "handleTaskSync" | "handlePresenceSync"
  >;
  readonly clock: ClockService;
  readonly random: RandomService;
}

export type SyncServiceLayer = EffectModule.Layer.Layer<
  SyncService,
  never,
  AuthService | CognisiaService | SnapshotCacheService | NotificationService | Clock | Random
>;

/**
 * Production layer for one session-owned synchronization service. The
 * FiberHandle is acquired inside the application layer's managed scope, so
 * application shutdown interrupts the loop and any child HTTP work.
 */
export function createSyncServiceLayer(options: SyncServiceOptions = {}): SyncServiceLayer {
  return effectRuntime.Layer.effect(
    SyncService,
    effectRuntime.Effect.gen(function* () {
      const auth = yield* AuthService;
      const api = yield* CognisiaService;
      const cache = yield* SnapshotCacheService;
      const notifications = yield* NotificationService;
      const clock = yield* Clock;
      const random = yield* Random;
      const handle = yield* effectRuntime.FiberHandle.make<void, never>();
      return createSyncServiceFromDependencies(
        { auth, api, cache, notifications, clock, random },
        handle,
        options,
      );
    }),
  ) as SyncServiceLayer;
}

/**
 * Test/composition helper. It still creates the FiberHandle in a managed
 * scope, while every domain and platform dependency comes from the caller.
 */
export function createSyncServiceLayerFromServices(
  dependencies: SyncServiceDependencies,
  options: SyncServiceOptions = {},
): EffectModule.Layer.Layer<SyncService, never, never> {
  return effectRuntime.Layer.effect(
    SyncService,
    effectRuntime.Effect.gen(function* () {
      const handle = yield* effectRuntime.FiberHandle.make<void, never>();
      return createSyncServiceFromDependencies(dependencies, handle, options);
    }),
  ) as EffectModule.Layer.Layer<SyncService, never, never>;
}

export const SyncServiceLive = createSyncServiceLayer;
export const SynchronizationService = SyncService;
export const SynchronizationServiceLive = createSyncServiceLayer;
export const createSyncLayer = createSyncServiceLayer;
export const createSynchronizationLayer = createSyncServiceLayer;

interface SyncLifecycle {
  readonly running: boolean;
  readonly generation: number;
  readonly inFlight: boolean;
  readonly consecutiveFailures: number;
}

interface FeedRead {
  readonly key: FeedKey;
  readonly result: ApiResult | null;
}

interface TickClaim {
  readonly generation: number;
  readonly scheduled: boolean;
}

type SyncFiberHandle = EffectModule.FiberHandle.FiberHandle<void, never>;

function createSyncServiceFromDependencies(
  dependencies: SyncServiceDependencies,
  handle: SyncFiberHandle,
  options: SyncServiceOptions,
): SyncServiceShape {
  const intervalMs = Math.max(options.intervalMs ?? DEFAULT_SYNC_INTERVAL_MS, 0);
  const jitterMs = Math.max(options.jitterMs ?? DEFAULT_SYNC_JITTER_MS, 0);
  const minIntervalMs = Math.max(options.minIntervalMs ?? MIN_SYNC_INTERVAL_MS, 0);
  const maxBackoffMs = Math.max(
    options.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS,
    minIntervalMs,
  );
  const alignPresence = options.alignPresence ?? Boolean(dependencies.notifications);
  // Lifecycle transitions are pure atomic updates. A plain Ref keeps the
  // auth callback's start/stop boundary synchronous, so a sign-out can bump
  // the generation before a late HTTP promise settles.
  const lifecycle = effectRuntime.Ref.makeUnsafe<SyncLifecycle>({
    running: false,
    generation: 0,
    inFlight: false,
    consecutiveFailures: 0,
  });

  function start(): SyncEffect<boolean> {
    return effectRuntime.Effect.gen(function* () {
      const generation = yield* effectRuntime.Ref.modify(
        lifecycle,
        (current): readonly [number | null, SyncLifecycle] => {
          if (current.running) return [null, current];
          const nextGeneration = current.generation + 1;
          return [nextGeneration, {
            ...current,
            running: true,
            generation: nextGeneration,
            inFlight: false,
            consecutiveFailures: 0,
          }];
        },
      );
      if (generation === null) return false;

      // FiberHandle.run is synchronous up to the fork boundary. It replaces a
      // just-interrupted prior fiber, while the generation guard below keeps
      // that old fiber from publishing anything if its promise settles late.
      yield* effectRuntime.FiberHandle.run(handle, runLoop(generation));
      return true;
    });
  }

  function stop(): SyncEffect<void> {
    return effectRuntime.Effect.gen(function* () {
      yield* effectRuntime.Ref.update(lifecycle, (current) => ({
        ...current,
        running: false,
        generation: current.generation + 1,
        inFlight: false,
        consecutiveFailures: 0,
      }));

      // Interrupt immediately rather than waiting for FiberHandle.clear. This
      // method is also called re-entrantly by the auth 401 broadcast while the
      // sync fiber is running; interruptUnsafe is safe for that boundary and
      // leaves the handle's observer to remove the completed fiber.
      yield* effectRuntime.Effect.sync(() => {
        if (handle.state._tag === "Open") handle.state.fiber?.interruptUnsafe();
      });
    });
  }

  function isRunning(): SyncEffect<boolean> {
    return effectRuntime.Effect.sync(() =>
      effectRuntime.Ref.getUnsafe(lifecycle).running,
    );
  }

  function tick(): SyncEffect<SyncTickResult> {
    return performTick(null);
  }

  function isActiveGeneration(generation: number): boolean {
    const current = effectRuntime.Ref.getUnsafe(lifecycle);
    return current.running && current.generation === generation;
  }

  function read(feed: FeedKey): SyncEffect<FeedSnapshot | null> {
    return dependencies.auth.accountId().pipe(
      effectRuntime.Effect.flatMap((accountId) =>
        accountId ? readSnapshot(accountId, feed) : effectRuntime.Effect.succeed(null),
      ),
      recoverOrdinary(null),
    );
  }

  function runLoop(generation: number): SyncEffect<void> {
    const body = effectRuntime.Effect.gen(function* () {
      while (true) {
        const result = yield* performTick(generation);
        if (!isActiveGeneration(generation) || result.kind === "stopped" || result.kind === "unauthorized") {
          return;
        }

        const delay = result.kind === "failed"
          ? nextBackoffDelay()
          : yield* nextSuccessDelay();
        if (!isActiveGeneration(generation)) return;
        yield* sleepWithClock(dependencies.clock, delay);
      }
    });

    return body.pipe(
      effectRuntime.Effect.catchCause((cause) => {
        if (effectRuntime.Cause.hasInterrupts(cause)) return effectRuntime.Effect.interrupt;
        console.error("[sync] background loop stopped:", formatSafeCause(cause));
        return effectRuntime.Effect.void;
      }),
      effectRuntime.Effect.ensuring(markLoopEnded(generation)),
    );
  }

  function performTick(
    scheduledGeneration: number | null,
  ): SyncEffect<SyncTickResult> {
    return effectRuntime.Effect.gen(function* () {
      const claim = yield* claimTick(scheduledGeneration);
      if (!claim) return stoppedTick();

      return yield* effectRuntime.Effect.ensuring(
        effectRuntime.Effect.gen(function* () {
          const result = yield* performClaimedTick(claim);
          yield* recordTickResult(claim.generation, result);
          return result;
        }),
        releaseTick(claim.generation),
      );
    });
  }

  function performClaimedTick(claim: TickClaim): SyncEffect<SyncTickResult> {
    return effectRuntime.Effect.gen(function* () {
      const accountId = yield* dependencies.auth.accountId();
      if (!accountId) return { kind: "not-ready", updated: [], failedFeeds: [] };
      if (!(yield* sessionIsCurrent(claim, accountId))) return stoppedTick();

      const responses = yield* effectRuntime.Effect.all(
        FEED_ENDPOINTS.map(({ key, path }) => readFeed(key, path)),
        { concurrency: "unbounded" },
      );

      // Do not allow an old session's response set to enter the cache. This
      // check covers sign-out, session expiry, account switching, and a new
      // start that occurs before a prior HTTP promise settles.
      if (!(yield* sessionIsCurrent(claim, accountId))) return stoppedTick();

      if (responses.some(({ result }) => result?.status === 401)) {
        yield* invalidateGeneration(claim.generation);
        yield* expireUnauthorizedSession();
        return { kind: "unauthorized", updated: [], failedFeeds: [] };
      }

      const failedFeeds = responses
        .filter(({ result }) =>
          result === null || !isSuccessful(result) || result.body == null,
        )
        .map(({ key }) => key);
      const updated: FeedSnapshot[] = [];
      const fetchedAt = new Date(dependencies.clock.now()).toISOString();
      const notificationEnabled = Boolean(dependencies.notifications);
      const previousTodo = notificationEnabled
        ? yield* readSnapshot(accountId, "todo").pipe(
            effectRuntime.Effect.map((snapshot) => snapshot?.data ?? null),
          )
        : null;

      for (const { key, result } of responses) {
        if (result === null || !isSuccessful(result) || result.body == null) continue;
        if (!(yield* sessionIsCurrent(claim, accountId))) return stoppedTick();

        const written = yield* writeSnapshot(
          accountId,
          key,
          result.body,
          fetchedAt,
        );
        if (written === null) {
          if (!failedFeeds.includes(key)) failedFeeds.push(key);
          continue;
        }
        if (!(yield* sessionIsCurrent(claim, accountId))) return stoppedTick();

        updated.push(written);
        yield* isolateOrdinary(
          effectRuntime.Effect.sync(() => options.onFeedUpdated?.(written)),
        );

        if (key === "todo") {
          yield* notifyTasks(accountId, previousTodo, result.body, claim);
        } else if (key === "agenda") {
          yield* notifyPresence(accountId, result.body, claim);
        }
      }

      if (!(yield* sessionIsCurrent(claim, accountId))) return stoppedTick();
      if (failedFeeds.length > 0) return { kind: "failed", updated, failedFeeds };
      return { kind: "success", updated, failedFeeds: [] };
    });
  }

  function claimTick(scheduledGeneration: number | null): SyncEffect<TickClaim | null> {
    return effectRuntime.Ref.modify(
      lifecycle,
      (current): readonly [TickClaim | null, SyncLifecycle] => {
        if (current.inFlight) return [null, current];
        if (
          scheduledGeneration !== null &&
          (!current.running || current.generation !== scheduledGeneration)
        ) {
          return [null, current];
        }
        return [{
          generation: current.generation,
          scheduled: scheduledGeneration !== null,
        }, { ...current, inFlight: true }];
      },
    );
  }

  function releaseTick(generation: number): SyncEffect<void> {
    return effectRuntime.Ref.update(lifecycle, (current) =>
      current.generation === generation ? { ...current, inFlight: false } : current,
    );
  }

  function recordTickResult(
    generation: number,
    result: SyncTickResult,
  ): SyncEffect<void> {
    return effectRuntime.Ref.update(lifecycle, (current) => {
      if (current.generation !== generation) return current;
      if (result.kind === "failed") {
        return {
          ...current,
          consecutiveFailures: current.consecutiveFailures + 1,
        };
      }
      if (result.kind === "success") return { ...current, consecutiveFailures: 0 };
      return current;
    });
  }

  function invalidateGeneration(generation: number): SyncEffect<void> {
    return effectRuntime.Ref.update(lifecycle, (current) =>
      current.generation === generation
        ? {
            ...current,
            running: false,
            generation: current.generation + 1,
            inFlight: false,
            consecutiveFailures: 0,
          }
        : current,
    );
  }

  function markLoopEnded(generation: number): SyncEffect<void> {
    return effectRuntime.Ref.update(lifecycle, (current) =>
      current.generation === generation
        ? { ...current, running: false, inFlight: false }
        : current,
    );
  }

  function sessionIsCurrent(
    claim: TickClaim,
    accountId: string,
  ): SyncEffect<boolean> {
    return effectRuntime.Effect.gen(function* () {
      const current = lifecycle;
      const state = effectRuntime.Ref.getUnsafe(current);
      if (
        state.generation !== claim.generation ||
        (claim.scheduled && !state.running)
      ) return false;
      return (yield* dependencies.auth.accountId()) === accountId;
    });
  }

  function nextRegularDelay(): number {
    let randomValue = 0.5;
    try {
      randomValue = dependencies.random.next();
    } catch {
      // A broken random adapter must not stop background synchronization, but
      // the failure should remain observable without exposing its message.
      console.error("[sync] random source failed; using midpoint jitter");
    }
    const boundedRandom = Number.isFinite(randomValue)
      ? Math.min(1, Math.max(0, randomValue))
      : 0.5;
    const jittered = intervalMs - jitterMs +
      Math.floor(boundedRandom * jitterMs * 2);
    return Math.max(minIntervalMs, Math.round(jittered));
  }

  function nextBackoffDelay(): number {
    const exponential = intervalMs *
      2 ** effectRuntime.Ref.getUnsafe(lifecycle).consecutiveFailures;
    return Math.min(maxBackoffMs, Math.max(minIntervalMs, exponential));
  }

  function nextSuccessDelay(): SyncEffect<number> {
    const regular = nextRegularDelay();
    if (!alignPresence) return effectRuntime.Effect.succeed(regular);

    return effectRuntime.Effect.gen(function* () {
      const accountId = yield* dependencies.auth.accountId();
      if (!accountId) return regular;
      const agenda = yield* readSnapshot(accountId, "agenda");
      if (agenda?.data == null) return regular;
      const { delayMs } = nextPresenceDelay(
        extractPresenceWindows(agenda.data),
        dependencies.clock.now(),
        regular,
      );
      return Math.max(minIntervalMs, Math.min(maxBackoffMs, delayMs));
    });
  }

  function readFeed(key: FeedKey, path: string): SyncEffect<FeedRead> {
    // Defer adapter invocation until the feed fiber runs. This keeps a
    // synchronous adapter defect local to its feed as well as handling the
    // normal failed Effect / rejected HTTP request path below.
    return effectRuntime.Effect.suspend(() => {
      const request = readFeedRequest(key, path);
      return request.pipe(effectRuntime.Effect.map((result) => ({ key, result })));
    }).pipe(
      effectRuntime.Effect.catchCause((cause) => {
        if (effectRuntime.Cause.hasInterrupts(cause)) return effectRuntime.Effect.interrupt;
        console.error(`[sync] ${key} feed read failed:`, formatSafeCause(cause));
        return effectRuntime.Effect.succeed({ key, result: null });
      }),
    );
  }

  function readFeedRequest(key: FeedKey, path: string): SyncEffect<ApiResult> {
    switch (key) {
      case "todo":
        return dependencies.api.getTodo?.() ?? dependencies.api.get(path);
      case "courses":
        return dependencies.api.getCourses?.() ?? dependencies.api.get(path);
      case "exams":
        return dependencies.api.getExams?.() ?? dependencies.api.get(path);
      case "agenda":
        return dependencies.api.getAgenda?.() ?? dependencies.api.get(path);
      case "presences":
        return dependencies.api.getPresences?.() ?? dependencies.api.get(path);
      case "materials":
        return dependencies.api.getMaterials?.() ?? dependencies.api.get(path);
    }
  }

  function readSnapshot(accountId: string, feed: FeedKey): SyncEffect<FeedSnapshot | null> {
    return dependencies.cache.read(accountId, feed).pipe(recoverOrdinary(null));
  }

  function writeSnapshot(
    accountId: string,
    feed: FeedKey,
    data: unknown,
    fetchedAt: string,
  ): SyncEffect<FeedSnapshot | null> {
    return dependencies.cache.write(accountId, feed, data, fetchedAt).pipe(
      effectRuntime.Effect.map((snapshot) => snapshot),
      effectRuntime.Effect.catchCause((cause) =>
        effectRuntime.Cause.hasInterrupts(cause)
          ? effectRuntime.Effect.interrupt
          : logAndSucceed(null, "[sync] snapshot write failed:", cause),
      ),
    );
  }

  function notifyTasks(
    accountId: string,
    previous: unknown,
    current: unknown,
    claim: TickClaim,
  ): SyncEffect<void> {
    return effectRuntime.Effect.gen(function* () {
      if (!(yield* sessionIsCurrent(claim, accountId))) return;
      if (!dependencies.notifications) return;
      yield* isolateOrdinary(
        dependencies.notifications.handleTaskSync(accountId, previous, current),
      );
    });
  }

  function notifyPresence(
    accountId: string,
    current: unknown,
    claim: TickClaim,
  ): SyncEffect<void> {
    return effectRuntime.Effect.gen(function* () {
      if (!(yield* sessionIsCurrent(claim, accountId))) return;
      if (!dependencies.notifications) return;
      yield* isolateOrdinary(
        dependencies.notifications.handlePresenceSync(accountId, current),
      );
    });
  }

  function expireUnauthorizedSession(): SyncEffect<void> {
    return dependencies.auth.status().pipe(
      effectRuntime.Effect.flatMap((status) =>
        status === "session-expired"
          ? effectRuntime.Effect.void
          : dependencies.auth.handleUnauthorized(),
      ),
      isolateOrdinary,
    );
  }

  return { start, stop, isRunning, tick, read };
}

function stoppedTick(): SyncTickResult {
  return { kind: "stopped", updated: [], failedFeeds: [] };
}

function sleepWithClock(clock: ClockService, delayMs: number): SyncEffect<void> {
  return effectRuntime.Effect.callback<void>((resume) => {
    const timer = clock.setTimeout(
      () => resume(effectRuntime.Effect.void),
      Math.max(0, Math.round(delayMs)),
    );
    return effectRuntime.Effect.sync(() => clock.clearTimeout(timer));
  });
}

function isolateOrdinary<A>(
  effect: EffectModule.Effect.Effect<A, never, never>,
): SyncEffect<void> {
  return effect.pipe(
    effectRuntime.Effect.asVoid,
    effectRuntime.Effect.catchCause((cause) =>
      effectRuntime.Cause.hasInterrupts(cause)
        ? effectRuntime.Effect.interrupt
        : logAndSucceed(undefined, "[sync] isolated sync operation failed:", cause),
    ),
  );
}

function recoverOrdinary<F>(fallback: F) {
  return <A>(
    effect: EffectModule.Effect.Effect<A, never, never>,
  ): SyncEffect<A | F> => effect.pipe(
    effectRuntime.Effect.catchCause((cause) =>
      effectRuntime.Cause.hasInterrupts(cause)
        ? effectRuntime.Effect.interrupt
        : logAndSucceed(fallback, "[sync] sync state access failed:", cause),
    ),
  );
}

function logAndSucceed<A>(
  value: A,
  message: string,
  cause: EffectModule.Cause.Cause<unknown>,
): SyncEffect<A> {
  console.error(message, formatSafeCause(cause));
  return effectRuntime.Effect.succeed(value);
}
