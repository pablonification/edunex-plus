// The Modul tab's table of contents, worked out as the desktop does: contentsOf, latest, countFacts and
// dayAndTime are copied from src/app/screens/course/modules.tsx (DOM-free helpers in a file with DOM
// parts). Keep them the same as there.
import type { Format, Translate } from "../../../../src/app/i18n";
import type { CoursePage } from "../../../../src/app/screens/course/data";
import { contentCounts, introModule, outlineEntries } from "../../../../src/core/course-materials";
import type { Material, Task } from "../../../../src/core/models";

export const WEEK = 7 * 24 * 3_600_000;

export interface Entry {
  id: string;
  /** Edunex's number for a module; null for an Introduction. */
  label: string | null;
  title: string;
  /** An Edunex course's course-wide items. */
  intro: boolean;
  parent: boolean;
  /** Listed on Edunex but not opened yet by the lecturer: greyed, nothing to pick. */
  unopened: boolean;
  /** When Edunex opens it by itself, if the lecturer set a date. */
  opensAt: number | null;
  postedAt: number | null;
  tasks: Task[];
  materials: Material[];
}

export const latest = (entry: Pick<Entry, "postedAt" | "materials">) =>
  Math.max(entry.postedAt ?? 0, ...entry.materials.map((m) => m.postedAt ?? m.updatedAt ?? 0)) || null;

/** "2 PDF", "4 tugas": what's in it; how many Tasks are still open shows as its own chip. */
export const countFacts = (t: Translate, entry: Entry) =>
  contentCounts(entry.materials, entry.tasks.length).map(({ kind, count }) => t(`course.kind.${kind}`, { count }));

/**
 * "28 Agu 14:01", as Edunex writes an item's times. The desktop keeps it on one line with no-break
 * spaces; on the phone plain spaces, so the words read (and are found) as the same text.
 */
export const dayAndTime = (f: Format, when: number) => `${f.dayMonth(when)} ${f.time(when)}`;

/**
 * The table of contents, Edunex course by Edunex course (the class's own, then each joint class's):
 * its Introduction, when it has course-wide items, then every module Edunex lists, in Edunex's
 * order. An item in both courses shows once under each.
 */
export function contentsOf(page: CoursePage, t: Translate): Entry[] {
  const { course, outline } = page;
  const materials = page.materials ?? [];
  const main = course.edunex?.courseId ?? -1;
  const modules = outline ? outlineEntries(outline, main) : [];
  const known = new Set(modules.map((entry) => entry.module.id));
  const wideTasks = page.tasks.filter((task) => task.moduleId === null || !known.has(task.moduleId));
  const wideMaterials = materials.filter((m) => m.moduleId === null);
  const courseIds = [
    ...new Set([
      main,
      ...(course.edunex?.relatedCourseIds ?? []),
      ...modules.map((entry) => entry.module.courseId),
      ...(outline?.unopened ?? []).map((module) => module.courseId),
      ...wideMaterials.map((m) => m.courseId),
      ...wideTasks.map((task) => task.courseId),
    ]),
  ];
  return courseIds.flatMap((courseId): Entry[] => {
    const parent = courseId !== main;
    const intro = { tasks: wideTasks.filter((task) => task.courseId === courseId), materials: wideMaterials.filter((m) => m.courseId === courseId) };
    const opened = modules
      .filter((entry) => entry.module.courseId === courseId)
      .map((entry) => ({
        number: entry.number,
        id: String(entry.module.id),
        label: String(entry.number),
        title: entry.module.title,
        intro: false,
        parent,
        unopened: false,
        opensAt: null,
        postedAt: entry.module.postedAt,
        tasks: page.tasks.filter((task) => task.moduleId === entry.module.id),
        materials: materials.filter((m) => m.moduleId === entry.module.id),
      }));
    const unopened = (outline?.unopened ?? [])
      .filter((module) => module.courseId === courseId)
      .map((module) => ({
        number: module.number,
        id: String(module.id),
        label: String(module.number),
        title: module.title,
        intro: false,
        parent,
        unopened: true,
        opensAt: module.opensAt,
        postedAt: null,
        tasks: [],
        materials: [],
      }));
    return [
      ...(intro.tasks.length || intro.materials.length
        ? [
            {
              id: String(introModule(courseId)),
              label: null,
              title: t("course.intro"),
              intro: true,
              parent,
              unopened: false,
              opensAt: null,
              postedAt: null,
              ...intro,
            },
          ]
        : []),
      ...[...opened, ...unopened].sort((a, b) => a.number - b.number).map(({ number: _number, ...entry }) => entry),
    ];
  });
}

/**
 * A module row's testID part: its first fact as the desktop's list shows it ("Modul 4" → "modul-4";
 * an Introduction by its first count, "2 catatan" → "2-catatan"), slugged as the inventory names the
 * module's state (mobile/scripts/inventory.mjs), so a flow finds the row by the state it checks.
 */
export function entrySlug(t: Translate, entry: Entry): string {
  const first = entry.intro ? (countFacts(t, entry)[0] ?? entry.title) : t("course.module", { no: entry.label ?? "" });
  return first
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}
