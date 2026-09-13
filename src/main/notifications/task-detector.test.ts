import { describe, expect, it } from "vitest";
import { diffNewTasks, extractTodoTasks } from "./task-detector";

const prevFixture = {
  tasks: [
    { id: 113986, name: "Answer Tugas 01", code: "II4091", course: "Final Project Proposal", time: "2026-09-14T23:59:00.000Z" },
  ],
  exams: [],
};

const nextFixture = {
  tasks: [
    { id: 113986, name: "Answer Tugas 01", code: "II4091", course: "Final Project Proposal", time: "2026-09-14T23:59:00.000Z" },
    { id: 113987, name: "Answer Tugas 02", code: "II4091", course: "Final Project Proposal", time: "2026-09-21T23:59:00.000Z" },
  ],
  exams: [],
};

describe("task detector", () => {
  it("extracts pending tasks in feed order with string ids", () => {
    expect(extractTodoTasks(nextFixture).map((task) => task.id)).toEqual(["113986", "113987"]);
    expect(extractTodoTasks(nextFixture)[1]).toMatchObject({
      title: "Answer Tugas 02",
      courseCode: "II4091",
      dueAt: "2026-09-21T23:59:00.000Z",
    });
  });

  it("diffs a newly appearing task id against the cache snapshot", () => {
    expect(diffNewTasks(prevFixture, nextFixture, new Set()).map((task) => task.id)).toEqual([
      "113987",
    ]);
  });

  it("emits nothing when the feed is unchanged", () => {
    expect(diffNewTasks(prevFixture, prevFixture, new Set())).toEqual([]);
  });

  it("filters ids the persisted ledger already knows (no replay after a cache wipe)", () => {
    expect(
      diffNewTasks(null, nextFixture, new Set(["113986", "113987"])),
    ).toEqual([]);
    expect(diffNewTasks(null, nextFixture, new Set(["113986"])).map((t) => t.id)).toEqual([
      "113987",
    ]);
  });

  it("skips rows without a stable vendor id instead of inventing positional ones", () => {
    const next = { tasks: [{ name: "Nameless task", code: "II4091" }], exams: [] };
    expect(extractTodoTasks(next)).toEqual([]);
    expect(diffNewTasks(prevFixture, next, new Set())).toEqual([]);
  });
});
