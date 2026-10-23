// Tugas & Ujian as one list, in order: everything still ahead of the Student
// (Tasks, take-home exams, exam sittings, Edunex exam windows) at the moment
// each runs out, grouped by WIB week, and one quiet line for each exam period
// whose exams have no day yet. An exam leaves the list once every part of it is
// behind the Student, and waits in Done under "Past exams". Pure: the screen,
// a course's tab and the sidebar's count all read it, so they count the same.
import { wibDay } from "./course-meetings";
import { notHandingIn, taskPutAway } from "./done";
import { type Exam, type ExamPart, examAhead, examDated, examMarkOn, examParts, PERIOD_NEAR } from "./exams";
import type { CalendarEvent, DoneEntry, ExamMark, SnoozeEntry, Task, TaskStatus } from "./models";
import { taskNeed } from "./needs";
import { dayStart, weekStart } from "./schedule";
import { activeSnooze, type Snoozable, snoozable } from "./snooze";
import { isOpenStatus, submittedAt, taskStatus } from "./tasks";

const DAY = 86_400_000;

/** An exam period with no day yet for some of its exams: far off, within two weeks, or going on. */
export type PeriodState = "far" | "near" | "during";

export type TodoItem =
  /** `putAway`: the Student said it's handed in another way or by the group (core/done.ts): listed, not counted. */
  | { kind: "task"; key: string; at: number | null; course: string; task: Task; status: TaskStatus; late: boolean; putAway: boolean }
  /** `part` is null for an exam no system dates and with no exam week: it waits under "No date yet". */
  | { kind: "exam"; key: string; at: number | null; course: string; exam: Exam; part: ExamPart | null; late: boolean }
  | { kind: "period"; key: string; at: number; course: null; examKind: "UTS" | "UAS"; week: CalendarEvent; exams: Exam[]; state: PeriodState };

export type TodoGroup = "overdue" | "thisWeek" | "nextWeek" | "later" | "undated";

export interface TodoInput {
  tasks: readonly Task[];
  exams: readonly Exam[];
  marks?: readonly ExamMark[];
  /** What the Student marked handled ("local.done"). */
  handled?: readonly DoneEntry[];
  now: number;
}

/**
 * Everything still ahead, soonest first: a Task at its deadline, an exam's
 * every part at its own moment (a take-home is the exam's, never also a
 * plain Task), then the period lines. At the same moment a period line comes
 * after the rows, then the course code decides; otherwise the exams' own
 * order (UTS before UAS) holds.
 */
export function todoList({ tasks, exams, marks = [], handled = [], now }: TodoInput): TodoItem[] {
  const items: TodoItem[] = [];
  const takeHomes = new Set(exams.flatMap((exam) => exam.tasks.map((task) => task.id)));
  for (const task of tasks) {
    const status = taskStatus(task, now);
    // Not handing it in (said on its page): it's under Done, not to do.
    if (takeHomes.has(task.id) || !isOpenStatus(status) || notHandingIn(task, handled)) continue;
    const putAway = taskPutAway(task, handled) !== undefined;
    items.push({ kind: "task", key: `task:${task.id}`, at: task.dueAt, course: task.courseCode, task, status, late: status === "overdue", putAway });
  }
  const periods = new Map<string, { week: CalendarEvent; examKind: "UTS" | "UAS"; exams: Exam[] }>();
  for (const exam of exams) {
    if (!examDated(exam)) {
      if (!examAhead(exam, now, marks)) continue;
      if (exam.week && (exam.kind === "UTS" || exam.kind === "UAS")) {
        const period = periods.get(exam.week.id) ?? { week: exam.week, examKind: exam.kind, exams: [] };
        period.exams.push(exam);
        periods.set(exam.week.id, period);
      } else items.push({ kind: "exam", key: `exam:${exam.id}`, at: null, course: exam.courseCode, exam, part: null, late: false });
      continue;
    }
    for (const part of examParts(exam, now, marks))
      items.push({
        kind: "exam",
        key: `exam:${exam.id}:${part.id}`,
        at: part.at,
        course: exam.courseCode,
        exam,
        part,
        late: part.kind === "takehome" && part.status === "overdue",
      });
  }
  for (const { week, examKind, exams: undated } of periods.values()) {
    const state: PeriodState = week.start <= now ? "during" : week.start - now <= PERIOD_NEAR ? "near" : "far";
    items.push({ kind: "period", key: `period:${week.id}`, at: week.start, course: null, examKind, week, exams: undated, state });
  }
  return items.sort(
    (a, b) =>
      (a.at ?? Number.MAX_SAFE_INTEGER) - (b.at ?? Number.MAX_SAFE_INTEGER) ||
      Number(a.kind === "period") - Number(b.kind === "period") ||
      (a.course ?? "").localeCompare(b.course ?? ""),
  );
}

/** One course's part of the list: a period line keeps only that course's exams, and goes when it has none. */
export function todoForCourse(items: readonly TodoItem[], code: string | null): TodoItem[] {
  if (code === null) return [...items];
  return items.flatMap((item): TodoItem[] => {
    if (item.kind !== "period") return item.course === code ? [item] : [];
    const exams = item.exams.filter((exam) => exam.courseCode === code);
    return exams.length ? [{ ...item, exams }] : [];
  });
}

const weekNumber = (at: number) => Math.round(dayStart(weekStart(wibDay(at))) / (7 * DAY));

/** Where a row sits: late, this WIB week (Monday first), next week, later, or no date yet. */
export function todoGroup(item: TodoItem, now: number): TodoGroup {
  if (item.kind !== "period" && item.late) return "overdue";
  if (item.at === null) return "undated";
  const weeks = weekNumber(item.at) - weekNumber(now);
  return weeks <= 0 ? "thisWeek" : weeks === 1 ? "nextWeek" : "later";
}

/**
 * A row that counts: a Task or an exam with a day. A period line, and an exam with no day, are things to know, not to do;
 * a Task the Student handed in another way or their group handed in stays listed (Edunex still has it open) but isn't counted.
 */
export const todoCounted = (item: TodoItem): boolean => (item.kind === "task" && !item.putAway) || (item.kind === "exam" && item.part !== null);

/** "Belum selesai N", the sidebar's count and a course's tab: the same rows. */
export const todoCount = (items: readonly TodoItem[]): number => items.filter(todoCounted).length;

/** Something late, or running out (or starting) within a day. */
export const todoUrgent = (items: readonly TodoItem[], now: number): boolean =>
  items.some((item) => item.kind !== "period" && todoCounted(item) && (item.late || (item.at !== null && item.at - now < DAY)));

// ---------------------------------------------------------------- put off

/** The Task a late row is about: a Task, or an exam's take-home. */
const lateTask = (item: TodoItem): Task | null =>
  !(item.kind !== "period" && item.late) ? null : item.kind === "task" ? item.task : item.part?.kind === "takehome" ? item.part.task : null;

/**
 * A late row can be put off ("Ingatkan nanti") as Beranda puts off the same
 * Task: the same item, so a snooze from either place holds in both, with
 * the same moments. Nothing else in the list is put off here.
 */
export function lateSnoozable(item: TodoItem, now: number): Snoozable | null {
  const task = lateTask(item);
  const need = task ? taskNeed(task, now) : null;
  return need ? snoozable(need, now) : null;
}

/** The list without the late rows put off, and those rows with until when: they're back when it ends, or when the Task changes. */
export function putOffLate(items: readonly TodoItem[], entries: readonly SnoozeEntry[], now: number) {
  const shown: TodoItem[] = [];
  const putOff: { item: TodoItem; entry: SnoozeEntry }[] = [];
  for (const item of items) {
    const key = lateSnoozable(item, now)?.key;
    const entry = key ? activeSnooze(key, entries, now) : undefined;
    if (entry) putOff.push({ item, entry });
    else shown.push(item);
  }
  return { shown, putOff };
}

// ---------------------------------------------------------------- Done

/** An exam behind the Student, at its latest moment; with the marks that put its Edunex windows there. */
export interface PastExam {
  exam: Exam;
  at: number;
  marks: ExamMark[];
}

/**
 * What's done, each group newest first: handed in (Tasks and take-homes, in
 * review included), not handing it in (still open on Edunex, soonest first:
 * the Student said so on its page), past exams (their sitting or window
 * behind or marked done, or their exam week over with no day ever given) and
 * closed without a hand-in. A take-home shows once, with the Tasks; its past
 * exam doesn't repeat it.
 */
export function doneList({ tasks, exams, marks = [], handled = [], now }: TodoInput): {
  handedIn: Task[];
  /** Still open on Edunex, but the Student said they won't hand it in (on its page). */
  notHandingIn: Task[];
  pastExams: PastExam[];
  closed: Task[];
} {
  const handedIn = tasks.filter((task) => submittedAt(task) !== null).sort((a, b) => (submittedAt(b) ?? 0) - (submittedAt(a) ?? 0));
  const closed = tasks.filter((task) => taskStatus(task, now) === "closed").sort((a, b) => (b.dueAt ?? 0) - (a.dueAt ?? 0));
  const pastExams: PastExam[] = [];
  for (const exam of exams) {
    const sat = exam.six.length > 0 || exam.edunex.some((e) => e.start !== null || e.end !== null);
    if ((!sat && examDated(exam)) || examAhead(exam, now, marks)) continue;
    const held = exam.edunex.flatMap((e) => {
      const mark = examMarkOn(e, marks);
      return mark ? [mark] : [];
    });
    const moments = [
      ...exam.six.map((session) => session.end),
      ...exam.edunex.flatMap((e) => {
        const at = examMarkOn(e, marks)?.at ?? e.end ?? e.start;
        return at === null ? [] : [at];
      }),
      ...exam.tasks.map((task) => submittedAt(task) ?? task.dueAt ?? 0),
    ];
    pastExams.push({ exam, at: moments.length ? Math.max(...moments) : (exam.week?.end ?? 0), marks: held });
  }
  pastExams.sort((a, b) => b.at - a.at || a.exam.courseCode.localeCompare(b.exam.courseCode));
  const declined = tasks.filter((task) => isOpenStatus(taskStatus(task, now)) && notHandingIn(task, handled)).sort((a, b) => (a.dueAt ?? 0) - (b.dueAt ?? 0));
  return { handedIn, notHandingIn: declined, pastExams, closed };
}
