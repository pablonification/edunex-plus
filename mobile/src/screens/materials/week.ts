// Materi (/materials): a week's material across every course of the term, found the way a course's Modul tab finds
// its "Minggu ini" module (../course/contents.ts: contentsOf, newestEntry), so both always point at the same module.

import type { TermCourse } from "../../../../src/app/courses";
import type { Translate } from "../../../../src/app/i18n";
import type { CoursePage } from "../../../../src/app/screens/course/data";
import type { CourseOutline, Material, Task } from "../../../../src/core/models";
import { contentsOf, type Entry, latest, newestEntry, WEEK } from "../course/contents";

export type Week = "this" | "last";

export interface WeekSection {
  course: TermCourse;
  /** The module new material came to in that week: the one the course's Modul tab marks. */
  entry: Entry;
}

/**
 * Each course's module that got new material in `week` (this one: the last 7 days; the last: the 7 before), newest
 * first. A course whose module has no material to open (only Tasks) is left out, as is one with nothing that week.
 */
export function weekSections(
  input: {
    courses: readonly TermCourse[];
    outline: Readonly<Record<string, CourseOutline>> | undefined;
    materials: Readonly<Record<string, Material[]>> | undefined;
    tasks: readonly Task[] | undefined;
  },
  t: Translate,
  now: number,
  week: Week,
): WeekSection[] {
  const until = week === "this" ? now : now - WEEK;
  return input.courses
    .flatMap((course): WeekSection[] => {
      const materials = input.materials?.[course.code];
      if (!materials?.length) return [];
      // contentsOf reads only the course, its outline, materials and Tasks.
      const page: CoursePage = {
        course,
        outline: input.outline?.[course.code],
        materials,
        presence: undefined,
        announcements: undefined,
        exams: [],
        tasks: (input.tasks ?? []).filter((task) => task.courseCode === course.code),
        meetings: [],
        inSix: course.inSix,
      };
      const entry = newestEntry(contentsOf(page, t), until);
      return entry && entry.materials.length > 0 ? [{ course, entry }] : [];
    })
    .sort((a, b) => (latest(b.entry) ?? 0) - (latest(a.entry) ?? 0));
}
