// Edunex's Task records (GET /course/tasks with the Student's answers), read
// into the app's Tasks. Shapes verified against test/fixtures/edunex/course-tasks.*.json.
import { z } from "zod";
import type { Task, TaskAnswer, TaskFile, TaskModule } from "../../../core/models";
import { byDeadline, taskStatus } from "../../../core/tasks";
import { EngineError } from "../../errors";
import type { Transport } from "../../http/transport";
import type { SourceContext } from "../source";
import type { EdunexClient } from "./client";

const HOUR = 3_600_000;

const Id = z.union([z.number().int(), z.string().regex(/^\d+$/)]).transform(Number);
/** Edunex writes its flags as booleans or as 0/1. */
const Flag = z.union([z.boolean(), z.literal(0), z.literal(1)]).transform((value) => value === true || value === 1);
/** The submit bit. Any other value is a vendor change, never a guess. */
const SubmitBit = z.union([z.literal(0), z.literal(1), z.literal("0"), z.literal("1"), z.boolean()]).transform((v) => v === 1 || v === "1" || v === true);
const Score = z
  .union([
    z.number(),
    z
      .string()
      .regex(/^\d+(\.\d+)?$/)
      .transform(Number),
  ])
  .nullable();
const Time = z.string().nullable();
const StoredFile = z.object({ name: z.string(), file: z.string() });

const EdunexAnswer = z.object({
  id: Id,
  answer: z.string().nullable(),
  files: z.array(StoredFile),
  score: Score,
  is_sent: SubmitBit,
  sent_at: Time,
  created_at: Time,
  updated_at: Time,
  verified_at: Time,
});
type EdunexAnswer = z.infer<typeof EdunexAnswer>;

const EdunexTask = z.object({
  id: Id,
  attributes: z.object({
    taskable_type: z.string().nullable(),
    taskable_id: z.number().nullable(),
    name: z.string(),
    description: z.string().nullable(),
    files: z.array(StoredFile),
    start_at: Time,
    end_at: Time,
    created_at: Time,
    updated_at: Time,
    open_status: z.string(),
    file_required: Flag,
    is_lateable: Flag,
    domain: z.string().nullable(),
    show_score: Flag,
    answers: z.array(EdunexAnswer),
  }),
});
export type EdunexTask = z.infer<typeof EdunexTask>;

const CourseTasks = z.object({ meta: z.object({ total: z.number() }), data: z.array(EdunexTask) });

/** Every Task of one Edunex course, the Student's answers included. */
export async function fetchCourseTasks(client: EdunexClient, courseId: number): Promise<EdunexTask[]> {
  const list = await client.get("/course/tasks", { "filter[course_id][is]": courseId, "page[limit]": 0 }, CourseTasks);
  // "page[limit]=0" means everything; fewer than Edunex counts would silently hide Tasks.
  if (list.data.length < list.meta.total)
    throw new EngineError("VendorChanged", `/course/tasks: ${list.data.length} of ${list.meta.total} Tasks for course ${courseId}`);
  return list.data;
}

/** One Task read back from Edunex (through its course's list, the shape verified with answers). Null when it's gone. */
export async function readTask(client: EdunexClient, known: Pick<Task, "id" | "courseId" | "courseCode" | "module">, now: number): Promise<Task | null> {
  const item = (await fetchCourseTasks(client, known.courseId)).find((task) => task.id === known.id);
  return item ? toTask(item, known, known.module, now) : null;
}

// ---------------------------------------------------------------- times

const TIME = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)(Z|[+-]\d{2}:?\d{2})?$/i;

/**
 * Edunex's Task times carry an offset ("2026-10-16T23:59:00+07:00"); its
 * answer times carry none ("2026-09-16 16:15:33") and are WIB (UTC+7).
 */
export function edunexTime(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  const match = TIME.exec(value.trim());
  if (!match) throw new EngineError("VendorChanged", `/course/tasks: unreadable time "${value}"`);
  const [, day, time, zone] = match;
  const offset = !zone ? "+07:00" : /^[+-]\d{4}$/.test(zone) ? `${zone.slice(0, 3)}:${zone.slice(3)}` : zone.toUpperCase();
  const ms = Date.parse(`${day}T${time}${offset}`);
  if (Number.isNaN(ms)) throw new EngineError("VendorChanged", `/course/tasks: unreadable time "${value}"`);
  return ms;
}

// ---------------------------------------------------------------- the app's Task

/** Edunex's `open_status` values that mean it takes no more answers. */
const CLOSED = new Set(["overdue", "closed"]);

export function toTask(item: EdunexTask, place: Pick<Task, "courseCode" | "courseId">, module: TaskModule | null, now: number): Task {
  const a = item.attributes;
  const raw = studentAnswer(a.answers);
  const answer: TaskAnswer | null = raw && {
    id: raw.id,
    sent: raw.is_sent,
    text: raw.answer?.trim() ? raw.answer : null,
    files: raw.files.map(fileOf),
    createdAt: edunexTime(raw.created_at),
    updatedAt: edunexTime(raw.updated_at),
    // Edunex stamps sent_at on drafts too: only the submit bit makes it a submission time.
    sentAt: raw.is_sent ? (edunexTime(raw.sent_at) ?? edunexTime(raw.updated_at)) : null,
    reviewedAt: edunexTime(raw.verified_at),
  };
  const dueAt = edunexTime(a.end_at);
  const facts = {
    answer,
    closed: CLOSED.has(a.open_status),
    dueAt,
    lateAllowed: a.is_lateable,
    score: raw && a.show_score ? shownScore(raw) : null,
  };
  const postedAt = edunexTime(a.created_at);
  return {
    id: item.id,
    courseCode: place.courseCode,
    courseId: place.courseId,
    moduleId: a.taskable_type === "modules" ? a.taskable_id : null,
    title: a.name.trim(),
    status: taskStatus(facts, now),
    opensAt: edunexTime(a.start_at),
    dueAt,
    score: facts.score,
    module,
    kind: a.domain === "uts" ? "uts" : "task",
    instructions: a.description ?? "",
    files: a.files.map(fileOf),
    fileRequired: a.file_required,
    lateAllowed: a.is_lateable,
    closed: facts.closed,
    answer,
    postedAt,
    editedAt: editedAt(postedAt, edunexTime(a.updated_at), answer?.sentAt ?? null),
  };
}

const fileOf = (file: z.infer<typeof StoredFile>): TaskFile => ({ name: file.name.trim() || "file", url: file.file });

/**
 * The score of a handed-in answer once the lecturer shows scores. Edunex
 * keeps 0 on every answer until it's graded, so a 0 counts only once the
 * answer was verified: a placeholder is never shown as a score.
 */
function shownScore(answer: EdunexAnswer): number | null {
  if (!answer.is_sent || answer.score === null) return null;
  return answer.score === 0 && answer.verified_at === null ? null : answer.score;
}

/** The Student's answer: the handed-in one when there is one (even among duplicates), else the latest draft. */
function studentAnswer(answers: EdunexAnswer[]): EdunexAnswer | null {
  const latest = (answer: EdunexAnswer) => edunexTime(answer.updated_at) ?? 0;
  return answers.find((answer) => answer.is_sent) ?? [...answers].sort((x, y) => latest(y) - latest(x))[0] ?? null;
}

/**
 * Edunex moves only `updated_at` when the lecturer edits a Task. A touch in
 * the first hour after posting is part of posting it, unless the Student had
 * already handed it in by then.
 */
function editedAt(postedAt: number | null, updatedAt: number | null, sentAt: number | null): number | null {
  if (postedAt === null || updatedAt === null) return null;
  return updatedAt - postedAt > HOUR || (sentAt !== null && updatedAt > sentAt) ? updatedAt : null;
}

export function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort(byDeadline);
}

// ---------------------------------------------------------------- the Student's own changes

interface WriteLog {
  count: number;
  /** Task id → the count when the Student last changed it. */
  tasks: Map<number, number>;
}

// Kept per engine (one transport each), so tests running several engines never share it.
const writeLogs = new WeakMap<Transport, WriteLog>();

/** Tasks the Student just changed, so a sync that began before the change can't put the old state back. */
export function writeLog(context: SourceContext): WriteLog {
  let log = writeLogs.get(context.transport);
  if (!log) writeLogs.set(context.transport, (log = { count: 0, tasks: new Map() }));
  return log;
}

/** Stores a Task as just read back from Edunex after the Student changed it (null: it's gone). */
export async function remember(context: SourceContext, taskId: number, task: Task | null): Promise<void> {
  const log = writeLog(context);
  log.tasks.set(taskId, ++log.count);
  const list = (context.get("edunex.tasks") ?? []).filter((item) => item.id !== taskId);
  await context.set("edunex.tasks", sortTasks(task ? [...list, task] : list));
}
