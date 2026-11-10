// Materi's feed (/material): what the lecturers posted across this term's courses, newest first, in weeks. No React
// here, tested in Node (test/mobile/material-feed.test.ts). Each course's contents are worked out exactly as its Modul
// tab does (contentsOf, ../course/contents.ts), and "Minggu ini" is the Modul tab's own rule (newestEntry there: in the
// last 7 days), so a module marked "Minggu ini" on its course has its items under "Minggu ini" here.
import type { TermCourse } from "../../../../src/app/courses";
import type { Translate } from "../../../../src/app/i18n";
import type { CoursePage } from "../../../../src/app/screens/course/data";
import type { CourseOutline, Material, Task } from "../../../../src/core/models";
import { contentsOf, type Entry, WEEK } from "../course/contents";

/** Where an item sits: posted in the last 7 days, the 7 before, or longer ago (or with no date). */
export type FeedWeek = "thisWeek" | "lastWeek" | "earlier";

export interface FeedItem {
  key: string;
  code: string;
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

/** The same rule as the Modul tab's "Minggu ini" (newestEntry): within the last 7 days, not ahead of now. */
export function weekOf(at: number | null, now: number): FeedWeek {
  if (at === null || at > now) return "earlier";
  if (at > now - WEEK) return "thisWeek";
  return at > now - 2 * WEEK ? "lastWeek" : "earlier";
}

/** One course's opened modules as things to open: every material at its own date, a module with Tasks only at its own. */
export function courseItems(code: string, entries: readonly Entry[]): FeedItem[] {
  const items: FeedItem[] = [];
  for (const entry of entries) {
    if (entry.unopened) continue;
    const module = Number(entry.id);
    for (const material of entry.materials)
      items.push({
        key: `${code}:m${material.id}`,
        code,
        module,
        at: material.postedAt ?? material.updatedAt ?? entry.postedAt,
        material,
        title: material.title,
      });
    if (!entry.materials.length && entry.tasks.length && !entry.intro)
      items.push({ key: `${code}:e${entry.id}`, code, module, at: entry.postedAt, material: null, title: entry.title });
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
    const items = courseItems(source.course.code, contentsOf(page, t));
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

/** A line of the list, for FlashList: a week's heading, a course's name (the way to the course), or an item. */
export type FeedLine =
  | { type: "week"; key: string; week: FeedWeek; count: number; first: boolean; fold: "open" | "closed" | null }
  | { type: "course"; key: string; code: string; name: string }
  | { type: "item"; key: string; item: FeedItem; last: boolean };

/**
 * The feed as lines. "Sebelumnya" is folded while something newer leads the page (`earlierOpen` opens it); when it's
 * all there is, it's simply the list.
 */
export function feedLines(sections: readonly FeedSection[], earlierOpen: boolean): FeedLine[] {
  const lines: FeedLine[] = [];
  const onlyEarlier = sections.length === 1 && sections[0]!.week === "earlier";
  sections.forEach((section, s) => {
    const foldable = section.week === "earlier" && !onlyEarlier;
    const open = !foldable || earlierOpen;
    lines.push({
      type: "week",
      key: `week:${section.week}`,
      week: section.week,
      count: section.count,
      first: s === 0,
      fold: foldable ? (open ? "open" : "closed") : null,
    });
    if (!open) return;
    for (const course of section.courses) {
      lines.push({ type: "course", key: `course:${section.week}:${course.code}`, code: course.code, name: course.name });
      course.items.forEach((item, i) => {
        lines.push({ type: "item", key: `${section.week}:${item.key}`, item, last: i === course.items.length - 1 });
      });
    }
  });
  return lines;
}

export const feedLineType = (line: FeedLine) => line.type;
