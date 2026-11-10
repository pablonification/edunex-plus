// Ujian's list (mobile/src/screens/exams/view.ts): Tugas's own exam rows (todoList, doneList) as one page.
import { describe, expect, it } from "vitest";
import { examLines, examsView } from "../../mobile/src/screens/exams/view";
import type { Exam } from "../../src/core/exams";
import type { PastExam, TodoItem } from "../../src/core/todo";

const NOW = Date.UTC(2026, 9, 5, 3);
const DAY = 24 * 3_600_000;
const week = { id: "uts", start: NOW + 7 * DAY, end: NOW + 12 * DAY } as never;

const exam = (id: string, kind: Exam["kind"], more: Partial<Exam> = {}) =>
  ({
    id,
    courseCode: id.split("-")[0],
    kind,
    six: [],
    edunex: [],
    tasks: [],
    inOutline: false,
    week: null,
    at: null,
    disagree: false,
    takeHomeApart: null,
    ...more,
  }) as Exam;

const row = (of: Exam, at: number | null, more: object = {}): TodoItem =>
  ({
    kind: "exam",
    key: `exam:${of.id}`,
    at,
    course: of.courseCode,
    exam: of,
    part: at === null ? null : { kind: "sitting", id: "s", at },
    late: false,
    ...more,
  }) as TodoItem;

describe("Ujian", () => {
  const quiz = exam("PL3002-KUIS", "KUIS");
  const uts1 = exam("DK4073-UTS", "UTS", { week });
  const uts2 = exam("II4091-UTS", "UTS", { week });
  const late = exam("MS2111-UTS", "UTS");
  const unknown = exam("FI1101-UJIAN", "UJIAN");
  const waiting = exam("KU1202-UTS", "UTS", { week });
  const items: TodoItem[] = [
    row(late, NOW - DAY, { late: true, part: { kind: "takehome", id: "t", at: NOW - DAY } }),
    row(quiz, NOW + 2 * DAY),
    row(uts1, NOW + 8 * DAY),
    row(uts2, NOW + 9 * DAY),
    { kind: "task", key: "task:1", at: NOW + DAY, course: "PL3002" } as never,
    { kind: "period", key: "period:uts", at: week.start, course: null, examKind: "UTS", week, exams: [waiting], state: "near" } as never,
    row(unknown, null),
  ];
  const past: PastExam[] = [{ exam: exam("TI2001-KUIS", "KUIS"), at: NOW - 20 * DAY, marks: [] }];

  it("leads with the nearest exam still ahead, never a late take-home or a Task", () => {
    expect(examsView(items, past, NOW).lead?.exam.id).toBe("PL3002-KUIS");
  });

  it("groups the rest by ITB's exam period where there is one, else by Tugas's weeks", () => {
    const view = examsView(items, past, NOW);
    expect(view.groups.map((group) => [group.key, group.items.map((item) => item.exam.id)])).toEqual([
      ["overdue", ["MS2111-UTS"]],
      ["period:uts", ["DK4073-UTS", "II4091-UTS"]],
    ]);
  });

  it("puts exams with no day yet last, an exam period's and the ones with nothing", () => {
    expect(examsView(items, past, NOW).undated.map((one) => one.id)).toEqual(["KU1202-UTS", "FI1101-UJIAN"]);
  });

  it("folds past exams while something is ahead, and shows them when they're all there is", () => {
    const view = examsView(items, past, NOW);
    const closed = examLines(view, false);
    expect(closed[0]).toMatchObject({ type: "lead" });
    expect(closed.at(-1)).toMatchObject({ type: "heading", title: "past", fold: "closed", count: 1 });
    expect(examLines(view, true).at(-1)).toMatchObject({ type: "past" });
    expect(new Set(closed.map((line) => line.key)).size).toBe(closed.length);
    const only = examLines(examsView([], past, NOW), false);
    expect(only.map((line) => line.type)).toEqual(["heading", "past"]);
    expect(only[0]).toMatchObject({ fold: null, first: true });
  });

  it("has nothing to show for a term with no exams", () => {
    expect(examLines(examsView([], [], NOW), false)).toEqual([]);
  });
});
