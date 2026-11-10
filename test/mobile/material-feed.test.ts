// Materi's feed (mobile/src/screens/material/feed.ts): what the lecturers posted across the term's courses, by week,
// worked out from each course's contents as its Modul tab does.
import { describe, expect, it } from "vitest";
import type { Entry } from "../../mobile/src/screens/course/contents";
import { newestEntry } from "../../mobile/src/screens/course/contents";
import { type CourseSource, courseItems, feedLines, LATEST, materialFeed, weekOf } from "../../mobile/src/screens/material/feed";
import { postedThisWeek } from "../../mobile/src/screens/material/weeks";
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
  it("goes by calendar weeks, Monday to Sunday, as Tugas does", () => {
    // NOW is Wed 11 Nov, 10:00 WIB: this week is Mon 9 to Sun 15 Nov.
    expect(weekOf(NOW - DAY, NOW)).toBe("thisWeek");
    expect(weekOf(NOW - 2 * DAY, NOW)).toBe("thisWeek");
    expect(weekOf(NOW - 3 * DAY, NOW)).toBe("lastWeek");
    expect(weekOf(NOW - 9 * DAY, NOW)).toBe("lastWeek");
    expect(weekOf(NOW - 10 * DAY, NOW)).toBe("earlier");
    expect(weekOf(null, NOW)).toBe("earlier");
    expect(weekOf(NOW + DAY, NOW)).toBe("earlier");
  });

  it("puts the demo's dates where a student would: on Thu 8 Oct, 5 Oct is this week and 24 Sep is earlier, not last week", () => {
    const wib = (day: string, time: string) => Date.parse(`${day}T${time}:00+07:00`);
    const thursday = wib("2026-10-08", "08:07");
    expect(weekOf(wib("2026-10-05", "16:52"), thursday)).toBe("thisWeek");
    expect(weekOf(wib("2026-10-05", "00:00"), thursday)).toBe("thisWeek");
    expect(weekOf(wib("2026-10-04", "23:59"), thursday)).toBe("lastWeek");
    expect(weekOf(wib("2026-09-28", "00:00"), thursday)).toBe("lastWeek");
    expect(weekOf(wib("2026-09-27", "23:59"), thursday)).toBe("earlier");
    expect(weekOf(wib("2026-09-24", "15:58"), thursday)).toBe("earlier");
    expect(postedThisWeek(wib("2026-10-05", "16:52"), thursday)).toBe(true);
    expect(postedThisWeek(wib("2026-10-01", "09:00"), thursday)).toBe(false);
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
  it("lists every material of an opened module, and neither a module that only holds a Task nor anything unopened", () => {
    const items = courseItems("PL3002", [
      entry("3", { postedAt: NOW - DAY, materials: [material(5, "Bab 3", null, { updatedAt: NOW - 3 * DAY }), material(6, "Tanpa tanggal", null)] }),
      entry("4", { postedAt: NOW - 2 * DAY, tasks: [{ id: 1 } as never] }),
      entry("5", { unopened: true, materials: [material(9, "Belum dibuka", NOW)] }),
      entry("6", {}),
    ]);
    expect(items.map((item) => [item.title, item.module, item.at, item.material?.id ?? null])).toEqual([
      ["Bab 3", 3, NOW - 3 * DAY, 5],
      ["Tanpa tanggal", 3, NOW - DAY, 6],
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

  const shown = (lines: ReturnType<typeof feedLines>) =>
    lines.map((line) => (line.type === "item" ? line.item.title : line.type === "course" ? `# ${line.name}` : line.week));

  it("opens this week and last week by course, and folds what's earlier under its count until asked", () => {
    const feed = materialFeed(sources, t, NOW);
    const folded = feedLines(feed, false);
    expect(shown(folded)).toEqual(["thisWeek", "# Tipografi", "Tadi", "# Perencanaan Kota", "Kemarin", "lastWeek", "# Tipografi", "Minggu lalu", "earlier"]);
    expect(folded.at(-1)).toMatchObject({ type: "week", week: "earlier", fold: "closed", count: 1 });
    expect(folded[0]).toMatchObject({ first: true, fold: null });
    const open = feedLines(feed, true);
    expect(shown(open).slice(-3)).toEqual(["earlier", "# Perencanaan Kota", "Lama"]);
    expect(open.find((line) => line.type === "week" && line.week === "earlier")).toMatchObject({ fold: "open" });
    expect(new Set(open.map((line) => line.key)).size).toBe(open.length);
  });

  it("leads with the newest few when the last two weeks brought nothing, and folds the rest", () => {
    const old = Array.from({ length: LATEST + 2 }, (_, i) => material(10 + i, `Lama ${i}`, NOW - (20 + i) * DAY));
    const feed = materialFeed([source("PL3002", "Perencanaan Kota", old)], t, NOW);
    const lines = feedLines(feed, false);
    expect(shown(lines)).toEqual(["latest", "# Perencanaan Kota", "Lama 0", "Lama 1", "Lama 2", "Lama 3", "Lama 4", "earlier"]);
    expect(lines.at(-1)).toMatchObject({ fold: "closed", count: 2 });
    expect(shown(feedLines(feed, true)).slice(-3)).toEqual(["# Perencanaan Kota", "Lama 5", "Lama 6"]);
  });

  it("shows a few old items as the newest, with nothing folded under them", () => {
    const feed = materialFeed([source("PL3002", "Perencanaan Kota", [material(1, "Lama", NOW - 40 * DAY)])], t, NOW);
    expect(shown(feedLines(feed, false))).toEqual(["latest", "# Perencanaan Kota", "Lama"]);
    expect(feedLines(feed, false)[0]).toMatchObject({ fold: null, first: true });
  });

  it("is empty when no course has anything", () => {
    expect(materialFeed([source("PL3002", "Perencanaan Kota", [])], t, NOW)).toEqual([]);
  });
});
