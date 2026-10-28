// The comment thread under each of the Student's answers (Edunex's
// /course/comments, what the website shows as "Comment / Feedback" under an
// answer): what a lecturer wrote back, often the reason a Task was handed back.
// A lecturer's message doesn't change the answer itself, so threads have a feed
// of their own: an answer's thread is read as soon as the answer changed since
// it was last read (handed in, handed back, reviewed), and every hour while its
// Task is recent (still taking answers, or something happened to it in the last
// three weeks). Older ones are left alone until their answer changes. The Tasks
// feed starts this one each time it has read the answers, and the Task page
// asks for its own thread when it opens, as the website does. Read only.
import { z } from "zod";
import type { Task, TaskMessage, TaskThread } from "../../../core/models";
import { takesAnswers } from "../../../core/tasks";
import { isEngineError } from "../../errors";
import type { SourceContext } from "../source";
import type { EdunexClient } from "./client";
import { edunexTime, Id } from "./task-records";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** A Task this long past its last happening is read again only once its answer changes. */
const RECENT = 21 * DAY;
/** How often a recent thread is read when nothing about its answer changed. */
const AGAIN = HOUR;
/** A thread read this recently isn't read again when the Task page asks. */
const FRESH = 30_000;

/** The recorded reply (test/fixtures/edunex/course-comments.include-user-commentable-id-*.json). */
const Comments = z.object({
  data: z.array(
    z.object({
      id: Id,
      attributes: z.object({
        comment: z.string().nullable(),
        created_at: z.string().nullable(),
        user: z.object({ name: z.string().nullable(), username: z.string().nullable().optional(), level: z.string().nullable() }).nullable(),
        // Files a message carries: the website posts { file_name, file } and shows `name`, else the link's last part.
        files: z
          .array(z.looseObject({ name: z.string().nullable().optional(), file_name: z.string().nullable().optional(), file: z.string() }))
          .nullable()
          .optional(),
      }),
    }),
  ),
  meta: z.object({ total: z.number() }),
});

/** The thread under one answer, oldest message first, as the website asks for it (every message, with who wrote it). */
export async function fetchThread(client: EdunexClient, answerId: number, nim: string | null): Promise<TaskMessage[]> {
  const reply = await client.get(
    "/course/comments",
    {
      include: "user",
      "filter[commentable_type][is]": "task_answer",
      "filter[commentable_id][is]": answerId,
      sort: "-created_at",
      "page[limit]": 0,
      "page[offset]": 0,
    },
    Comments,
  );
  return reply.data
    .map(({ id, attributes: a }): TaskMessage => {
      const student = a.user?.level?.toUpperCase() === "STUDENT";
      return {
        id,
        at: edunexTime(a.created_at),
        from: !student ? "lecturer" : nim === null || a.user?.username === nim ? "me" : "student",
        name: a.user?.name?.trim() || "-",
        html: a.comment ?? "",
        files: (a.files ?? []).map((file) => ({ name: file.name?.trim() || file.file_name?.trim() || fileName(file.file), url: file.file })),
      };
    })
    .sort((x, y) => (x.at ?? 0) - (y.at ?? 0) || x.id - y.id);
}

function fileName(url: string): string {
  const last = url.split("?")[0]!.split("/").pop() || "file";
  try {
    return decodeURIComponent(last);
  } catch {
    return last;
  }
}

/** The answer's state that, once it moves, means its thread may have something new. */
export const answerSeen = (task: Task) => {
  const answer = task.answer!;
  return [answer.id, answer.sent, answer.updatedAt, answer.reviewedAt, answer.handedBack?.at].join("|");
};

/** When something last happened to the Task or its answer, as far as the app knows. */
function lastHappened(task: Task, thread: TaskThread | undefined): number {
  const answer = task.answer;
  const moments = [task.dueAt, answer?.updatedAt, answer?.sentAt, answer?.reviewedAt, answer?.handedBack?.at, ...(thread?.messages.map((m) => m.at) ?? [])];
  return Math.max(0, ...moments.filter((at): at is number => typeof at === "number"));
}

/** Whether to read this answer's thread now. */
export function threadDue(task: Task, thread: TaskThread | undefined, now: number): boolean {
  if (!task.answer || task.group) return false;
  if (!thread || thread.seen !== answerSeen(task)) return true;
  const recent = takesAnswers(task, now) || now - lastHappened(task, thread) < RECENT;
  return recent && now - thread.readAt >= AGAIN;
}

/** Keeps one thread just read (after the Student wrote in it), in place of the copy the app had. */
export async function keepThread(context: SourceContext, thread: TaskThread): Promise<void> {
  const others = (context.get("edunex.taskThreads") ?? []).filter((kept) => kept.answerId !== thread.answerId);
  await context.set(
    "edunex.taskThreads",
    [...others, thread].sort((a, b) => a.taskId - b.taskId),
  );
}

/**
 * Reads one Task's thread now, as the website does each time its page opens: the Task page asks when it opens and
 * when the window comes back to the front, so a message written elsewhere (on the website, on another computer, by
 * the lecturer) shows without waiting for the hourly read. At most every half minute.
 */
export async function readThreadNow(context: SourceContext, client: EdunexClient, taskId: number): Promise<void> {
  const task = context.get("edunex.tasks")?.find((kept) => kept.id === taskId);
  if (!task?.answer || task.group) return;
  const answerId = task.answer.id;
  const kept = context.get("edunex.taskThreads")?.find((thread) => thread.answerId === answerId);
  if (kept && kept.seen === answerSeen(task) && context.clock.now() - kept.readAt < FRESH) return;
  const messages = await fetchThread(client, answerId, context.get("edunex.account")?.nim ?? null);
  await keepThread(context, { taskId, answerId, messages, readAt: context.clock.now(), seen: answerSeen(task) });
}

export function registerThreadFeed(context: SourceContext, client: EdunexClient): void {
  context.feed({
    name: "edunex.taskThreads",
    every: 15 * MINUTE,
    jitter: 2 * MINUTE,
    // Also started by the Tasks feed each time it has read the answers (./tasks.ts), so never on a refresh's own.
    background: true,
    async run(current) {
      const tasks = context.get("edunex.tasks");
      if (!tasks) return;
      const before = new Map((context.get("edunex.taskThreads") ?? []).map((thread) => [thread.answerId, thread]));
      const nim = context.get("edunex.account")?.nim ?? null;
      const threads: TaskThread[] = [];
      let failure: unknown = null;
      for (const task of tasks) {
        if (!task.answer || task.group) continue;
        const kept = before.get(task.answer.id);
        if (!threadDue(task, kept, context.clock.now())) {
          if (kept) threads.push(kept);
          continue;
        }
        try {
          const messages = await fetchThread(client, task.answer.id, nim);
          threads.push({ taskId: task.id, answerId: task.answer.id, messages, readAt: context.clock.now(), seen: answerSeen(task) });
        } catch (error) {
          // No network, or the session ended: every thread would fail the same way.
          if (!isEngineError(error) || error.kind === "Offline" || error.kind === "Unauthorized") throw error;
          // One thread failing keeps what was known of it, and is reported.
          failure ??= error;
          if (kept) threads.push(kept);
        }
        if (!current()) return;
      }
      // A thread read while this ran (the Student wrote, or the Task page asked) is newer than this run's copy.
      const meanwhile = new Map((context.get("edunex.taskThreads") ?? []).map((thread) => [thread.answerId, thread]));
      const newest = threads.map((thread) => {
        const other = meanwhile.get(thread.answerId);
        return other && other.readAt > thread.readAt ? other : thread;
      });
      await context.set(
        "edunex.taskThreads",
        newest.sort((a, b) => a.taskId - b.taskId),
      );
      if (failure) throw failure;
    },
  });
}
