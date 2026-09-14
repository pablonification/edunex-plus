import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vitest";
import type { AuthStatus } from "../../shared/auth";
import type { FeedKey, FeedSnapshot } from "../../shared/feeds";
import type { ApiResult } from "../api/client";
import { createApplicationRuntime } from "../effect/runtime";
import {
  createSyncServiceLayerFromServices,
  SyncService,
  type SyncServiceDependencies,
} from "./sync-engine";

interface TestTimer {
  readonly at: number;
  readonly callback: () => void;
  active: boolean;
}

function createTestClock(startMs = 1_000_000) {
  let nowMs = startMs;
  const timers: TestTimer[] = [];
  const delays: number[] = [];

  return {
    clock: {
      now: () => nowMs,
      setTimeout: (callback: () => void, delayMs: number) => {
        const timer: TestTimer = {
          at: nowMs + delayMs,
          callback,
          active: true,
        };
        timers.push(timer);
        delays.push(delayMs);
        return timer;
      },
      clearTimeout: (timer: unknown) => {
        if (typeof timer === "object" && timer !== null && "active" in timer) {
          (timer as TestTimer).active = false;
        }
      },
    },
    delays,
    async advance(amountMs: number) {
      nowMs += amountMs;
      while (true) {
        const due = timers
          .filter((timer) => timer.active && timer.at <= nowMs)
          .sort((left, right) => left.at - right.at)[0];
        if (!due) return;
        due.active = false;
        due.callback();
        await Promise.resolve();
      }
    },
    setNow(value: number) {
      nowMs = value;
    },
  };
}

function success(body: unknown): ApiResult {
  return { status: 200, ok: true, body };
}

function failure(status = 503): ApiResult {
  return { status, ok: false, body: null };
}

function createHarness(options: {
  readonly clock?: ReturnType<typeof createTestClock>;
  readonly bodyFor?: (path: string) => unknown;
  readonly resultFor?: (path: string) => ApiResult;
  readonly notifications?: SyncServiceDependencies["notifications"];
  readonly pending?: boolean;
  readonly failPaths?: ReadonlySet<string>;
} = {}) {
  const testClock = options.clock ?? createTestClock();
  const calls: string[] = [];
  const writes: FeedKey[] = [];
  const snapshots = new Map<string, FeedSnapshot>();
  let accountId: string | null = "190136";
  let status: AuthStatus = "signed-in";
  let unauthorizedCalls = 0;
  let activeReads = 0;
  let maxActiveReads = 0;
  let abortedReads = 0;
  const pendingResolvers: Array<(result: ApiResult) => void> = [];

  const api: SyncServiceDependencies["api"] = {
    get: (path) => {
      calls.push(path);
      if (options.pending) {
        return Effect.promise((signal) => new Promise<ApiResult>((resolve) => {
          pendingResolvers.push(resolve);
          signal.addEventListener("abort", () => {
            abortedReads += 1;
          }, { once: true });
        }));
      }

      return Effect.promise(() => {
        activeReads += 1;
        maxActiveReads = Math.max(maxActiveReads, activeReads);
        const result = options.resultFor?.(path) ??
          (options.failPaths?.has(path)
            ? failure()
            : success(options.bodyFor?.(path) ?? { data: [] }));
        return Promise.resolve(result).finally(() => {
          activeReads -= 1;
        });
      });
    },
  };

  const auth: SyncServiceDependencies["auth"] = {
    accountId: () => Effect.sync(() => accountId),
    status: () => Effect.sync(() => status),
    handleUnauthorized: () => Effect.sync(() => {
      unauthorizedCalls += 1;
      accountId = null;
      status = "session-expired";
    }),
  };

  const cache: SyncServiceDependencies["cache"] = {
    read: (currentAccountId, feed) => Effect.sync(() =>
      snapshots.get(`${currentAccountId}/${feed}`) ?? null,
    ),
    write: (currentAccountId, feed, data, fetchedAt) => Effect.sync(() => {
      const snapshot = { feed, accountId: currentAccountId, data, fetchedAt };
      snapshots.set(`${currentAccountId}/${feed}`, snapshot);
      writes.push(feed);
      return snapshot;
    }),
  };

  const runtime = createApplicationRuntime(
    createSyncServiceLayerFromServices(
      {
        auth,
        api,
        cache,
        notifications: options.notifications,
        clock: testClock.clock,
        random: { next: () => 0.5 },
      },
      { alignPresence: options.notifications !== undefined },
    ),
  );
  const service = runtime.runSync(Effect.service(SyncService));

  return {
    runtime,
    service,
    clock: testClock,
    calls,
    writes,
    snapshots,
    pendingResolvers,
    get accountId() {
      return accountId;
    },
    setAccountId(value: string | null) {
      accountId = value;
    },
    get status() {
      return status;
    },
    setStatus(value: AuthStatus) {
      status = value;
    },
    get unauthorizedCalls() {
      return unauthorizedCalls;
    },
    get maxActiveReads() {
      return maxActiveReads;
    },
    get abortedReads() {
      return abortedReads;
    },
  };
}

const runtimes: Array<ReturnType<typeof createApplicationRuntime>> = [];

afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.shutdown()));
});

async function flush(runtime: ReturnType<typeof createApplicationRuntime>) {
  for (let index = 0; index < 5; index += 1) {
    await runtime.runPromise(Effect.yieldNow);
    await Promise.resolve();
  }
}

describe("Effect-owned sync service", () => {
  it("runs all six feeds concurrently and isolates one ordinary feed failure", async () => {
    const harness = createHarness({ failPaths: new Set(["/course/agenda"]) });
    runtimes.push(harness.runtime);

    const result = await harness.runtime.runPromise(harness.service.tick());

    expect(result.kind).toBe("failed");
    expect(result.failedFeeds).toEqual(["agenda"]);
    expect(harness.calls).toHaveLength(6);
    expect(harness.writes).toHaveLength(5);
    // Promise-backed reads overlap even though the result array retains the
    // stable FEED_ENDPOINTS order.
    expect(harness.maxActiveReads).toBeGreaterThan(1);
  });

  it("owns immediate startup and the jittered cadence in the injected Clock", async () => {
    const harness = createHarness();
    runtimes.push(harness.runtime);

    expect(harness.runtime.runSync(harness.service.start())).toBe(true);
    await flush(harness.runtime);
    expect(harness.calls).toHaveLength(6);
    expect(harness.clock.delays[0]).toBe(90_000);

    await harness.clock.advance(89_999);
    await flush(harness.runtime);
    expect(harness.calls).toHaveLength(6);
    await harness.clock.advance(1);
    await flush(harness.runtime);
    expect(harness.calls).toHaveLength(12);
  });

  it("backs off exponentially while retaining the configured maximum", async () => {
    const harness = createHarness({ resultFor: () => failure() });
    runtimes.push(harness.runtime);

    expect(harness.runtime.runSync(harness.service.start())).toBe(true);
    await flush(harness.runtime);
    expect(harness.clock.delays[0]).toBe(180_000);

    await harness.clock.advance(180_000);
    await flush(harness.runtime);
    expect(harness.clock.delays[1]).toBe(360_000);
  });

  it("stops and expires the session on a 401 without publishing other feeds", async () => {
    const harness = createHarness({
      resultFor: (path) => path === "/todo" ? failure(401) : success({ data: [] }),
    });
    runtimes.push(harness.runtime);

    harness.runtime.runSync(harness.service.start());
    await flush(harness.runtime);

    expect(harness.unauthorizedCalls).toBe(1);
    expect(harness.status).toBe("session-expired");
    expect(harness.accountId).toBeNull();
    expect(harness.runtime.runSync(harness.service.isRunning())).toBe(false);
    expect(harness.writes).toHaveLength(0);
  });

  it("interrupts pending reads and clears the session fiber", async () => {
    const harness = createHarness({ pending: true });
    runtimes.push(harness.runtime);

    harness.runtime.runSync(harness.service.start());
    await flush(harness.runtime);
    expect(harness.calls).toHaveLength(6);

    await harness.runtime.runPromise(harness.service.stop());
    await flush(harness.runtime);

    expect(harness.abortedReads).toBe(6);
    expect(harness.runtime.runSync(harness.service.isRunning())).toBe(false);
    expect(harness.writes).toHaveLength(0);
  });

  it("interrupts the session fiber when the managed application scope shuts down", async () => {
    const harness = createHarness({ pending: true });
    runtimes.push(harness.runtime);

    harness.runtime.runSync(harness.service.start());
    await flush(harness.runtime);
    expect(harness.calls).toHaveLength(6);

    await harness.runtime.shutdown();

    expect(harness.abortedReads).toBe(6);
  });

  it("rejects late results from an old generation before they reach the cache", async () => {
    const harness = createHarness({ pending: true });
    runtimes.push(harness.runtime);

    const oldTick = harness.runtime.runPromise(harness.service.tick());
    await flush(harness.runtime);
    expect(harness.calls).toHaveLength(6);

    harness.runtime.runSync(harness.service.stop());
    for (const resolve of harness.pendingResolvers) resolve(success({ data: [] }));

    await expect(oldTick).resolves.toMatchObject({ kind: "stopped" });
    expect(harness.writes).toHaveLength(0);
  });

  it("aligns a successful tick to a future Presence opening", async () => {
    const clock = createTestClock(1_000_000);
    // Presence alignment keeps the production 60-second minimum while
    // moving the next tick ahead of the regular 90-second cadence.
    const opening = new Date(1_063_000).toISOString();
    const closing = new Date(3_000_000).toISOString();
    const notificationCalls: string[] = [];
    const harness = createHarness({
      clock,
      notifications: {
        handleTaskSync: () => Effect.sync(() => {
          notificationCalls.push("task");
          return null;
        }),
        handlePresenceSync: () => Effect.sync(() => {
          notificationCalls.push("presence");
          return [];
        }),
      },
      bodyFor: (path) => path === "/course/agenda"
        ? [{ id: 501, start_at: opening, end_at: closing }]
        : { data: [] },
    });
    runtimes.push(harness.runtime);

    harness.runtime.runSync(harness.service.start());
    await flush(harness.runtime);

    expect(harness.clock.delays[0]).toBe(64_500);
    expect(notificationCalls).toEqual(["task", "presence"]);
  });
});
