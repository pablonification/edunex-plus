import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { ApiResult, EdunexApi } from "../api/client";
import { createSnapshotCache } from "./snapshot-cache";
import { createSyncEngine } from "./sync-engine";
import { createTaskNotifier } from "../notifications/task-notifier";
import { createRecordingSink } from "../notifications/sinks";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function tempRoot(prefix: string) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  roots.push(root);
  return root;
}

function todoWith(ids: number[]) {
  return {
    tasks: ids.map((id) => ({
      type: "task",
      code: "II4091",
      course: "Final Project Proposal",
      name: `Task ${id}`,
      time: "2026-09-14T23:59:00.000Z",
      id,
    })),
    exams: [],
    questions: [],
    modules: [],
  };
}

function success(body: unknown): ApiResult {
  return { status: 200, ok: true, body };
}

describe("sync + notification spine (network-boundary seam)", () => {
  it("emits OS + in-app sink notifications for a new task id via fake API in, fake sinks out", async () => {
    const cacheRoot = tempRoot("edunex-sync-cache-");
    const ledgerRoot = tempRoot("edunex-sync-ledger-");
    let todoIds = [113986];
    const api: EdunexApi = {
      get: vi.fn(async (path: string) => {
        if (path === "/todo") return success(todoWith(todoIds));
        return success({ meta: {}, data: [] });
      }),
    };
    const osSink = createRecordingSink();
    const appSink = createRecordingSink();
    const notifier = createTaskNotifier({
      ledgerRoot,
      sinks: [osSink, appSink],
      now: () => Date.parse("2026-09-13T12:00:00.000Z"),
    });
    const engine = createSyncEngine({
      api,
      cache: createSnapshotCache(cacheRoot),
      getAccountId: () => "190136",
      taskNotifier: notifier,
    });

    // First sync baselines silently — no backlog replay.
    await engine.tick();
    expect(osSink.shown).toHaveLength(0);
    expect(appSink.shown).toHaveLength(0);

    // A new task id appears in the next synced feed.
    todoIds = [113986, 113987];
    await engine.tick();

    expect(osSink.shown).toHaveLength(1);
    expect(osSink.shown[0].kind).toBe("single");
    expect(osSink.shown[0].taskIds).toEqual(["113987"]);
    expect(appSink.shown).toHaveLength(1);
    expect(appSink.shown[0].taskIds).toEqual(["113987"]);
  });

  it("coalesces a tick burst into one digest and stays silent across restarts", async () => {
    const cacheRoot = tempRoot("edunex-sync-cache-");
    const ledgerRoot = tempRoot("edunex-sync-ledger-");
    let todoIds = [1];
    const api: EdunexApi = {
      get: vi.fn(async (path: string) => {
        if (path === "/todo") return success(todoWith(todoIds));
        return success({ meta: {}, data: [] });
      }),
    };
    const sink = createRecordingSink();
    const engine = createSyncEngine({
      api,
      cache: createSnapshotCache(cacheRoot),
      getAccountId: () => "190136",
      taskNotifier: createTaskNotifier({ ledgerRoot, sinks: [sink] }),
    });

    await engine.tick();
    todoIds = [1, 2, 3, 4];
    await engine.tick();

    expect(sink.shown).toHaveLength(1);
    expect(sink.shown[0].kind).toBe("digest");
    expect(sink.shown[0].taskIds).toEqual(["2", "3", "4"]);

    // Restart with a wiped cache but the same persisted ledger: the same
    // feed must stay silent, proving the ledger (not the cache) prevents
    // replay. A new cache root simulates the wipe; the ledger root survives.
    const wipedCacheRoot = tempRoot("edunex-sync-cache-wiped-");
    const restartSink = createRecordingSink();
    const restartEngine = createSyncEngine({
      api,
      cache: createSnapshotCache(wipedCacheRoot),
      getAccountId: () => "190136",
      taskNotifier: createTaskNotifier({ ledgerRoot, sinks: [restartSink] }),
    });
    // First tick on the wiped cache re-baselines nothing: the ledger already
    // knows every id, so even with no cache diff there is no replay...
    await restartEngine.tick();
    expect(restartSink.shown).toHaveLength(0);

    // ...and a genuinely new id after the restart still notifies.
    todoIds = [1, 2, 3, 4, 5];
    await restartEngine.tick();
    expect(restartSink.shown).toHaveLength(1);
    expect(restartSink.shown[0].taskIds).toEqual(["5"]);
  });
});
