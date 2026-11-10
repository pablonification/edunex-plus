// Materi's feed (mobile/src/screens/material/feed.ts): what the lecturers posted across the term's courses, by week,
// worked out from each course's contents as its Modul tab does.
import { describe, expect, it } from "vitest";
import type { Entry } from "../../mobile/src/screens/course/contents";
import { newestEntry, WEEK } from "../../mobile/src/screens/course/contents";
import { type CourseSource, courseItems, feedLines, materialFeed, weekOf } from "../../mobile/src/screens/material/feed";
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

describe("Materi's weeks", () => {
  it("calls the last 7 days this week, the 7 before last week, and the rest earlier", () => {
    expect(weekOf(NOW - DAY, NOW)).toBe("thisWeek");
    expect(weekOf(NOW - WEEK + 1, NOW)).toBe("thisWeek");
    expect(weekOf(NOW - WEEK, NOW)).toBe("lastWeek");
    expect(weekOf(NOW - 2 * WEEK, NOW)).toBe("earlier");
    expect(weekOf(null, NOW)).toBe("earlier");
    expect(weekOf(NOW + DAY, NOW)).toBe("earlier");
  });

  it("agrees with the Modul tab's own mark: the module it marks has an item under this week", () => {
    const entries = [
      entry("1", { materials: [material(1, "Silabus", NOW - 30 * DAY)] }),
      entry("2", { materials: [material(2, "Slide minggu 9", NOW - 2 * DAY)] }),
    ];
    const marked = newestEntry(entries, NOW);
    const thisWeek = courseItems("PL3002", entries).filter((item) => weekOf(item.at, NOW) === "thisWeek");
    expect(thisWeek.map((item) => item.module)).toEqual([Number(marked?.id)]);
  });
});

describe("a course's items", () => {
  it("lists every material of an opened module, a module with Tasks only by its own title, and nothing unopened", () => {
    const items = courseItems("PL3002", [
      entry("3", { postedAt: NOW - DAY, materials: [material(5, "Bab 3", null, { updatedAt: NOW - 3 * DAY }), material(6, "Tanpa tanggal", null)] }),
      entry("4", { postedAt: NOW - 2 * DAY, tasks: [{ id: 1 } as never] }),
      entry("5", { unopened: true, materials: [material(9, "Belum dibuka", NOW)] }),
      entry("6", {}),
    ]);
    expect(items.map((item) => [item.title, item.module, item.at, item.material?.id ?? null])).toEqual([
      ["Bab 3", 3, NOW - 3 * DAY, 5],
      ["Tanpa tanggal", 3, NOW - DAY, 6],
      ["Modul 4", 4, NOW - 2 * DAY, null],
    ]);
  });
});

describe("the feed", () => {
  const sources = [
    source("PL3002", "Perencanaan Kota", [material(1, "Lama", NOW - 40 * DAY), material(2, "Kemarin", NOW - DAY)]),
    source("DK4073", "Tipografi", [material(3, "Tadi", NOW - 3_600_000), material(4, "Minggu lalu", NOW - 9 * DAY)]),
    source("II4091", "Belum dibaca", undefined),
  ];

  it("puts this week first, each week by course with the newest course first", () => {
    const feed = materialFeed(sources, t, NOW);
    expect(feed.map((section) => [section.week, section.count, section.courses.map((course) => course.code)])).toEqual([
      ["thisWeek", 2, ["DK4073", "PL3002"]],
      ["lastWeek", 1, ["DK4073"]],
      ["earlier", 1, ["PL3002"]],
    ]);
  });

  it("folds what's earlier while something newer leads, and opens it when asked", () => {
    const feed = materialFeed(sources, t, NOW);
    const closed = feedLines(feed, false);
    expect(closed.at(-1)).toMatchObject({ type: "week", week: "earlier", fold: "closed", count: 1 });
    expect(closed.filter((line) => line.type === "item")).toHaveLength(3);
    const open = feedLines(feed, true);
    expect(open.filter((line) => line.type === "item")).toHaveLength(4);
    expect(new Set(open.map((line) => line.key)).size).toBe(open.length);
  });

  it("shows earlier material unfolded when it's all there is", () => {
    const feed = materialFeed([source("PL3002", "Perencanaan Kota", [material(1, "Lama", NOW - 40 * DAY)])], t, NOW);
    expect(feedLines(feed, false).map((line) => line.type)).toEqual(["week", "course", "item"]);
    expect(feedLines(feed, false)[0]).toMatchObject({ fold: null, first: true });
  });

  it("is empty when no course has anything", () => {
    expect(materialFeed([source("PL3002", "Perencanaan Kota", [])], t, NOW)).toEqual([]);
  });
});
