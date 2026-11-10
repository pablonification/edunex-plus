// Ujian (/exams): the term's exams out of the Tugas tab's own list (src/core/todo.ts), so both say the same. The next
// sitting or Edunex window still to start is the screen's one big card; the rest follow by date, past ones last.
import type { PastExam, TodoItem } from "../../../../src/core/todo";

export type ExamItem = Extract<TodoItem, { kind: "exam" | "period" }>;
export type NextExam = Extract<TodoItem, { kind: "exam" }> & { part: { kind: "sitting" | "window"; at: number } };

export interface ExamsView {
  /** The next exam with a day and time still ahead: a sitting, or an Edunex window. Not a take-home (that's a Task). */
  next: NextExam | null;
  /** Every other exam row still ahead, in the list's order (by date, an undated one last). */
  rest: ExamItem[];
  past: PastExam[];
}

const isNext = (item: ExamItem, now: number): item is NextExam =>
  item.kind === "exam" && (item.part?.kind === "sitting" || item.part?.kind === "window") && item.part.at > now;

export function examsView(items: readonly TodoItem[], past: readonly PastExam[], now: number): ExamsView {
  const exams = items.filter((item): item is ExamItem => item.kind === "exam" || item.kind === "period");
  const next = exams.find((item): item is NextExam => isNext(item, now)) ?? null;
  return { next, rest: exams.filter((item) => item !== next), past: [...past] };
}
