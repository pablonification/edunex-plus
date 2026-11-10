// Materi's feed (/material): what the lecturers posted across this term's courses, newest first, in weeks. No React
// here, tested in Node (test/mobile/material-feed.test.ts). Each course's contents are worked out exactly as its Modul
// tab does (contentsOf, ../course/contents.ts). The weeks are calendar weeks, Monday to Sunday (./weeks.ts), as Tugas's
// are: on Thu 8 Oct, "Minggu ini" is 5–11 Oct, "Minggu lalu" 28 Sep–4 Oct, and 24 Sep is "Sebelumnya". Only material is
// listed: a module the lecturer made to hold a Task or an exam ("Tugas", "UTS Markom") has none, and stays out.
import type { TermCourse } from "../../../../src/app/courses";
import type { Translate } from "../../../../src/app/i18n";
import type { CoursePage } from "../../../../src/app/screens/course/data";
import type { CourseOutline, Material, Task } from "../../../../src/core/models";
import { contentsOf, type Entry } from "../course/contents";
import { weeksAgo } from "./weeks";

/** Where an item sits: posted in this calendar week, the one before, or longer ago (or with no date). */
export type FeedWeek = "thisWeek" | "lastWeek" | "earlier";

export interface FeedItem {
  key: string;
  code: string;
  /** Its course's name, for the row's quiet line. */
  course: string;
  /** The module it's in (an Introduction's own id for course-wide items): its screen is /course/<code>/module/<id>. */
  module: number;
  /** When it was posted, else last changed; null when Edunex gives neither. */
  at: number | null;
  /** The lecturer's item. A module that only holds a Task or an exam isn't material: Tugas and Ujian list those. */
  material: Material;
  title: string;
}

/** One course's items of one week, newest first. */
export interface FeedCourse {
  code: string;
  name: string;
  items: FeedItem[];
}

export interface FeedSection {
  week: FeedWeek;
  count: number;
  courses: FeedCourse[];
}

/** What a course's page reads for its contents, without the rest of the page. */
export interface CourseSource {
  course: TermCourse;
  outline: CourseOutline | undefined;
  materials: Material[] | undefined;
  tasks: Task[];
}

/** Calendar weeks (./weeks.ts): this one, the one before, and the rest; no date or a date ahead of now is "earlier". */
export function weekOf(at: number | null, now: number): FeedWeek {
  const ago = weeksAgo(at, now);
  return ago === 0 ? "thisWeek" : ago === 1 ? "lastWeek" : "earlier";
}

/**
 * One course's opened modules as things to open: every material at its own date. A module with no material in it (the
 * lecturer's "Tugas" or "UTS Markom", which hold a Task only) is left out: its Task is on Tugas, its exam on Ujian.
 */
export function courseItems(code: string, entries: readonly Entry[], course = code): FeedItem[] {
  const items: FeedItem[] = [];
  for (const entry of entries) {
    if (entry.unopened) continue;
    const module = Number(entry.id);
    for (const material of entry.materials)
      items.push({
        key: `${code}:m${material.id}`,
        code,
        course,
        module,
        at: material.postedAt ?? material.updatedAt ?? entry.postedAt,
        material,
        title: material.title,
      });
  }
  return items;
}

const newest = (a: FeedItem, b: FeedItem) => (b.at ?? 0) - (a.at ?? 0) || a.title.localeCompare(b.title);

/**
 * The feed: this week, last week, earlier (a week with nothing is left out), each by course (the course with the newest
 * item first). A course Edunex hasn't answered for yet (`materials` undefined) has nothing to show.
 */
export function materialFeed(sources: readonly CourseSource[], t: Translate, now: number): FeedSection[] {
  const weeks: Record<FeedWeek, FeedCourse[]> = { thisWeek: [], lastWeek: [], earlier: [] };
  for (const source of sources) {
    if (source.materials === undefined) continue;
    const page = { ...source, presence: undefined, announcements: undefined, exams: [], meetings: [], inSix: false } satisfies CoursePage;
    const items = courseItems(source.course.code, contentsOf(page, t), source.course.name);
    for (const week of ["thisWeek", "lastWeek", "earlier"] as const) {
      const mine = items.filter((item) => weekOf(item.at, now) === week).sort(newest);
      if (mine.length) weeks[week].push({ code: source.course.code, name: source.course.name, items: mine });
    }
  }
  return (["thisWeek", "lastWeek", "earlier"] as const)
    .map((week) => ({
      week,
      count: weeks[week].reduce((sum, course) => sum + course.items.length, 0),
      courses: weeks[week].sort((a, b) => newest(a.items[0]!, b.items[0]!) || a.code.localeCompare(b.code)),
    }))
    .filter((section) => section.count > 0);
}

/** A heading of the list: a week, or "Terbaru" (the newest few, when this week and last week have nothing). */
export type FeedHeading = FeedWeek | "latest";

/** A line of the list, for FlashList: a heading, a course's quiet name over its items, or an item. */
export type FeedLine =
  | { type: "week"; key: string; week: FeedHeading; count: number; first: boolean; fold: "open" | "closed" | null }
  | { type: "course"; key: string; code: string; name: string }
  | { type: "item"; key: string; item: FeedItem; last: boolean };

/** How many of the newest items stand in for "Minggu ini" when the last two weeks brought nothing. */
export const LATEST = 5;

const only = (courses: readonly FeedCourse[], keep: (item: FeedItem) => boolean): FeedCourse[] =>
  courses.map((course) => ({ ...course, items: course.items.filter(keep) })).filter((course) => course.items.length > 0);

/**
 * The feed as lines: "Minggu ini" and "Minggu lalu" open, each by course (the course's name, then its items), and
 * "Sebelumnya" folded under its count, so the first screen is what's new. `toggled` opens it. When the last two weeks
 * brought nothing, the newest `LATEST` items lead instead under "Terbaru", and the rest folds under "Sebelumnya".
 */
export function feedLines(sections: readonly FeedSection[], toggled: boolean): FeedLine[] {
  const lines: FeedLine[] = [];
  const group = (week: FeedHeading, courses: readonly FeedCourse[], fold: "open" | "closed" | null) => {
    const count = courses.reduce((sum, course) => sum + course.items.length, 0);
    if (!count) return;
    lines.push({ type: "week", key: `week:${week}`, week, count, first: lines.length === 0, fold });
    if (fold === "closed") return;
    for (const course of courses) {
      lines.push({ type: "course", key: `${week}:${course.code}`, code: course.code, name: course.name });
      course.items.forEach((item, i) => {
        lines.push({ type: "item", key: `${week}:${item.key}`, item, last: i === course.items.length - 1 });
      });
    }
  };
  const newer = sections.filter((section) => section.week !== "earlier");
  for (const section of newer) group(section.week, section.courses, null);
  let rest = sections.find((section) => section.week === "earlier")?.courses ?? [];
  if (!newer.length) {
    const top = new Set(
      rest
        .flatMap((course) => course.items)
        .sort(newest)
        .slice(0, LATEST),
    );
    group(
      "latest",
      only(rest, (item) => top.has(item)),
      null,
    );
    rest = only(rest, (item) => !top.has(item));
  }
  group("earlier", rest, toggled ? "open" : "closed");
  return lines;
}

export const feedLineType = (line: FeedLine) => line.type;
