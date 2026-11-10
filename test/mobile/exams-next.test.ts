// Ujian (/exams): the next sitting or Edunex window still to start is the one big card; the rest keep the Tugas list's
// order (mobile/src/screens/exams/next.ts).
import { describe, expect, it } from "vitest";
import { examsView } from "../../mobile/src/screens/exams/next";
import type { PastExam, TodoItem } from "../../src/core/todo";

const now = 1_000_000;
const exam = (key: string, part: unknown, at: number | null) =>
  ({ kind: "exam", key, at, course: "AA1001", exam: { id: key }, part, late: false }) as unknown as TodoItem;
const task = { kind: "task", key: "task:1", at: now + 5 } as unknown as TodoItem;

describe("examsView", () => {
  it("skips a take-home, an exam going on now and Tasks for the big card", () => {
    const takeHome = exam("t", { kind: "takehome", at: now + 10 }, now + 10);
    const going = exam("g", { kind: "sitting", at: now - 10, end: now + 100 }, now - 10);
    const next = exam("n", { kind: "sitting", at: now + 20, end: null }, now + 20);
    const later = exam("l", { kind: "window", at: now + 30 }, now + 30);
    const view = examsView([going, task, takeHome, next, later], [], now);
    expect(view.next?.key).toBe("n");
    expect(view.rest.map((item) => item.key)).toEqual(["g", "t", "l"]);
  });

  it("no big card when nothing has a day ahead; past exams kept", () => {
    const past = [{ exam: { id: "p" } }] as unknown as PastExam[];
    const view = examsView([exam("u", null, null)], past, now);
    expect(view.next).toBeNull();
    expect(view.rest).toHaveLength(1);
    expect(view.past).toHaveLength(1);
  });
});
