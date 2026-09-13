import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ACTIVE_COURSES_PATH, type ApiResult, type EdunexApi } from "../api/client";
import { createSnapshotCache } from "./snapshot-cache";
import { createSyncEngine } from "./sync-engine";

const todoFixture = {
  tasks: [
    {
      type: "task",
      code: "II4091",
      course: "Final Project Proposal",
      name: "Answer Tugas 01 Submit Usulan Dosen Pembimbing dan Topik",
      time: "2026-09-14T23:59:00.000Z",
      id: 113986,
      taskable_id: 450219,
    },
  ],
  exams: [],
  questions: [],
  modules: [],
};

const coursesFixture = {
  meta: { page: { limit: 9, offset: 0 } },
  data: [
    {
      type: "course",
      id: "401",
      attributes: {
        code: "II4091",
        name: "Final Project Proposal",
        class_name: "II4091-01",
        semester: 1,
        year: "2026-1",
      },
    },
  ],
};

const agendaFixture = [
  {
    type: "vicon",
    course_name: "Final Project Proposal",
    name: "Week 05 — Online guidance",
    start_at: "2026-09-16T07:00:00.000Z",
    end_at: "2026-09-16T09:00:00.000Z",
    id: 501,
  },
  {
    type: "offline",
    course_name: "Final Project Proposal",
    name: "Week 06 — Studio review",
    start_at: "2026-09-23T07:00:00.000Z",
    end_at: "2026-09-23T09:00:00.000Z",
    id: 502,
  },
];

const cacheRoots: string[] = [];

afterEach(() => {
  vi.useRealTimers();
  for (const root of cacheRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function tempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "edunex-sync-"));
  cacheRoots.push(root);
  return root;
}

function success(body: unknown): ApiResult {
  return { status: 200, ok: true, body };
}

function fakeApi(resultFor: (path: string, callNumber: number) => ApiResult): {
  api: EdunexApi;
  calls: string[];
} {
  const calls: string[] = [];
  const api: EdunexApi = {
    get: vi.fn(async (path: string) => {
      calls.push(path);
      return resultFor(path, calls.length);
    }),
  };
  return { api, calls };
}

function resultForFixture(path: string) {
  if (path === "/todo") return success(todoFixture);
  if (path === ACTIVE_COURSES_PATH) return success(coursesFixture);
  return success(agendaFixture);
}

describe("sync engine", () => {
  it("fetches the feeds at the network seam and persists their raw API shapes", async () => {
    const cache = createSnapshotCache(tempRoot());
    const updates: unknown[] = [];
    const { api, calls } = fakeApi((feedPath) => resultForFixture(feedPath));
    const engine = createSyncEngine({
      api,
      cache,
      getAccountId: () => "190136",
      now: () => Date.parse("2026-09-13T12:00:00.000Z"),
      onFeedUpdated: (snapshot) => updates.push(snapshot),
    });

    const result = await engine.tick();

    expect(result.kind).toBe("success");
    expect(calls).toEqual([
      "/todo",
      ACTIVE_COURSES_PATH,
      "/course/agenda",
    ]);
    expect(cache.read("190136", "todo")?.data).toEqual(todoFixture);
    expect(cache.read("190136", "courses")?.data).toEqual(coursesFixture);
    expect(cache.read("190136", "agenda")?.data).toEqual(agendaFixture);
    expect(updates).toHaveLength(3);
  });

  it("runs one immediate main-process tick, then uses 90s ± 30s cadence", async () => {
    vi.useFakeTimers();
    const { api, calls } = fakeApi((feedPath) => resultForFixture(feedPath));
    const engine = createSyncEngine({
      api,
      cache: createSnapshotCache(tempRoot()),
      getAccountId: () => "190136",
      random: () => 0.5,
    });

    expect(engine.start()).toBe(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toHaveLength(3);

    await vi.advanceTimersByTimeAsync(89_999);
    expect(calls).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toHaveLength(6);

    engine.stop();
  });

  it("backs off exponentially after a failed tick while keeping the 60s floor", async () => {
    vi.useFakeTimers();
    const { api, calls } = fakeApi((_feedPath, callNumber) =>
      callNumber <= 2 ? { status: 503, ok: false, body: null } : success(todoFixture),
    );
    const engine = createSyncEngine({
      api,
      cache: createSnapshotCache(tempRoot()),
      getAccountId: () => "190136",
      random: () => 0,
    });

    engine.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(calls).toHaveLength(3);

    // With the production 90s base, the first failure waits 180s. It must
    // not retry at the jittered 60s lower bound.
    await vi.advanceTimersByTimeAsync(179_999);
    expect(calls).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(calls).toHaveLength(6);

    engine.stop();
  });

  it("pauses without another request when a feed returns 401", async () => {
    vi.useFakeTimers();
    const onUnauthorized = vi.fn();
    const { api, calls } = fakeApi(() => ({ status: 401, ok: false, body: null }));
    const engine = createSyncEngine({
      api,
      cache: createSnapshotCache(tempRoot()),
      getAccountId: () => "190136",
      onUnauthorized,
    });

    engine.start();
    await vi.advanceTimersByTimeAsync(0);

    expect(engine.isRunning()).toBe(false);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(900_000);
    expect(calls).toHaveLength(3);
  });

  it("serves the last snapshot offline without asking the API", () => {
    const cache = createSnapshotCache(tempRoot());
    const saved = cache.write("190136", "todo", todoFixture, "2026-09-13T12:00:00.000Z");
    const api: EdunexApi = {
      get: vi.fn(async () => {
        throw new Error("network must not be used for an offline read");
      }),
    };
    const engine = createSyncEngine({ api, cache, getAccountId: () => "190136" });

    expect(engine.read("todo")).toEqual(saved);
    expect(api.get).not.toHaveBeenCalled();
  });
});
