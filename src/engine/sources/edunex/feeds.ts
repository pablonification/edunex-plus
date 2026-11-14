// Edunex's core feeds (#71): who is signed in (also the liveness check) and
// this term's courses.

import type { z } from "zod";
import type { Account, Course } from "../../../core/models";
import { ActionNeeded, AnswerError } from "../../errors";
import type { FeedRead } from "../../report/kept-pages";
import type { SourceContext } from "../source";
import type { EdunexClient } from "./client";
import { CoursePairs, LoginMe } from "./schemas";

const MINUTE = 60_000;

/** The signed-in user's Edunex id, from the account feed's /login/me: the notification feed's address. One per session. */
export interface EdunexUser {
  id: number | null;
}

/**
 * GET /login/me: who is signed in. An account that isn't a student's (a lecturer's says `level: "LECTURER"` and has no
 * `code`, the NIM) is asked to sign in with a Student's: the app reads only theirs, and that isn't a change to report.
 */
export async function fetchMe(client: EdunexClient): Promise<z.infer<typeof LoginMe>> {
  try {
    return await client.get("/login/me", {}, LoginMe);
  } catch (error) {
    throw notAStudent(error);
  }
}

function notAStudent(error: unknown): unknown {
  if (!(error instanceof AnswerError) || !error.message.startsWith("/login/me: code ")) return error;
  let me: { level?: unknown; code?: unknown } | null;
  try {
    me = JSON.parse(error.answer.body);
  } catch {
    return error;
  }
  const level = me?.level;
  if (level !== "LECTURER" || me?.code !== undefined) return error;
  return new ActionNeeded("student", "Edunex signed in a lecturer account, not a student's");
}

export function registerCoreFeeds(context: SourceContext, client: EdunexClient, user: EdunexUser = { id: null }): void {
  // Each run reads and stores through its own view of the two, so the report knows which run got what (FeedSpec.run).
  const noted = (read: FeedRead) => ({ context: context.for(read), client: client.for(read) });
  context.feed({
    name: "edunex.account",
    // Whose session this is, and whether it still holds: before anything else is read.
    priority: "now",
    every: 10 * MINUTE,
    jitter: MINUTE,
    async run(current, read) {
      const { context, client } = noted(read);
      const me = await fetchMe(client);
      const account: Account = { name: me.name.trim(), nim: me.code };
      if (!current()) return;
      user.id = me.id;
      const previous = context.get("edunex.account");
      // A different Student signed in on this computer: nothing of the last one may show.
      if (previous && previous.nim !== account.nim) await context.remove("edunex.");
      // Nor their snoozes and what they marked handled, kept past signing out of Edunex alone: Task ids are the
      // whole class's, so a classmate's "not handing it in" would hide this Student's Task and stop its reminders.
      // Nor their highlights: the course's files are the whole class's too, and what one Student marked is theirs.
      const owner = context.get("local.owner");
      if ((previous && previous.nim !== account.nim) || (owner && owner.nim !== account.nim)) {
        await context.remove("local.snoozes");
        await context.remove("local.done");
        await context.remove("local.highlights");
      }
      if (owner?.nim !== account.nim) await context.set("local.owner", { nim: account.nim });
      await context.set("edunex.account", account);
    },
  });
  context.feed({
    name: "edunex.courses",
    // What the Tasks and Presence are read for (one call).
    priority: "now",
    every: 30 * MINUTE,
    jitter: 3 * MINUTE,
    async run(_current, read) {
      const { context, client } = noted(read);
      await context.set("edunex.courses", await fetchCourses(client));
    },
  });
}

const PARENT = /\s*\[Parent Class\]\s*$/i;

/**
 * The term's courses. Edunex lists a class's parent course ("… [Parent
 * Class]") as a separate pair; both are kept on one course, the child first.
 */
export async function fetchCourses(client: EdunexClient): Promise<Course[]> {
  const pairs = await client.get("/course/presences/list", {}, CoursePairs);
  const byClass = new Map<string, Course>();
  const sorted = [...pairs].sort((a, b) => Number(PARENT.test(a.courses_name)) - Number(PARENT.test(b.courses_name)));
  for (const pair of sorted) {
    const key = `${pair.course_code}|${pair.class_id}`;
    const existing = byClass.get(key);
    if (existing) {
      existing.edunex.relatedCourseIds.push(pair.course_id);
      continue;
    }
    byClass.set(key, {
      code: pair.course_code,
      name: pair.courses_name.replace(PARENT, ""),
      classNo: /-(\d+)$/.exec(pair.class_name)?.[1] ?? null,
      term: `${pair.year}-${pair.semester}`,
      edunex: { courseId: pair.course_id, classId: pair.class_id, relatedCourseIds: [] },
    });
  }
  return [...byClass.values()].sort((a, b) => a.code.localeCompare(b.code));
}
