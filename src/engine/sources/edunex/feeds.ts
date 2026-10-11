// EduNex feeds: each one fetches, checks and turns vendor data into app models.
import type { Account, Course } from "../../../core/models";
import type { EdunexClient } from "./client";
import { CoursePairs, LoginMe } from "./schemas";

export async function fetchAccount(client: EdunexClient): Promise<Account> {
  const me = await client.get("/login/me", {}, LoginMe);
  return { name: me.name.trim(), nim: me.code };
}

const PARENT = /\s*\[Parent Class\]\s*$/i;

/**
 * The term's courses. EduNex lists a class's parent course ("… [Parent
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
