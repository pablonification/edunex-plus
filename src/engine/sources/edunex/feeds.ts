// Edunex's core feeds (#71): who is signed in (also the liveness check) and
// this term's courses.
import type { Account, Course } from "../../../core/models";
import type { SourceContext } from "../source";
import type { EdunexClient } from "./client";
import { CoursePairs, LoginMe } from "./schemas";

const MINUTE = 60_000;

export function registerCoreFeeds(context: SourceContext, client: EdunexClient): void {
  context.feed({
    name: "edunex.account",
    every: 10 * MINUTE,
    jitter: MINUTE,
    async run(current) {
      const account = await fetchAccount(client);
      if (!current()) return;
      const previous = context.get("edunex.account");
      // A different Student signed in on this computer: nothing of the last one may show.
      if (previous && previous.nim !== account.nim) await context.remove("edunex.");
      await context.set("edunex.account", account);
    },
  });
  context.feed({
    name: "edunex.courses",
    every: 30 * MINUTE,
    jitter: 3 * MINUTE,
    async run() {
      await context.set("edunex.courses", await fetchCourses(client));
    },
  });
}

export async function fetchAccount(client: EdunexClient): Promise<Account> {
  const me = await client.get("/login/me", {}, LoginMe);
  return { name: me.name.trim(), nim: me.code };
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
