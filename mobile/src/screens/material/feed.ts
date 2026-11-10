// Materi's feed (/material): what the lecturers posted across this term's courses, newest first, in weeks. No React
// here, tested in Node (test/mobile/material-feed.test.ts). Each course's contents are worked out exactly as its Modul
// tab does (contentsOf, ../course/contents.ts). The weeks are calendar weeks, Monday to Sunday (./weeks.ts), as Tugas's
// are: on Thu 8 Oct, "Minggu ini" is 5–11 Oct, "Minggu lalu" 28 Sep–4 Oct, and 24 Sep is "Sebelumnya".
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
  /** A lecturer's item; null for a module that holds Tasks only, listed by its own title. */
  material: Material | null;
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

/** One course's opened modules as things to open: every material at its own date, a module with Tasks only at its own. */
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
    if (!entry.materials.length && entry.tasks.length && !entry.intro)
      items.push({ key: `${code}:e${entry.id}`, code, course, module, at: entry.postedAt, material: null, title: entry.title });
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

/** A line of the list, for FlashList: a week's heading or an item (its course is its colour and its quiet line). */
export type FeedLine =
  | { type: "week"; key: string; week: FeedWeek; count: number; first: boolean; fold: "open" | "closed" | null }
  | { type: "item"; key: string; item: FeedItem; last: boolean };

/** This many items or fewer over "Sebelumnya" leave room on the first screen: it starts open under them. */
export const SHORT = 5;

/**
 * The feed as lines, a week's items by course (one colour together), newest course first. "Sebelumnya" folds only when
 * what's newer is long enough to fill the screen (more than `SHORT` items); `toggled` flips it from where it starts.
 * When it's all there is, it's simply the list.
 */
export function feedLines(sections: readonly FeedSection[], toggled: boolean): FeedLine[] {
  const lines: FeedLine[] = [];
  const newer = sections.reduce((sum, section) => sum + (section.week === "earlier" ? 0 : section.count), 0);
  sections.forEach((section, s) => {
    const foldable = section.week === "earlier" && newer > 0;
    const open = !foldable || newer <= SHORT !== toggled;
    lines.push({
      type: "week",
      key: `week:${section.week}`,
      week: section.week,
      count: section.count,
      first: s === 0,
      fold: foldable ? (open ? "open" : "closed") : null,
    });
    if (!open) return;
    const items = section.courses.flatMap((course) => course.items);
    items.forEach((item, i) => {
      lines.push({ type: "item", key: `${section.week}:${item.key}`, item, last: i === items.length - 1 });
    });
  });
  return lines;
}

export const feedLineType = (line: FeedLine) => line.type;
