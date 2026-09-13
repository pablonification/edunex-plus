import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createSnapshotCache } from "./snapshot-cache";

const todo = {
  tasks: [
    {
      type: "task",
      code: "II4091",
      course: "Final Project Proposal",
      name: "Answer Tugas 01",
      time: "2026-09-14T23:59:00.000Z",
      id: 113986,
      taskable_id: 450219,
    },
  ],
  exams: [],
  questions: [],
  modules: [],
};

const cacheRoots: string[] = [];

afterEach(() => {
  for (const root of cacheRoots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});
function tempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "edunex-snapshots-"));
  cacheRoots.push(root);
  return root;
}

describe("snapshot cache", () => {
  it("persists a feed snapshot so a later process can read it offline", () => {
    const root = tempRoot();
    const fetchedAt = "2026-09-13T12:00:00.000Z";

    const firstProcess = createSnapshotCache(root);
    const written = firstProcess.write("190136", "todo", todo, fetchedAt);

    const secondProcess = createSnapshotCache(root);

    expect(written).toEqual({
      feed: "todo",
      accountId: "190136",
      fetchedAt,
      data: todo,
    });
    expect(secondProcess.read("190136", "todo")).toEqual(written);
  });

  it("keeps snapshots isolated by account and feed", () => {
    const cache = createSnapshotCache(tempRoot());
    cache.write("190136", "todo", todo, "2026-09-13T12:00:00.000Z");
    cache.write("187138", "todo", { tasks: [] }, "2026-09-13T12:01:00.000Z");
    cache.write("190136", "courses", { data: [] }, "2026-09-13T12:02:00.000Z");

    expect(cache.read("190136", "todo")?.data).toEqual(todo);
    expect(cache.read("187138", "todo")?.data).toEqual({ tasks: [] });
    expect(cache.read("190136", "courses")?.data).toEqual({ data: [] });
    expect(cache.read("187138", "courses")).toBeNull();
  });

  it("ignores a missing or malformed snapshot", () => {
    const root = tempRoot();
    const cache = createSnapshotCache(root);

    expect(cache.read("190136", "todo")).toBeNull();

    fs.mkdirSync(path.join(root, "190136"), { recursive: true });
    fs.writeFileSync(path.join(root, "190136", "todo.json"), "not json");

    expect(cache.read("190136", "todo")).toBeNull();
  });
});
