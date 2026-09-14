import { Effect, Layer } from "effect";
import { afterEach, describe, expect, it } from "vitest";
import { createApplicationRuntime } from "../effect/runtime";
import {
  Clock,
  FileSystem,
  Path,
  Random,
  type FileSystemService,
  type PathService,
} from "../platform/services";
import {
  SnapshotCacheService,
  createSnapshotCacheLayer,
} from "./snapshot-cache";

const runtimes: Array<ReturnType<typeof createApplicationRuntime>> = [];

afterEach(async () => {
  await Promise.all(runtimes.splice(0).map((runtime) => runtime.shutdown()));
});

function harness() {
  const files = new Map<string, string>();
  const writes: Array<{ path: string; nonce?: string }> = [];
  const fileSystem: FileSystemService = {
    readText: (filePath) => {
      const value = files.get(filePath);
      if (value === undefined) throw new Error("missing");
      return value;
    },
    readBytes: (filePath) => new TextEncoder().encode(files.get(filePath) ?? ""),
    writeText: (filePath, contents) => files.set(filePath, contents),
    writeBytes: (filePath, contents) =>
      files.set(filePath, new TextDecoder().decode(contents)),
    exists: (filePath) => files.has(filePath),
    remove: (filePath) => {
      files.delete(filePath);
    },
    atomicWrite: (filePath, contents, nonce) => {
      writes.push({ path: filePath, nonce });
      files.set(filePath, contents);
    },
  };
  const path: PathService = {
    join: (...parts) => parts.join("/"),
    dirname: (filePath) => filePath.split("/").slice(0, -1).join("/"),
  };
  const runtime = createApplicationRuntime(
    createSnapshotCacheLayer({ rootDir: "feed-snapshots" }).pipe(
      Layer.provide(
        Layer.mergeAll(
          Layer.succeed(FileSystem, fileSystem),
          Layer.succeed(Path, path),
          Layer.succeed(Clock, {
            now: () => 1_700_000_000_000,
            setTimeout: () => 0,
            clearTimeout: () => undefined,
          }),
          Layer.succeed(Random, { next: () => 0.5 }),
        ),
      ),
    ),
  );
  runtimes.push(runtime);
  return {
    runtime,
    service: runtime.runSync(Effect.service(SnapshotCacheService)),
    files,
    writes,
  };
}

describe("Effect snapshot cache service", () => {
  it("retains the versioned raw snapshot and persists atomically", async () => {
    const h = harness();
    const data = {
      tasks: [{ id: 113986, name: "Answer Tugas 01", vendorFlag: "keep-me" }],
      exams: [],
      questions: [],
      modules: [],
    };

    const written = h.runtime.runSync(
      h.service.write("190136", "todo", data, "2026-09-13T12:00:00.000Z"),
    );
    const read = h.runtime.runSync(h.service.read("190136", "todo"));

    expect(read).toEqual(written);
    expect(JSON.parse(h.files.get("feed-snapshots/190136/todo.json")!)).toEqual({
      version: 1,
      ...written,
    });
    expect(h.writes).toEqual([
      { path: "feed-snapshots/190136/todo.json", nonce: "1700000000000-0.5" },
    ]);
  });

  it("returns null for missing and corrupt snapshots without failing the Effect", async () => {
    const h = harness();

    expect(h.runtime.runSync(h.service.read("190136", "todo"))).toBeNull();

    h.files.set("feed-snapshots/190136/todo.json", "not-json");
    expect(h.runtime.runSync(h.service.get("190136", "todo"))).toBeNull();

    h.files.set(
      "feed-snapshots/190136/todo.json",
      JSON.stringify({ version: 99, feed: "todo", accountId: "190136", data: {} }),
    );
    expect(h.runtime.runSync(h.service.read("190136", "todo"))).toBeNull();
  });
});
