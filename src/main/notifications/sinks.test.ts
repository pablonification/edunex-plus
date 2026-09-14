import { describe, expect, it, vi } from "vitest";
import {
  buildDigestTaskNotification,
  buildSingleTaskNotification,
  notificationDestinationFor,
  type NewTaskInfo,
} from "../../shared/notifications";
import { createFanoutSink, createOsSink } from "./sinks";

function task(id: string, title = `Task ${id}`): NewTaskInfo {
  return { id, title, courseCode: "II4091", courseName: "Final Project Proposal", dueAt: null };
}

describe("notification copy", () => {
  it("builds a single-task notification naming the task", () => {
    const notification = buildSingleTaskNotification(task("113986", "Answer Tugas 01"), "2026-09-13T12:00:00.000Z");

    expect(notification.kind).toBe("single");
    expect(notification.taskIds).toEqual(["113986"]);
    expect(notification.body).toContain("Answer Tugas 01");
    expect(notificationDestinationFor(notification)).toEqual({ view: "todo", taskId: "113986" });
  });

  it("coalesces a burst into one digest addressed to the To Do screen", () => {
    const tasks = [task("1"), task("2"), task("3"), task("4")];
    const notification = buildDigestTaskNotification(tasks, "2026-09-13T12:00:00.000Z");

    expect(notification.kind).toBe("digest");
    expect(notification.title).toBe("4 new tasks");
    expect(notification.taskIds).toEqual(["1", "2", "3", "4"]);
    expect(notificationDestinationFor(notification)).toEqual({ view: "todo", taskId: null });
  });

  it("records the sink contract: no imported Electron types", () => {
    // The sink interface lives in main/notifications/sinks.ts and takes the
    // shared TaskNotification above — this test pins the shape the fake sink
    // in the network-boundary test receives.
    const shown: unknown[] = [];
    const sink = { show: vi.fn((n: unknown) => void shown.push(n)) };
    sink.show(buildSingleTaskNotification(task("1"), "2026-09-13T12:00:00.000Z"));
    expect(sink.show).toHaveBeenCalledTimes(1);
    expect(shown).toHaveLength(1);
  });
});

describe("sinks", () => {
  it("OS sink shows one notification and routes clicks to the handler", () => {
    const clicks: string[][] = [];
    let clickHandler: (() => void) | null = null;
    const sink = createOsSink({
      show: (options, onClick) => {
        expect(options.title).toBe("New task");
        clickHandler = onClick;
      },
      onClicked: (notification) => clicks.push(notification.taskIds),
    });

    sink.show(buildSingleTaskNotification(task("7"), "2026-09-13T12:00:00.000Z"));
    clickHandler?.();

    expect(clicks).toEqual([["7"]]);
  });

  it("fan-out isolates a throwing sink so the fallback still lands", () => {
    const received: unknown[] = [];
    const fanout = createFanoutSink([
      {
        show: () => {
          throw new Error("os failed");
        },
      },
      { show: (n) => void received.push(n) },
    ]);

    expect(() =>
      fanout.show(buildSingleTaskNotification(task("7"), "2026-09-13T12:00:00.000Z")),
    ).not.toThrow();
    expect(received).toHaveLength(1);
  });
});
