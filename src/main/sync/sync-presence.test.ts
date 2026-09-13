import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ApiResult, EdunexApi } from "../api/client";
import { createSnapshotCache } from "./snapshot-cache";
import { createSyncEngine } from "./sync-engine";
import { createPresenceNotifier } from "../notifications/presence-notifier";
import { createRecordingSink } from "../notifications/sinks";
import type { OutboundNotification } from "../../shared/notifications";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function tempRoot(prefix: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  roots.push(root);
  return root;
}

function success(body: unknown): ApiResult {
  return { status: 200, ok: true, body };
}

const EMPTY_TODO = { tasks: [], exams: [], questions: [], modules: [] };

function meeting(id: number, startMs: number, endMs: number) {
  return {
    id,
    type: "offline",
    course_code: "II4091",
    course_name: "Final Project Proposal",
    name: `Week ${id}`,
    start_at: new Date(startMs).toISOString(),
    end_at: new Date(endMs).toISOString(),
  };
}

function presenceOf(sink: { shown: OutboundNotification[] }) {
  return sink.shown.filter((n) => n.kind === "presence");
}

describe("sync + presence-open alerts (network-boundary seam)", () => {
  it("alerts immediately on the tick that finds an open window — never coalesced", async () => {
    const cacheRoot = tempRoot("edunex-presence-cache-");
    const ledgerRoot = tempRoot("edunex-presence-ledger-");
    let nowMs = Date.parse("2026-09-16T07:00:00.000Z");
    let agenda: unknown[] = [];
    const api: EdunexApi = {
      get: vi.fn(async (route: string) => {
        if (route === "/todo") return success(EMPTY_TODO);
        if (route === "/course/agenda") return success(agenda);
        return success({ meta: {}, data: [] });
      }),
    };
    const osSink = createRecordingSink();
    const appSink = createRecordingSink();
    const engine = createSyncEngine({
      api,
      cache: createSnapshotCache(cacheRoot),
      getAccountId: () => "190136",
      presenceNotifier: createPresenceNotifier({
        ledgerRoot,
        sinks: [osSink, appSink],
        now: () => nowMs,
      }),
      now: () => nowMs,
    });

    // Closed agenda: silent.
    await engine.tick();
    expect(presenceOf(osSink)).toHaveLength(0);

    // Two windows open on the same tick: one immediate alert each.
    agenda = [
      meeting(501, nowMs - 60_000, nowMs + 3_600_000),
      meeting(502, nowMs - 30_000, nowMs + 3_600_000),
    ];
    await engine.tick();

    expect(presenceOf(osSink)).toHaveLength(2);
    expect(presenceOf(appSink)).toHaveLength(2);
    expect(osSink.shown[0]).toMatchObject({ kind: "presence", presenceIds: ["501"] });

    // Still open on the next tick: no "closing soon" reminder.
    nowMs += 60_000;
    await engine.tick();
    expect(presenceOf(osSink)).toHaveLength(2);
  });

  it("catches a window opening between ticks at the next tick", async () => {
    const cacheRoot = tempRoot("edunex-presence-cache-");
    const ledgerRoot = tempRoot("edunex-presence-ledger-");
    const t0 = Date.parse("2026-09-16T07:00:00.000Z");
    let nowMs = t0;
    // Window opens 30s after the first tick.
    const agenda = [meeting(501, t0 + 30_000, t0 + 3_630_000)];
    const api: EdunexApi = {
      get: vi.fn(async (route: string) => {
        if (route === "/todo") return success(EMPTY_TODO);
        if (route === "/course/agenda") return success(agenda);
        return success({ meta: {}, data: [] });
      }),
    };
    const sink = createRecordingSink();
    const engine = createSyncEngine({
      api,
      cache: createSnapshotCache(cacheRoot),
      getAccountId: () => "190136",
      presenceNotifier: createPresenceNotifier({ ledgerRoot, sinks: [sink], now: () => nowMs }),
      now: () => nowMs,
    });

    await engine.tick();
    expect(presenceOf(sink)).toHaveLength(0);

    nowMs = t0 + 31_000;
    await engine.tick();
    expect(presenceOf(sink)).toHaveLength(1);
    expect(sink.shown[0]).toMatchObject({ kind: "presence", presenceIds: ["501"] });
  });

  it("event-aligns the scheduled tick to a future opening instead of the regular cadence", async () => {
    const cacheRoot = tempRoot("edunex-presence-cache-");
    const ledgerRoot = tempRoot("edunex-presence-ledger-");
    const t0 = Date.parse("2026-09-16T07:00:00.000Z");
    const agenda = [meeting(501, t0 + 3_000, t0 + 3_603_000)];
    const api: EdunexApi = {
      get: vi.fn(async (route: string) => {
        if (route === "/todo") return success(EMPTY_TODO);
        if (route === "/course/agenda") return success(agenda);
        return success({ meta: {}, data: [] });
      }),
    };
    const scheduled: number[] = [];
    const engine = createSyncEngine({
      api,
      cache: createSnapshotCache(cacheRoot),
      getAccountId: () => "190136",
      presenceNotifier: createPresenceNotifier({ ledgerRoot, sinks: [createRecordingSink()] }),
      now: () => t0,
      random: () => 0.5,
      intervalMs: 10_000,
      jitterMs: 0,
      // Test-scale floor so the 4.5s aligned delay is observable; production
      // keeps the 60s courtesy floor (aligned delays clamp to it there).
      minIntervalMs: 1_000,
      setTimer: ((callback: () => void, delayMs: number) => {
        scheduled.push(delayMs);
        void callback;
        return 0 as unknown as ReturnType<typeof setTimeout>;
      }) as typeof setTimeout,
      clearTimer: (() => undefined) as unknown as typeof clearTimeout,
    });

    engine.start();
    await new Promise((resolve) => setTimeout(resolve, 25));
    engine.stop();

    // Opening at +3s with the 1.5s grace → 4.5s, beating the 10s regular tick.
    expect(scheduled).toHaveLength(1);
    expect(scheduled[0]).toBe(4_500);
  });
});
