// What a Task's facts mean at a given moment: its true status, whether EduNex
// still takes an answer, what EduNex itself doesn't say (edited after the
// Student submitted, a short answer window) and its history. Status comes
// only from the answer's submit bit and the Task's own dates and state: never
// from a draft's timestamps, and never from EduNex's To Do feed.
import { EDUNEX_WEB } from "./links";
import type { Task, TaskModule, TaskStatus } from "./models";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Open for answers less than this long: a short window, often posted during class. */
export const SHORT_WINDOW_MS = 6 * HOUR;

type StatusFacts = Pick<Task, "answer" | "closed" | "dueAt" | "lateAllowed" | "score">;

export function taskStatus(task: StatusFacts, now: number): TaskStatus {
  const { answer } = task;
  // Only the submit bit means handed in. "In review": the lecturer took it up (EduNex's verified_at) and no score shows yet.
  if (answer?.sent) return answer.reviewedAt !== null && task.score === null ? "in_review" : "submitted";
  const pastDue = task.dueAt !== null && now > task.dueAt;
  if (task.closed || (pastDue && !task.lateAllowed)) return "closed";
  if (pastDue) return "overdue";
  return answer ? "draft" : "not_started";
}

/** Still to hand in: not started, a draft, or late but still taken. */
export function isOpenStatus(status: TaskStatus): boolean {
  return status === "not_started" || status === "draft" || status === "overdue";
}

/** Not open for answers yet: EduNex takes them from `opensAt` on. */
export function notOpenYet(task: Pick<Task, "opensAt">, now: number): boolean {
  return task.opensAt !== null && now < task.opensAt;
}

/** Whether the Student can hand in right now. */
export function takesAnswers(task: StatusFacts & Pick<Task, "opensAt">, now: number): boolean {
  return isOpenStatus(taskStatus(task, now)) && !notOpenYet(task, now);
}

/** How long the Task is open for answers, when that's a short window. */
export function shortWindow(task: Pick<Task, "opensAt" | "dueAt">): number | null {
  if (task.opensAt === null || task.dueAt === null) return null;
  const window = task.dueAt - task.opensAt;
  return window > 0 && window < SHORT_WINDOW_MS ? window : null;
}

/** The lecturer changed the Task after the Student handed it in. */
export function editedAfterSubmit(task: Pick<Task, "editedAt" | "answer">): boolean {
  const sentAt = task.answer?.sent ? task.answer.sentAt : null;
  return task.editedAt !== null && sentAt !== null && task.editedAt > sentAt;
}

/** When EduNex says the answer was handed in; null for a draft, whatever its timestamps say. */
export function submittedAt(task: Pick<Task, "answer">): number | null {
  return task.answer?.sent ? task.answer.sentAt : null;
}

/** The Task's page on EduNex's website, as EduNex's own notifications link it. */
export const edunexTaskUrl = (taskId: number) => `${EDUNEX_WEB}/assignment/take/${taskId}`;

/** The module's own name, unless it only repeats its number ("Module 06" for module 6). */
export function moduleName(module: TaskModule): string | null {
  const numbered = /^modul(?:e)?\s*0*(\d+)$/i.exec(module.name);
  return !module.name || (numbered && Number(numbered[1]) === module.index) ? null : module.name;
}

/** Soonest deadline first; Tasks without one last. */
export function byDeadline(a: Pick<Task, "dueAt" | "id">, b: Pick<Task, "dueAt" | "id">): number {
  return (a.dueAt ?? Number.MAX_SAFE_INTEGER) - (b.dueAt ?? Number.MAX_SAFE_INTEGER) || a.id - b.id;
}

// ---------------------------------------------------------------- history

export type HistoryKind = "posted" | "opens" | "edited" | "draft" | "submitted" | "deadline";
export interface HistoryStep {
  kind: HistoryKind;
  at: number;
}

/**
 * The Task's own timeline from EduNex's timestamps, the receipt the website
 * never shows: posted, opens for answers, edited, draft saved, submitted,
 * deadline. Steps that repeat another (opening as it's posted, a draft saved
 * on the way to submitting) are left out.
 */
export function taskHistory(task: Task): HistoryStep[] {
  const steps: HistoryStep[] = [];
  const sentAt = submittedAt(task);
  if (task.postedAt !== null) steps.push({ kind: "posted", at: task.postedAt });
  if (task.opensAt !== null && (task.postedAt === null || Math.abs(task.opensAt - task.postedAt) > HOUR)) steps.push({ kind: "opens", at: task.opensAt });
  if (task.editedAt !== null) steps.push({ kind: "edited", at: task.editedAt });
  const draftAt = task.answer?.createdAt ?? null;
  if (draftAt !== null && (sentAt === null || sentAt - draftAt > 5 * MINUTE)) steps.push({ kind: "draft", at: draftAt });
  if (sentAt !== null) steps.push({ kind: "submitted", at: sentAt });
  if (task.dueAt !== null) steps.push({ kind: "deadline", at: task.dueAt });
  return steps.sort((a, b) => a.at - b.at);
}

// ---------------------------------------------------------------- grouping for the list

/** Monday 00:00 of the week `at` falls in, in the computer's time zone. */
function weekStart(at: number): number {
  const day = new Date(at);
  day.setHours(0, 0, 0, 0);
  day.setDate(day.getDate() - ((day.getDay() + 6) % 7));
  return day.getTime();
}

export type DueGroup = "overdue" | "thisWeek" | "nextWeek" | "later";

/** Where an open Task sits in the list: late, due this calendar week (Monday first), next week, or later. */
export function dueGroup(task: Pick<Task, "dueAt">, status: TaskStatus, now: number): DueGroup {
  if (status === "overdue") return "overdue";
  if (task.dueAt === null) return "later";
  const weeks = Math.round((weekStart(task.dueAt) - weekStart(now)) / (7 * DAY));
  return weeks <= 0 ? "thisWeek" : weeks === 1 ? "nextWeek" : "later";
}
