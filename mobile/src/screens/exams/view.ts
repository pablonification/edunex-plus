// Ujian's list (/exams): every exam of the term out of Tugas's own list (todoList and doneList, src/core/todo.ts), so
// an exam says the same thing in both places. No React here, tested in Node (test/mobile/exams-view.test.ts). The
// nearest one leads; the rest sit by ITB's exam period where the calendar gives one ("Masa UTS 12–16 Okt"), else by
// Tugas's own weeks (todoGroup); exams with no date yet come last; the ones behind fold under "Sudah lewat".
import type { Exam } from "../../../../src/core/exams";
import type { CalendarEvent } from "../../../../src/core/models";
import { type PastExam, type TodoGroup, type TodoItem, todoGroup } from "../../../../src/core/todo";

export type ExamItem = Extract<TodoItem, { kind: "exam" }>;

/** Where a group of rows sits: ITB's exam period, or one of Tugas's weeks. */
export type GroupTitle = { period: CalendarEvent; examKind: "UTS" | "UAS" } | { group: TodoGroup };

export interface ExamsView {
  /** The nearest exam still ahead with a day: the one thing the page leads with. */
  lead: ExamItem | null;
  groups: { key: string; title: GroupTitle; items: ExamItem[] }[];
  /** No system gives these a day yet (an exam period's, or with nothing at all). */
  undated: Exam[];
  past: PastExam[];
}

/** The exam period an item's moment falls in, when its exam has one. */
function periodOf(item: ExamItem): { period: CalendarEvent; examKind: "UTS" | "UAS" } | null {
  const { exam, at } = item;
  if (!exam.week || at === null || (exam.kind !== "UTS" && exam.kind !== "UAS")) return null;
  return at >= exam.week.start && at < exam.week.end ? { period: exam.week, examKind: exam.kind } : null;
}

/** `items`: todoList's rows (Tasks, if any, are left out); `past`: doneList's past exams. */
export function examsView(items: readonly TodoItem[], past: readonly PastExam[], now: number): ExamsView {
  const dated: ExamItem[] = [];
  const undated: Exam[] = [];
  for (const item of items) {
    if (item.kind === "period") undated.push(...item.exams);
    else if (item.kind === "exam") {
      if (item.part === null) undated.push(item.exam);
      else dated.push(item);
    }
  }
  // A late take-home is behind its moment: it's listed (under "Terlambat"), it doesn't lead.
  const lead = dated.find((item) => item.at !== null && !item.late) ?? null;
  const groups: ExamsView["groups"] = [];
  for (const item of dated) {
    if (item === lead) continue;
    const period = item.late ? null : periodOf(item);
    const title: GroupTitle = period ?? { group: todoGroup(item, now) };
    const key = "period" in title ? `period:${title.period.id}` : title.group;
    const group = groups.find((one) => one.key === key);
    if (group) group.items.push(item);
    else groups.push({ key, title, items: [item] });
  }
  return { lead, groups, undated: [...new Map(undated.map((exam) => [exam.id, exam])).values()], past: [...past] };
}

/** A line of the page, for FlashList. */
export type ExamLine =
  | { type: "lead"; key: string; item: ExamItem }
  | { type: "heading"; key: string; title: GroupTitle | "undated" | "past"; count: number; first: boolean; fold: "open" | "closed" | null }
  | { type: "row"; key: string; item: ExamItem; last: boolean }
  | { type: "undated"; key: string; exam: Exam; last: boolean }
  | { type: "past"; key: string; past: PastExam; last: boolean };

/** The page as lines. "Sudah lewat" is folded while anything is still ahead (`pastOpen` opens it). */
export function examLines(view: ExamsView, pastOpen: boolean): ExamLine[] {
  const lines: ExamLine[] = [];
  if (view.lead) lines.push({ type: "lead", key: `lead:${view.lead.key}`, item: view.lead });
  for (const group of view.groups) {
    lines.push({ type: "heading", key: `heading:${group.key}`, title: group.title, count: group.items.length, first: lines.length === 0, fold: null });
    group.items.forEach((item, i) => {
      lines.push({ type: "row", key: item.key, item, last: i === group.items.length - 1 });
    });
  }
  if (view.undated.length) {
    lines.push({ type: "heading", key: "heading:undated", title: "undated", count: view.undated.length, first: lines.length === 0, fold: null });
    view.undated.forEach((exam, i) => {
      lines.push({ type: "undated", key: `undated:${exam.id}`, exam, last: i === view.undated.length - 1 });
    });
  }
  if (view.past.length) {
    const foldable = lines.length > 0;
    const open = !foldable || pastOpen;
    lines.push({
      type: "heading",
      key: "heading:past",
      title: "past",
      count: view.past.length,
      first: lines.length === 0,
      fold: foldable ? (open ? "open" : "closed") : null,
    });
    if (open)
      view.past.forEach((one, i) => {
        lines.push({ type: "past", key: `past:${one.exam.id}`, past: one, last: i === view.past.length - 1 });
      });
  }
  return lines;
}

export const examLineType = (line: ExamLine) => line.type;
