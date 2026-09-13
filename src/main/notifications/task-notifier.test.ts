import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createTaskNotifier } from "./task-notifier";
import { createRecordingSink } from "./sinks";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true });
});

function tempRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "edunex-notifier-"));
  roots.push(root);
  return root;
}

function todoWith(ids: number[]) {
  return {
    tasks: ids.map((id) => ({
      id,
      name: `Task ${id}`,
      code: "II4091",
      course: "Final Project Proposal",
      time: "2026-09-14T23:59:00.000Z",
    })),
    exams: [],
  };
}

const NOW = Date.parse("2026-09-13T12:00:00.000Z");

describe("task notifier", () => {
  it("keeps the first sync silent and baselines the ledger (no backlog replay)", () => {
    const root = tempRoot();
    const osSink = createRecordingSink();
    const appSink = createRecordingSink();
    const notifier = createTaskNotifier({
      ledgerRoot: root,
      sinks: [osSink, appSink],
      now: () => NOW,
    });

    const emitted = notifier.handleSync("190136", null, todoWith([113986]));

    expect(emitted).toBeNull();
    expect(osSink.shown).toHaveLength(0);
    expect(appSink.shown).toHaveLength(0);
  });

  it("emits one single notification to every sink for one new task id", () => {
    const root = tempRoot();
    const osSink = createRecordingSink();
    const appSink = createRecordingSink();
    const notifier = createTaskNotifier({
      ledgerRoot: root,
      sinks: [osSink, appSink],
      now: () => NOW,
    });

    notifier.handleSync("190136", null, todoWith([113986]));
    const emitted = notifier.handleSync("190136", todoWith([113986]), todoWith([113986, 113987]));

    expect(emitted?.kind).toBe("single");
    expect(emitted?.taskIds).toEqual(["113987"]);
    expect(osSink.shown).toHaveLength(1);
    expect(appSink.shown).toHaveLength(1);
  });

  it("coalesces N new items in one tick into a single digest", () => {
    const root = tempRoot();
    const sink = createRecordingSink();
    const notifier = createTaskNotifier({ ledgerRoot: root, sinks: [sink], now: () => NOW });

    notifier.handleSync("190136", null, todoWith([1]));
    const emitted = notifier.handleSync("190136", todoWith([1]), todoWith([1, 2, 3, 4]));

    expect(emitted?.kind).toBe("digest");
    expect(emitted?.taskIds).toEqual(["2", "3", "4"]);
    expect(sink.shown).toHaveLength(1);
    expect(sink.shown[0].title).toBe("3 new tasks");
  });

  it("never re-notifies the same task across restarts (persisted ledger)", () => {
    const root = tempRoot();
    const firstSink = createRecordingSink();
    const first = createTaskNotifier({ ledgerRoot: root, sinks: [firstSink], now: () => NOW });
    first.handleSync("190136", null, todoWith([113986]));
    first.handleSync("190136", todoWith([113986]), todoWith([113986, 113987]));
    expect(firstSink.shown).toHaveLength(1);

    // Simulate an app restart: new notifier, empty cache (prev null).
    const secondSink = createRecordingSink();
    const second = createTaskNotifier({ ledgerRoot: root, sinks: [secondSink], now: () => NOW });
    const emitted = second.handleSync("190136", null, todoWith([113986, 113987]));

    expect(emitted).toBeNull();
    expect(secondSink.shown).toHaveLength(0);
  });
});
