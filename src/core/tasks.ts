// What a Task's facts mean at a given moment: its true status, whether Edunex
// still takes an answer, what Edunex itself doesn't say (edited after the
// Student submitted, a short answer window) and its history. Status comes
// only from the answer's submit bit and the Task's own dates and state: never
// from a draft's timestamps, and never from Edunex's To Do feed.
import { presenceAction } from "./attendance";
import { htmlText } from "./course-materials";
import { EDUNEX_WEB } from "./links";
import type { PresenceSession, SourceState, Task, TaskModule, TaskStatus } from "./models";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Open for answers less than this long: a short window, often posted during class. */
export const SHORT_WINDOW_MS = 6 * HOUR;

type StatusFacts = Pick<Task, "answer" | "closed" | "dueAt" | "lateAllowed" | "score">;

export function taskStatus(task: StatusFacts, now: number): TaskStatus {
  const { answer } = task;
  // Only the submit bit means handed in. "In review": the lecturer took it up (Edunex's verified_at) and no score shows yet.
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

/** Not open for answers yet: Edunex takes them from `opensAt` on. */
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

/** When Edunex says the answer was handed in; null for a draft, whatever its timestamps say. */
export function submittedAt(task: Pick<Task, "answer">): number | null {
  return task.answer?.sent ? task.answer.sentAt : null;
}

/** The Task's page on Edunex's website, as Edunex's own notifications link it. */
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
 * The Task's own timeline from Edunex's timestamps, the receipt the website
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

// ---------------------------------------------------------------- before handing in

/**
 * The Presence session a Task's hand-in counts as attendance for (Answer
 * Assignment), open, closed or still to come; the soonest still open, else
 * the latest.
 */
export function attendanceSession(task: Task, sessions: readonly PresenceSession[], now: number): PresenceSession | null {
  const mine = sessions.filter((session) => presenceAction(session, [task]).task !== null).sort((a, b) => a.opensAt - b.opensAt);
  return mine.find((session) => session.closesAt > now) ?? mine.at(-1) ?? null;
}

/**
 * What handing in did for attendance, once it's handed in: counted when
 * Edunex recorded the Student or the hand-in fell inside the window; outside
 * when it fell outside; null when the Task isn't attendance or isn't handed in.
 */
export function attendanceResult(task: Task, sessions: readonly PresenceSession[], now: number): { outcome: "counted" | "outside"; session: PresenceSession } | null {
  const sentAt = submittedAt(task);
  const session = attendanceSession(task, sessions, now);
  if (sentAt === null || !session) return null;
  if (session.recorded?.present) return { outcome: "counted", session };
  return { outcome: sentAt >= session.opensAt && sentAt <= session.closesAt ? "counted" : "outside", session };
}

/** The file name the lecturer asks for, when the instructions quote one ("Penamaan file 'NIM Nama - Tugas 02.pdf'"). */
export function namingPattern(instructions: string): string | null {
  const text = htmlText(instructions);
  if (!/\b(nama|penamaan|name|naming|format)\b/i.test(text)) return null;
  const quoted = /["'‘’“”`]([^"'‘’“”`\n]{3,80}?\.(?:pdf|docx?|zip|rar|pptx?|xlsx?|ipynb|py))["'‘’“”`]/i.exec(text);
  return quoted ? quoted[1].trim() : null;
}

// Words in a naming pattern that stand for the Student's own details.
const PLACEHOLDER = /^(nim|nama|name|namalengkap|lengkap|kelas|class|kelompok|group|no|nomor|absen|x+|n)$/i;

/**
 * Whether a file's name looks like the pattern: the same extension, and the
 * pattern's fixed words ("Tugas", "02") in it. Placeholders (NIM, Nama) can
 * be anything.
 */
export function matchesNaming(pattern: string, fileName: string): boolean {
  const ext = (name: string) => /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase() ?? "";
  if (ext(pattern) !== ext(fileName)) return false;
  const words = (name: string) => name.replace(/\.[a-z0-9]+$/i, "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const have = new Set(words(fileName));
  return words(pattern)
    .filter((word) => !PLACEHOLDER.test(word))
    .every((word) => have.has(word) || [...have].some((h) => /^\d+$/.test(word) && /^\d+$/.test(h) && Number(h) === Number(word)));
}

/** The file type the instructions ask for ("format .pdf", "dalam bentuk PDF"): "pdf", or null. */
export function requiredFileType(instructions: string): string | null {
  const text = htmlText(instructions);
  const hit = /\b(?:format|bentuk|berupa|tipe|jenis|type|ekstensi|as an?|as)\s+(?:file\s+|berkas\s+)?\.?(pdf|docx?|zip|pptx?|xlsx?|ipynb)\b/i.exec(text);
  return hit ? hit[1].toLowerCase() : null;
}

/**
 * One thing to know before handing in. Blocks: no connection, the session
 * ended. Warnings: outside the attendance window (before it opens, so
 * waiting helps; or after it closed), late, a file not in the asked type or
 * name. Fine: inside the attendance window.
 */
export type HandInCheck =
  | { kind: "offline" | "expired"; tone: "block" }
  | { kind: "attendanceEarly"; tone: "warn"; opensAt: number; closesAt: number }
  | { kind: "attendanceMissed"; tone: "warn"; opensAt: number; closesAt: number }
  | { kind: "attendanceIn"; tone: "ok"; closesAt: number }
  | { kind: "late"; tone: "warn"; dueAt: number }
  | { kind: "fileType"; tone: "warn"; type: string; files: string[] }
  | { kind: "naming"; tone: "warn"; pattern: string; files: string[] };

export interface HandInFacts {
  now: number;
  /** The course's Presence sessions. */
  sessions: readonly PresenceSession[];
  /** Edunex's connection. */
  edunex: SourceState;
  /** The files that would be handed in. */
  files: readonly { name: string }[];
}

/**
 * Everything to check before a hand-in, worst first, and the safe default:
 * `waitForWindow` when handing in now would lose the attendance that
 * handing in later would count (so the main button is "save as draft").
 */
export function handInChecks(task: Task, facts: HandInFacts): { checks: HandInCheck[]; blocked: boolean; waitForWindow: boolean } {
  const checks: HandInCheck[] = [];
  if (facts.edunex === "offline") checks.push({ kind: "offline", tone: "block" });
  else if (facts.edunex === "expired" || facts.edunex === "signed-out") checks.push({ kind: "expired", tone: "block" });
  const session = isOpenStatus(taskStatus(task, facts.now)) ? attendanceSession(task, facts.sessions, facts.now) : null;
  if (session && !session.recorded?.present) {
    if (facts.now < session.opensAt) checks.push({ kind: "attendanceEarly", tone: "warn", opensAt: session.opensAt, closesAt: session.closesAt });
    else if (facts.now > session.closesAt) checks.push({ kind: "attendanceMissed", tone: "warn", opensAt: session.opensAt, closesAt: session.closesAt });
    else checks.push({ kind: "attendanceIn", tone: "ok", closesAt: session.closesAt });
  }
  if (taskStatus(task, facts.now) === "overdue" && task.dueAt !== null) checks.push({ kind: "late", tone: "warn", dueAt: task.dueAt });
  const type = requiredFileType(task.instructions);
  const wrongType = type ? facts.files.filter((file) => !file.name.toLowerCase().endsWith(`.${type}`) && !(type === "doc" && /\.docx$/i.test(file.name))) : [];
  if (type && wrongType.length) checks.push({ kind: "fileType", tone: "warn", type, files: wrongType.map((file) => file.name) });
  const pattern = namingPattern(task.instructions);
  const misnamed = pattern ? facts.files.filter((file) => !matchesNaming(pattern, file.name)) : [];
  if (pattern && misnamed.length) checks.push({ kind: "naming", tone: "warn", pattern, files: misnamed.map((file) => file.name) });
  return {
    checks,
    blocked: checks.some((check) => check.tone === "block"),
    waitForWindow: checks.some((check) => check.kind === "attendanceEarly"),
  };
}
