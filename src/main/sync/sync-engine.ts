import type { ApiResult, EdunexApi, EdunexDataApi } from "../api/client";
import type { TaskNotifier } from "../notifications/task-notifier";
import {
  FEED_KEYS,
  type FeedKey,
  type FeedSnapshot,
} from "../../shared/feeds";
import type { SnapshotCache } from "./snapshot-cache";

export const DEFAULT_SYNC_INTERVAL_MS = 90_000;
export const DEFAULT_SYNC_JITTER_MS = 30_000;
export const MIN_SYNC_INTERVAL_MS = 60_000;
export const DEFAULT_MAX_BACKOFF_MS = 15 * 60_000;

const FEED_ENDPOINTS: ReadonlyArray<{ key: FeedKey; path: string }> = [
  { key: "todo", path: "/todo" },
  { key: "courses", path: "/course/courses" },
  { key: "agenda", path: "/course/agenda" },
  { key: "materials", path: "/course/materials" },
];

export type SyncTickKind = "success" | "failed" | "unauthorized" | "not-ready" | "stopped";

export interface SyncTickResult {
  kind: SyncTickKind;
  updated: FeedSnapshot[];
  failedFeeds: FeedKey[];
}

export interface SyncEngineOptions {
  api: Pick<EdunexApi, "get"> &
    Partial<Pick<EdunexDataApi, "getTodo" | "getCourses" | "getAgenda" | "getMaterials">>;
  cache: SnapshotCache;
  /** The authenticated account whose snapshots this engine owns. */
  getAccountId?: () => string | null;
  /** Convenience for callers that own a single fixed account in a test. */
  accountId?: string;
  onFeedUpdated?: (snapshot: FeedSnapshot) => void;
  /** The auth controller pauses the session on real API 401s. */
  onUnauthorized?: () => void;
  /**
   * New-Task detection (#23). When present, the tick hands the pre-write
   * `/todo` snapshot and the fresh payload to the notifier after a
   * successful cache write; the notifier owns the silent-baseline, digest,
   * ledger, and sink fan-out. Failures inside never fail the tick.
   */
  taskNotifier?: Pick<TaskNotifier, "handleSync">;
  now?: () => number;
  random?: () => number;
  setTimer?: (callback: () => void, delayMs: number) => ReturnType<typeof setTimeout>;
  clearTimer?: (timer: ReturnType<typeof setTimeout>) => void;
  intervalMs?: number;
  jitterMs?: number;
  minIntervalMs?: number;
  maxBackoffMs?: number;
}

export interface SyncEngine {
  /** Starts one immediate tick and keeps ticking independently of the window. */
  start(): boolean;
  stop(): void;
  isRunning(): boolean;
  /** Runs exactly one tick. It does not add a timer when called directly. */
  tick(): Promise<SyncTickResult>;
  /** Reads the current account's persisted snapshot without touching the API. */
  read(feed: FeedKey): FeedSnapshot | null;
}

/**
 * Main-process polling loop. It has no Electron/window dependency, so the
 * same engine continues while a BrowserWindow is hidden in the tray and can
 * be tested against a fake API at the network boundary.
 */
export function createSyncEngine(options: SyncEngineOptions): SyncEngine {
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  const setTimer = options.setTimer ?? ((callback, delayMs) => setTimeout(callback, delayMs));
  const clearTimer = options.clearTimer ?? ((timer) => clearTimeout(timer));
  const intervalMs = options.intervalMs ?? DEFAULT_SYNC_INTERVAL_MS;
  const jitterMs = options.jitterMs ?? DEFAULT_SYNC_JITTER_MS;
  const minIntervalMs = Math.max(options.minIntervalMs ?? MIN_SYNC_INTERVAL_MS, 0);
  const maxBackoffMs = Math.max(options.maxBackoffMs ?? DEFAULT_MAX_BACKOFF_MS, minIntervalMs);

  let running = false;
  let inFlight = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let generation = 0;
  let consecutiveFailures = 0;

  function getAccountId() {
    const accountId = options.getAccountId?.() ?? options.accountId ?? null;
    return accountId && accountId.length > 0 ? accountId : null;
  }

  function isActive(runGeneration: number) {
    return running && generation === runGeneration;
  }

  function nextRegularDelay() {
    const randomValue = random();
    const boundedRandom = Number.isFinite(randomValue)
      ? Math.min(1, Math.max(0, randomValue))
      : 0.5;
    const jittered = intervalMs - jitterMs + Math.floor(boundedRandom * jitterMs * 2);
    return Math.max(minIntervalMs, Math.round(jittered));
  }

  function nextBackoffDelay() {
    const exponential = intervalMs * 2 ** consecutiveFailures;
    return Math.min(maxBackoffMs, Math.max(minIntervalMs, exponential));
  }

  function schedule(runGeneration: number, delayMs: number) {
    if (!isActive(runGeneration)) return;
    if (timer) clearTimer(timer);
    timer = setTimer(() => {
      timer = null;
      void runScheduledTick(runGeneration);
    }, delayMs);
  }

  function fetchFeed(key: FeedKey, path: string) {
    if (key === "todo" && options.api.getTodo) return options.api.getTodo();
    if (key === "courses" && options.api.getCourses) return options.api.getCourses();
    if (key === "agenda" && options.api.getAgenda) return options.api.getAgenda();
    if (key === "materials" && options.api.getMaterials) return options.api.getMaterials();
    return options.api.get(path);
  }

  function stop() {
    running = false;
    generation += 1;
    if (timer) {
      clearTimer(timer);
      timer = null;
    }
  }

  async function runScheduledTick(runGeneration: number) {
    if (!isActive(runGeneration) || inFlight) return;
    const result = await performTick(runGeneration);
    if (!isActive(runGeneration)) return;
    if (result.kind === "stopped" || result.kind === "unauthorized") return;
    schedule(
      runGeneration,
      result.kind === "failed" ? nextBackoffDelay() : nextRegularDelay(),
    );
  }

  async function performTick(runGeneration: number | null): Promise<SyncTickResult> {
    if (runGeneration !== null && !isActive(runGeneration)) {
      return { kind: "stopped", updated: [], failedFeeds: [] };
    }
    if (inFlight) return { kind: "stopped", updated: [], failedFeeds: [] };

    const accountId = getAccountId();
    if (!accountId) return { kind: "not-ready", updated: [], failedFeeds: [] };

    inFlight = true;
    try {
      let responses: Array<{ key: FeedKey; result: ApiResult }>;
      try {
        responses = await Promise.all(
          FEED_ENDPOINTS.map(async ({ key, path }) => ({
            key,
            result: await fetchFeed(key, path),
          })),
        );
      } catch {
        consecutiveFailures += 1;
        return { kind: "failed", updated: [], failedFeeds: [...FEED_KEYS] };
      }

      if (runGeneration !== null && !isActive(runGeneration)) {
        return { kind: "stopped", updated: [], failedFeeds: [] };
      }

      if (responses.some(({ result }) => result.status === 401)) {
        stop();
        safelyCallUnauthorized();
        return { kind: "unauthorized", updated: [], failedFeeds: [] };
      }

      const failedFeeds = responses
        .filter(({ result }) => !isSuccessful(result) || result.body == null)
        .map(({ key }) => key);
      const updated: FeedSnapshot[] = [];
      const fetchedAt = new Date(now()).toISOString();
      const prevTodoData = options.taskNotifier
        ? safelyReadTodoForDiff(accountId)
        : null;

      for (const { key, result } of responses) {
        if (!isSuccessful(result) || result.body == null) continue;
        try {
          const snapshot = options.cache.write(
            accountId,
            key,
            result.body,
            fetchedAt,
          );
          updated.push(snapshot);
          safelyCallFeedUpdated(snapshot);
          if (key === "todo" && options.taskNotifier) {
            safelyNotifyNewTasks(accountId, prevTodoData, result.body);
          }
        } catch {
          if (!failedFeeds.includes(key)) failedFeeds.push(key);
        }
      }

      if (failedFeeds.length > 0) {
        consecutiveFailures += 1;
        return { kind: "failed", updated, failedFeeds };
      }

      consecutiveFailures = 0;
      return { kind: "success", updated, failedFeeds: [] };
    } finally {
      inFlight = false;
    }
  }

  function safelyCallUnauthorized() {
    try {
      options.onUnauthorized?.();
    } catch (error) {
      console.error("[sync] unauthorized handler failed:", error);
    }
  }

  function safelyCallFeedUpdated(snapshot: FeedSnapshot) {
    try {
      options.onFeedUpdated?.(snapshot);
    } catch (error) {
      console.error("[sync] feed update handler failed:", error);
    }
  }

  function safelyReadTodoForDiff(accountId: string): unknown {
    try {
      return options.cache.read(accountId, "todo")?.data ?? null;
    } catch (error) {
      console.error("[sync] todo diff baseline read failed:", error);
      return null;
    }
  }

  function safelyNotifyNewTasks(accountId: string, prevData: unknown, nextData: unknown) {
    try {
      options.taskNotifier?.handleSync(accountId, prevData, nextData);
    } catch (error) {
      console.error("[sync] task notification failed:", error);
    }
  }

  return {
    start() {
      if (running) return false;
      running = true;
      consecutiveFailures = 0;
      generation += 1;
      const runGeneration = generation;
      void runScheduledTick(runGeneration);
      return true;
    },

    stop,

    isRunning: () => running,

    tick: () => performTick(null),

    read(feed) {
      const accountId = getAccountId();
      return accountId ? options.cache.read(accountId, feed) : null;
    },
  };
}

function isSuccessful(result: ApiResult) {
  return result.ok || (result.status >= 200 && result.status < 300);
}
