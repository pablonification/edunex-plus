// Materi (/materials) shows each course's module the Modul tab marks "Minggu ini", newest first, and the week before
// on "Minggu lalu" (mobile/src/screens/materials/week.ts).
import { describe, expect, it } from "vitest";
import { weekSections } from "../../mobile/src/screens/materials/week";
import type { TermCourse } from "../../src/app/courses";
import type { Translate } from "../../src/app/i18n";
import type { CourseOutline, Material } from "../../src/core/models";

const DAY = 86_400_000;
const now = Date.parse("2026-11-10T10:00:00+07:00");
const t = ((key: string) => key) as unknown as Translate;

const course = (code: string, courseId: number) => ({ code, name: code, inSix: true, edunex: { courseId, relatedCourseIds: [] } }) as unknown as TermCourse;
const outline = (courseId: number, modules: number[]) =>
  ({
    modules: modules.map((id, i) => ({ id, courseId, number: i + 1, title: `Modul ${i + 1}`, postedAt: null })),
    unopened: [],
  }) as unknown as CourseOutline;
const material = (id: number, courseId: number, moduleId: number, postedAt: number) =>
  ({ id, courseId, moduleId, postedAt, updatedAt: null, title: `M${id}`, type: "pdf" }) as unknown as Material;

const input = {
  courses: [course("AA1001", 1), course("BB2002", 2), course("CC3003", 3)],
  outline: { AA1001: outline(1, [11, 12]), BB2002: outline(2, [21]), CC3003: outline(3, [31]) },
  materials: {
    AA1001: [material(1, 1, 11, now - 9 * DAY), material(2, 1, 12, now - 2 * DAY)],
    BB2002: [material(3, 2, 21, now - DAY)],
    CC3003: [material(4, 3, 31, now - 30 * DAY)],
  },
  tasks: [],
};

describe("weekSections", () => {
  it("this week: each course's newest module, newest course first, none for a quiet course", () => {
    const sections = weekSections(input, t, now, "this");
    expect(sections.map((s) => [s.course.code, s.entry.id])).toEqual([
      ["BB2002", "21"],
      ["AA1001", "12"],
    ]);
  });

  it("last week: the module from 7 to 14 days ago", () => {
    expect(weekSections(input, t, now, "last").map((s) => [s.course.code, s.entry.id])).toEqual([["AA1001", "11"]]);
  });
});
