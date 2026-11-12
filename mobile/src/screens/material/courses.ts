// Materi's contents (/material): the term's courses to pick from, and under the picked one its modules in Edunex's own
// order with their material right there. No React here, tested in Node (test/mobile/material-courses.test.ts). Each
// course's contents are worked out exactly as its Materi tab does (contentsOf, ../course/contents.ts), so the two
// pages list the same things in the same order under the same names. Only material is listed: a module the lecturer
// made to hold a Task or an exam ("Tugas", "UTS Markom") has none and stays out (its Task is on Tugas), and so does a
// module the lecturer hasn't opened. "New" is the one rule the course's tab has: posted in this calendar week
// (./weeks.ts). Nothing is sorted by date: the module the course is on is marked, and the page opens at it.
import type { TermCourse } from "../../../../src/app/courses";
import type { Translate } from "../../../../src/app/i18n";
import type { CoursePage } from "../../../../src/app/screens/course/data";
import type { CourseOutline, Material, Task } from "../../../../src/core/models";
import { contentsOf, currentEntry, type Entry } from "../course/contents";
import { postedThisWeek } from "./weeks";

/** What a course's page reads for its contents, without the rest of the page. */
export interface CourseSource {
  course: TermCourse;
  outline: CourseOutline | undefined;
  materials: Material[] | undefined;
  tasks: Task[];
}

export interface MaterialItem {
  key: string;
  code: string;
  /** The module it's in (an Introduction's own id for course-wide items): its screen is /course/<code>/module/<id>. */
  module: number;
  material: Material;
  /** Posted this calendar week. */
  fresh: boolean;
}

export interface MaterialModule {
  id: string;
  /** Edunex's number for a module; null for an Introduction. */
  label: string | null;
  title: string;
  /** The joint class's module (both classes can have a Modul 1). */
  parent: boolean;
  /** The module the course is on: new material came to it this week, else it got material most recently. */
  current: "week" | "latest" | null;
  /** In the lecturer's order, as the module's own page lists them. */
  items: MaterialItem[];
}

export interface MaterialCourse {
  code: string;
  name: string;
  /** How many items came this week: the mark on its chip. */
  fresh: number;
  /** When its newest item was posted; null with nothing posted, or no dates. */
  newestAt: number | null;
  modules: MaterialModule[];
}

const postedAt = (material: Material, entry: Entry) => material.postedAt ?? material.updatedAt ?? entry.postedAt;

/** One course's opened modules that hold material, in Edunex's order, each with its items in the lecturer's order. */
export function courseModules(code: string, entries: readonly Entry[], now: number): MaterialModule[] {
  const withMaterial = entries.filter((entry) => !entry.unopened && entry.materials.length > 0);
  const current = currentEntry(withMaterial, now);
  return withMaterial.map((entry) => ({
    id: entry.id,
    label: entry.intro ? null : entry.label,
    title: entry.title,
    parent: entry.parent,
    current: current?.entry !== entry ? null : current.thisWeek ? "week" : "latest",
    items: entry.materials.map((material) => ({
      key: `${code}:m${material.id}`,
      code,
      module: Number(entry.id),
      material,
      fresh: postedThisWeek(postedAt(material, entry), now),
    })),
  }));
}

/**
 * Every course of the term in the term's own order (as Kuliah lists them), so a course's chip never moves. A course
 * with nothing posted, or one Edunex hasn't answered for yet, is still there to pick, with no modules.
 */
export function materialCourses(sources: readonly CourseSource[], t: Translate, now: number): MaterialCourse[] {
  return sources.map((source) => {
    const { code, name } = source.course;
    if (source.materials === undefined) return { code, name, fresh: 0, newestAt: null, modules: [] };
    const page = { ...source, presence: undefined, announcements: undefined, exams: [], meetings: [], inSix: false } satisfies CoursePage;
    const entries = contentsOf(page, t);
    const modules = courseModules(code, entries, now);
    let newestAt: number | null = null;
    for (const entry of entries)
      for (const material of entry.unopened ? [] : entry.materials) {
        const at = postedAt(material, entry);
        if (at !== null && at <= now && (newestAt === null || at > newestAt)) newestAt = at;
      }
    const fresh = modules.reduce((sum, module) => sum + module.items.filter((item) => item.fresh).length, 0);
    return { code, name, fresh, newestAt, modules };
  });
}

/**
 * The course the page shows: the one last picked, while it's still in the term; else the one something was posted to
 * most recently (so "what's new" is the first thing seen); else the term's first. Null with no courses.
 */
export function pickCourse(courses: readonly MaterialCourse[], remembered: string | null): string | null {
  if (remembered !== null && courses.some((course) => course.code === remembered)) return remembered;
  let best: MaterialCourse | undefined;
  for (const course of courses) if (course.newestAt !== null && (!best || course.newestAt > best.newestAt!)) best = course;
  return (best ?? courses[0])?.code ?? null;
}

/**
 * A line of the list, for FlashList: a module's heading, one of its items, the way to the rest of a long module, or
 * the title over the joint class's modules (said once, as the course's tab says it).
 */
export type MaterialLine =
  | { type: "joint"; key: string }
  | { type: "module"; key: string; module: MaterialModule; first: boolean }
  | { type: "item"; key: string; item: MaterialItem; first: boolean }
  | { type: "more"; key: string; module: string; count: number };

/** A long module shows this many items, then one line that opens the rest. */
export const SHOWN = 5;

/**
 * The picked course as lines: every module open, its items under its heading, so any file is one tap from the list.
 * A module of more than `SHOWN` + 2 items shows its first `SHOWN` and one line for the rest (one or two left over
 * aren't worth a line of their own); the module the course is on, and one in `opened`, show whole.
 */
export function courseLines(course: MaterialCourse, opened: ReadonlySet<string>): MaterialLine[] {
  const lines: MaterialLine[] = [];
  let joint = false;
  for (const module of course.modules) {
    if (module.parent && !joint) {
      joint = true;
      lines.push({ type: "joint", key: "joint" });
    }
    lines.push({ type: "module", key: `module:${module.id}`, module, first: lines.length === 0 });
    const whole = module.current !== null || opened.has(module.id) || module.items.length <= SHOWN + 2;
    const items = whole ? module.items : module.items.slice(0, SHOWN);
    items.forEach((item, i) => {
      lines.push({ type: "item", key: item.key, item, first: i === 0 });
    });
    if (!whole) lines.push({ type: "more", key: `more:${module.id}`, module: module.id, count: module.items.length - SHOWN });
  }
  return lines;
}

/**
 * Where the list opens: the heading of the module the course is on (the top, when there is none); the joint class's
 * title when that module is the first under it, so whose module it is stays in sight.
 */
export function startIndex(lines: readonly MaterialLine[]): number {
  const at = lines.findIndex((line) => line.type === "module" && line.module.current !== null);
  if (at === -1) return 0;
  return lines[at - 1]?.type === "joint" ? at - 1 : at;
}

export const lineType = (line: MaterialLine) => line.type;
