// Materi's contents (mobile/src/screens/material/courses.ts): the term's courses to pick from and, under the picked
// one, its modules in Edunex's order with their material, worked out from each course's contents as its own tab does.
import { describe, expect, it } from "vitest";
import type { Entry } from "../../mobile/src/screens/course/contents";
import { newestEntry } from "../../mobile/src/screens/course/contents";
import {
  type CourseSource,
  courseLines,
  courseModules,
  type MaterialCourse,
  materialCourses,
  pickCourse,
  SHOWN,
  startIndex,
} from "../../mobile/src/screens/material/courses";
import { postedThisWeek, weeksAgo } from "../../mobile/src/screens/material/weeks";
import type { Material } from "../../src/core/models";

const NOW = Date.UTC(2026, 10, 11, 3);
const DAY = 24 * 3_600_000;
const t = ((key: string) => key) as never;

const material = (id: number, title: string, postedAt: number | null, more: Partial<Material> = {}) =>
  ({
    id,
    courseId: 7,
    moduleId: null,
    title,
    type: "pdf",
    content: null,
    postedAt,
    updatedAt: null,
    createdBy: null,
    sizeBytes: null,
    ...more,
  }) as unknown as Material;

const entry = (id: string, more: Partial<Entry>): Entry => ({
  id,
  label: id,
  title: `Modul ${id}`,
  intro: false,
  parent: false,
  unopened: false,
  opensAt: null,
  postedAt: null,
  tasks: [],
  materials: [],
  ...more,
});

const source = (code: string, name: string, materials: Material[] | undefined): CourseSource => ({
  course: { code, name, edunex: { courseId: 7, relatedCourseIds: [] } } as never,
  outline: undefined,
  materials,
  tasks: [],
});

const many = (count: number, from = 100) => Array.from({ length: count }, (_, i) => material(from + i, `Berkas ${i + 1}`, NOW - 40 * DAY));

const course = (modules: Entry[], code = "PL3002"): MaterialCourse => ({
  code,
  name: code,
  fresh: 0,
  newestAt: null,
  modules: courseModules(code, modules, NOW),
});

describe("what counts as new on Materi", () => {
  it("goes by calendar weeks, Monday to Sunday, as Tugas does", () => {
    // NOW is Wed 11 Nov, 10:00 WIB: this week is Mon 9 to Sun 15 Nov.
    expect(postedThisWeek(NOW - DAY, NOW)).toBe(true);
    expect(postedThisWeek(NOW - 2 * DAY, NOW)).toBe(true);
    expect(postedThisWeek(NOW - 3 * DAY, NOW)).toBe(false);
    expect(weeksAgo(NOW - 9 * DAY, NOW)).toBe(1);
    expect(postedThisWeek(null, NOW)).toBe(false);
    expect(postedThisWeek(NOW + DAY, NOW)).toBe(false);
  });

  it("puts the demo's dates where a student would: on Thu 8 Oct, 5 Oct is this week and 1 Oct isn't", () => {
    const wib = (day: string, time: string) => Date.parse(`${day}T${time}:00+07:00`);
    const thursday = wib("2026-10-08", "08:07");
    expect(postedThisWeek(wib("2026-10-05", "16:52"), thursday)).toBe(true);
    expect(postedThisWeek(wib("2026-10-05", "00:00"), thursday)).toBe(true);
    expect(postedThisWeek(wib("2026-10-04", "23:59"), thursday)).toBe(false);
    expect(postedThisWeek(wib("2026-10-01", "09:00"), thursday)).toBe(false);
  });

  it("agrees with the course tab's own mark: the module it marks is the one holding this week's item", () => {
    const entries = [
      entry("1", { materials: [material(1, "Silabus", NOW - 30 * DAY)] }),
      entry("2", { materials: [material(2, "Slide minggu 9", NOW - 2 * DAY)] }),
    ];
    const modules = courseModules("PL3002", entries, NOW);
    const fresh = modules.filter((module) => module.items.some((item) => item.fresh));
    expect(fresh.map((module) => module.id)).toEqual([newestEntry(entries, NOW)?.id]);
    expect(fresh[0]?.current).toBe("week");
  });
});

describe("a course's modules", () => {
  it("keeps Edunex's order and the lecturer's order inside a module, whatever the dates", () => {
    const modules = courseModules(
      "PL3002",
      [
        entry("1", { materials: [material(1, "Silabus", NOW - 5 * DAY), material(2, "Kontrak", NOW - 60 * DAY)] }),
        entry("2", { materials: [material(3, "Slide 2", NOW - 50 * DAY)] }),
        entry("3", { materials: [material(4, "Slide 3", NOW - DAY)] }),
      ],
      NOW,
    );
    expect(modules.map((module) => module.label)).toEqual(["1", "2", "3"]);
    expect(modules[0]?.items.map((item) => item.material.title)).toEqual(["Silabus", "Kontrak"]);
  });

  it("leaves out a module that only holds a Task, an empty one and one the lecturer hasn't opened", () => {
    const modules = courseModules(
      "PL3002",
      [
        entry("3", { materials: [material(5, "Bab 3", NOW - 20 * DAY)] }),
        entry("4", { postedAt: NOW - 2 * DAY, tasks: [{ id: 1 } as never] }),
        entry("5", {}),
        entry("6", { unopened: true, materials: [material(7, "Belum dibuka", NOW - DAY)] }),
      ],
      NOW,
    );
    expect(modules.map((module) => module.id)).toEqual(["3"]);
    expect(modules[0]?.items[0]).toMatchObject({ key: "PL3002:m5", code: "PL3002", module: 3, fresh: false });
  });

  it("marks one module: the one new material came to this week, else the one that got material last", () => {
    const quiet = [entry("1", { materials: [material(1, "Lama", NOW - 40 * DAY)] }), entry("2", { materials: [material(2, "Lebih baru", NOW - 12 * DAY)] })];
    expect(courseModules("PL3002", quiet, NOW).map((module) => module.current)).toEqual([null, "latest"]);
    const busy = [...quiet, entry("3", { materials: [material(3, "Minggu ini", NOW - DAY)] })];
    expect(courseModules("PL3002", busy, NOW).map((module) => module.current)).toEqual([null, null, "week"]);
  });

  it("dates an item by when it was posted, else changed, else its module's date", () => {
    const [module] = courseModules(
      "PL3002",
      [entry("3", { postedAt: NOW - DAY, materials: [material(5, "Diubah", null, { updatedAt: NOW - 30 * DAY }), material(6, "Tanpa tanggal", null)] })],
      NOW,
    );
    expect(module?.items.map((item) => item.fresh)).toEqual([false, true]);
  });
});

describe("the term's courses", () => {
  const sources = [
    source("AA1001", "Lama", [material(1, "Silabus", NOW - 40 * DAY)]),
    source("BB2002", "Kosong", []),
    source("CC3003", "Baru", [material(2, "Slide", NOW - DAY), material(3, "Bacaan", NOW - 2 * DAY), material(4, "Dulu", NOW - 30 * DAY)]),
    source("DD4004", "Belum dijawab", undefined),
  ];

  it("lists every course in the term's order, one with nothing posted too, and counts what came this week", () => {
    const courses = materialCourses(sources, t, NOW);
    expect(courses.map((item) => [item.code, item.fresh, item.modules.length])).toEqual([
      ["AA1001", 0, 1],
      ["BB2002", 0, 0],
      ["CC3003", 2, 1],
      ["DD4004", 0, 0],
    ]);
  });

  it("opens on the course last picked, while the term still has it", () => {
    const courses = materialCourses(sources, t, NOW);
    expect(pickCourse(courses, "AA1001")).toBe("AA1001");
    expect(pickCourse(courses, "BB2002")).toBe("BB2002");
    expect(pickCourse(courses, "ZZ9999")).toBe("CC3003");
  });

  it("opens, the first time, on the course something was posted to last; on the first one when nothing was", () => {
    expect(pickCourse(materialCourses(sources, t, NOW), null)).toBe("CC3003");
    expect(pickCourse(materialCourses([source("AA1001", "A", []), source("BB2002", "B", [])], t, NOW), null)).toBe("AA1001");
    expect(pickCourse([], null)).toBeNull();
  });
});

describe("the picked course's list", () => {
  it("shows every module open, a heading then its items, so a file is one tap from the list", () => {
    const lines = courseLines(
      course([
        entry("1", { materials: [material(1, "Silabus", NOW - 40 * DAY)] }),
        entry("2", { materials: [material(2, "A", NOW - DAY), material(3, "B", NOW - DAY)] }),
      ]),
      new Set(),
    );
    expect(lines.map((line) => line.type)).toEqual(["module", "item", "module", "item", "item"]);
    expect(lines.map((line) => "first" in line && line.first)).toEqual([true, true, false, true, false]);
  });

  it("opens at the module the course is on, and at the top when there is none", () => {
    const lines = courseLines(
      course([
        entry("1", { materials: [material(1, "Silabus", NOW - 40 * DAY), material(2, "Kontrak", NOW - 40 * DAY)] }),
        entry("2", { materials: [material(3, "Minggu ini", NOW - DAY)] }),
        entry("3", { materials: [material(4, "Tanpa tanggal", null)] }),
      ]),
      new Set(),
    );
    expect(startIndex(lines)).toBe(3);
    expect(startIndex(courseLines(course([entry("1", { materials: [material(1, "Tanpa tanggal", null)] })]), new Set()))).toBe(0);
    expect(startIndex([])).toBe(0);
  });

  it("says the joint class once, over its first module, and opens there when the course is on that module", () => {
    const lines = courseLines(
      course([
        entry("1", { materials: [material(1, "Silabus", NOW - 40 * DAY)] }),
        entry("8", { label: "1", parent: true, materials: [material(2, "Minggu ini", NOW - DAY)] }),
        entry("9", { label: "2", parent: true, materials: [material(3, "Lama", NOW - 40 * DAY)] }),
      ]),
      new Set(),
    );
    expect(lines.map((line) => line.type)).toEqual(["module", "item", "joint", "module", "item", "module", "item"]);
    expect(startIndex(lines)).toBe(2);
  });

  it("cuts a long module to its first few and one line for the rest, which a tap opens", () => {
    const long = course([entry("1", { materials: many(SHOWN + 3) }), entry("2", { materials: [material(1, "Minggu ini", NOW - DAY)] })]);
    const lines = courseLines(long, new Set());
    expect(lines.filter((line) => line.type === "item")).toHaveLength(SHOWN + 1);
    expect(lines.find((line) => line.type === "more")).toMatchObject({ module: "1", count: 3 });
    const opened = courseLines(long, new Set(["1"]));
    expect(opened.filter((line) => line.type === "item")).toHaveLength(SHOWN + 4);
    expect(opened.some((line) => line.type === "more")).toBe(false);
  });

  it("shows one or two left over instead of a line that opens them, and the module the course is on whole", () => {
    const short = courseLines(
      course([entry("1", { materials: many(SHOWN + 2) }), entry("2", { materials: [material(1, "Minggu ini", NOW - DAY)] })]),
      new Set(),
    );
    expect(short.some((line) => line.type === "more")).toBe(false);
    const current = courseLines(course([entry("1", { materials: [...many(SHOWN + 5), material(1, "Minggu ini", NOW - DAY)] })]), new Set());
    expect(current.some((line) => line.type === "more")).toBe(false);
  });
});
