// Quick search (#81): one index over what the app has saved (this term's
// courses, Tasks, exams, materials, modules and announcements) and the
// screens and tabs, and a matcher that forgives case, accents, word order and
// small typos. An exact course code ranks first, then prefix matches. Each
// distinct word is matched once per query, so a full term answers within a frame.
import { outlineEntries } from "./course-materials";
import { examRoute, examsFound, type FoundExam } from "./exam-sources";
import type { Announcement, Material, Task } from "./models";
import type { Route } from "./route";
import { courseName, inTerm, type Saved, termCourses } from "./saved";
import { type Lang, type StringKey, translate } from "./strings";
import { byDeadline, isOpenStatus, taskStatus } from "./tasks";

// ---------------------------------------------------------------- items

export type SearchKind = "course" | "task" | "exam" | "material" | "module" | "announcement" | "screen";

/** Where a result goes: a screen, or the Settings dialog. */
export type SearchTarget = Route | "settings";

/** The screens and tabs the palette opens by name. Each is also found by the words in "search.alias.<id>". */
export const SCREENS = {
  home: { label: "nav.home", target: { screen: "home" } },
  tasks: { label: "nav.tasks", target: { screen: "tasks" } },
  schedule: { label: "nav.schedule", target: { screen: "schedule" } },
  presence: { label: "nav.presence", target: { screen: "presence" } },
  grades: { label: "nav.grades", target: { screen: "grades" } },
  plan: { label: "nav.plan", target: { screen: "plan" } },
  "plan.planner": { label: "plan.tab.planner", within: "nav.plan", target: { screen: "plan", tab: "planner" } },
  "plan.curriculum": { label: "plan.tab.curriculum", within: "nav.plan", target: { screen: "plan", tab: "curriculum" } },
  "plan.krs": { label: "plan.tab.krs", within: "nav.plan", target: { screen: "plan", tab: "krs" } },
  "plan.bills": { label: "plan.tab.bills", within: "nav.plan", target: { screen: "plan", tab: "bills" } },
  "plan.deadlines": { label: "plan.tab.deadlines", within: "nav.plan", target: { screen: "plan", tab: "deadlines" } },
  settings: { label: "nav.settings", target: "settings" },
} as const satisfies Record<string, { label: StringKey; within?: StringKey; target: SearchTarget }>;
export type ScreenId = keyof typeof SCREENS;

/** A module's place in its course's outline, numbered as the course page numbers it. */
export interface ModulePlace {
  id: number;
  title: string;
  /** From 1, within its own EduNex course. */
  number: number;
  /** It sits in the class's parent course. */
  parent: boolean;
}

interface ItemBase {
  /** Unique in the index: "task:117003". */
  key: string;
  /** What the row shows first. */
  title: string;
  /** The course it belongs to; null for screens. */
  code: string | null;
  target: SearchTarget;
}

export type SearchItem =
  | (ItemBase & { kind: "course"; classNo: string | null; sks: number | null })
  | (ItemBase & { kind: "task"; task: Task })
  | (ItemBase & { kind: "exam"; exam: FoundExam })
  | (ItemBase & { kind: "material"; material: Material; module: ModulePlace | null })
  | (ItemBase & { kind: "module"; module: ModulePlace })
  | (ItemBase & { kind: "announcement"; announcement: Announcement })
  | (ItemBase & { kind: "screen"; screen: ScreenId; within: string | null });

export interface SearchGroup {
  kind: SearchKind;
  items: SearchItem[];
}

// ---------------------------------------------------------------- words

const PLAIN = /^[\x20-\x7e]*$/;

/** Lowercase, accents dropped, anything but letters and digits as one space. */
export function fold(text: string): string {
  // Most titles are plain ASCII: the quick way gives the same result.
  if (PLAIN.test(text)) return text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return text
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

const isDigit = (code: number) => code >= 48 && code <= 57;

/** The words of a folded text: "pl3002" also as "pl" and "3002", "02" also as "2". */
function wordsOf(folded: string): string[] {
  const words: string[] = [];
  for (const word of folded.split(" ")) {
    if (!word) continue;
    words.push(word);
    let start = 0;
    for (let i = 1; i <= word.length; i++) {
      if (i < word.length && isDigit(word.charCodeAt(i)) === isDigit(word.charCodeAt(i - 1))) continue;
      const part = word.slice(start, i);
      if (part !== word) words.push(part);
      if (part.length > 1 && part.charCodeAt(0) === 48 && isDigit(part.charCodeAt(1))) words.push(part.replace(/^0+(?=\d)/, ""));
      start = i;
    }
  }
  return words;
}

/** How much a word counts where it was found: the item's own name, another name for it, or what it belongs to. */
const TITLE = 1;
const ALIAS = 0.8;
const CONTEXT = 0.5;

/** Ties go to the kinds a Student most often jumps to. */
const KIND_BIAS: Record<SearchKind, number> = { course: 6, screen: 5, task: 4, exam: 4, module: 3, material: 2, announcement: 1 };

interface Entry {
  item: SearchItem;
  /** The folded title, for a query that is its beginning. */
  title: string;
  /** A course's own code, folded and without spaces: the query typed exactly as the code ranks first. */
  code: string | null;
  /** Words it's found by, as places in the index's vocabulary, each with how much it counts. */
  words: number[];
  weights: number[];
}

export interface SearchIndex {
  entries: Entry[];
  /** Every distinct word, so a query compares each word once. */
  vocabulary: string[];
}

// ---------------------------------------------------------------- the index

export interface IndexOptions {
  lang: Lang;
  /** The screens and tabs that are built, in the sidebar's order (Settings included). */
  screens: readonly ScreenId[];
  now: number;
}

/** One index over everything the Student can jump to. Build it again when the saved data or the language changes. */
export function searchIndex(saved: Saved, { lang, screens, now }: IndexOptions): SearchIndex {
  const vocabulary: string[] = [];
  const places = new Map<string, number>();
  const entries: Entry[] = [];

  /** Each text folded, and its words as places in the vocabulary: a course's name is on every item of it, so it's worked out once. */
  const foldedTexts = new Map<string, string>();
  const folded = (text: string) => {
    let value = foldedTexts.get(text);
    if (value === undefined) foldedTexts.set(text, (value = fold(text)));
    return value;
  };
  const placesOf = new Map<string, number[]>();
  const wordPlaces = (text: string) => {
    let found = placesOf.get(text);
    if (!found) {
      found = wordsOf(folded(text)).map((word) => {
        let at = places.get(word);
        if (at === undefined) {
          at = vocabulary.push(word) - 1;
          places.set(word, at);
        }
        return at;
      });
      placesOf.set(text, found);
    }
    return found;
  };

  const add = (item: SearchItem, fields: readonly (readonly [string | null | undefined, number])[], ownCode: string | null = null) => {
    const words: number[] = [];
    const weights: number[] = [];
    for (const [text, weight] of fields) {
      if (!text) continue;
      for (const at of wordPlaces(text)) {
        const known = words.indexOf(at);
        if (known < 0) {
          words.push(at);
          weights.push(weight);
        } else if (weights[known] < weight) weights[known] = weight;
      }
    }
    entries.push({ item, title: folded(item.title), code: ownCode ? folded(ownCode).replace(/ /g, "") : null, words, weights });
  };

  const courses = termCourses(saved);
  const byCode = new Map(courses.map((course) => [course.code, course]));
  const known = inTerm(courses);
  const catalog = new Map((saved["itb.catalog"]?.courses ?? []).filter((c) => byCode.has(c.code)).map((c) => [c.code, c.name]));
  /** What every item of a course is also found by: the course's code and names. */
  const courseWords = (code: string) => {
    const course = byCode.get(code);
    return [code, course?.six, course?.edunex, catalog.get(code)].filter(Boolean).join(" ");
  };
  const displayName = (code: string) => {
    const course = byCode.get(code);
    return course ? courseName(course, lang) : code;
  };

  for (const course of courses) {
    const title = courseName(course, lang);
    add(
      { kind: "course", key: `course:${course.code}`, title, code: course.code, target: { screen: "course", code: course.code }, classNo: course.classNo, sks: course.sks },
      [
        [title, TITLE],
        [course.code, TITLE],
        [`${course.six ?? ""} ${course.edunex ?? ""} ${catalog.get(course.code) ?? ""}`, ALIAS],
      ],
      course.code,
    );
  }

  for (const task of saved["edunex.tasks"] ?? []) {
    // A take-home UTS is handed in as a Task, but it's an exam: it's listed with them.
    if (task.kind === "uts" || !known(task.courseCode)) continue;
    add({ kind: "task", key: `task:${task.id}`, title: task.title, code: task.courseCode, target: { screen: "task", taskId: task.id }, task }, [
      [task.title, TITLE],
      [task.module?.name, CONTEXT],
      [courseWords(task.courseCode), CONTEXT],
    ]);
  }

  // Soonest first, so the sooner exam wins a tie.
  for (const exam of examsFound(saved, now)) {
    const title =
      exam.source === "task"
        ? exam.task.title
        : exam.source === "edunex"
          ? (exam.exam.title ?? translate(lang, "course.examUntitled"))
          : `${exam.kind ?? (exam.source === "six" ? exam.session.activity : "")} ${displayName(exam.code)}`.trim();
    const own =
      exam.source === "six" ? `${exam.session.activity} ${exam.session.courseName} ${exam.session.room ?? ""}` : exam.source === "task" ? exam.task.module?.name : exam.source === "outline" ? exam.module.title : null;
    add({ kind: "exam", key: `exam:${exam.key}`, title, code: exam.code, target: examRoute(exam), exam }, [
      [title, TITLE],
      [own, CONTEXT],
      [courseWords(exam.code), CONTEXT],
    ]);
  }

  const modulePlaces = new Map<string, Map<number, ModulePlace>>();
  for (const [code, outline] of Object.entries(saved["edunex.outline"] ?? {})) {
    if (!known(code)) continue;
    const main = byCode.get(code)?.edunexCourseId ?? saved["edunex.courses"]?.find((c) => c.code === code)?.edunex.courseId ?? -1;
    const places = new Map<number, ModulePlace>();
    for (const entry of outlineEntries(outline, main)) {
      const module: ModulePlace = { id: entry.module.id, title: entry.module.title, number: entry.number, parent: entry.parent };
      places.set(module.id, module);
      add({ kind: "module", key: `module:${module.id}`, title: module.title, code, target: { screen: "course", code, tab: "modules" }, module }, [
        [module.title, TITLE],
        [courseWords(code), CONTEXT],
      ]);
    }
    modulePlaces.set(code, places);
  }

  for (const [code, materials] of Object.entries(saved["edunex.materials"] ?? {})) {
    if (!known(code)) continue;
    for (const material of materials) {
      const module = material.moduleId === null ? null : (modulePlaces.get(code)?.get(material.moduleId) ?? null);
      // A material in a module the outline no longer shows has no place to open.
      if (material.moduleId !== null && !module) continue;
      add(
        { kind: "material", key: `material:${material.id}`, title: material.title, code, target: { screen: "course", code, tab: "modules" }, material, module },
        [
          [material.title, TITLE],
          [module?.title, CONTEXT],
          [courseWords(code), CONTEXT],
        ],
      );
    }
  }

  for (const [code, announcements] of Object.entries(saved["edunex.announcements"] ?? {})) {
    if (!known(code)) continue;
    for (const announcement of announcements) {
      const title = firstLine(announcement.text);
      if (!title) continue;
      add({ kind: "announcement", key: `announcement:${announcement.id}`, title, code, target: { screen: "course", code, tab: "announcements" }, announcement }, [
        [title, TITLE],
        [courseWords(code), CONTEXT],
      ]);
    }
  }

  const other: Lang = lang === "id" ? "en" : "id";
  for (const screen of screens) {
    const spec: { label: StringKey; within?: StringKey; target: SearchTarget } = SCREENS[screen];
    const title = translate(lang, spec.label);
    const alias = `search.alias.${screen}` as StringKey;
    add({ kind: "screen", key: `screen:${screen}`, title, code: null, target: spec.target, screen, within: spec.within ? translate(lang, spec.within) : null }, [
      [title, TITLE],
      [`${translate(other, spec.label)} ${translate("id", alias)} ${translate("en", alias)}`, ALIAS],
      [spec.within && `${translate("id", spec.within)} ${translate("en", spec.within)}`, CONTEXT],
    ]);
  }

  return { entries, vocabulary };
}

/** An announcement's first line, as its title. */
function firstLine(text: string): string {
  const line =
    text
      .split(/\r?\n/)
      .map((part) => part.trim())
      .find(Boolean) ?? "";
  return line.length > 140 ? `${line.slice(0, 139)}…` : line;
}

// ---------------------------------------------------------------- matching

/**
 * How well a query word matches each word of the vocabulary: the same word,
 * its beginning, inside it (3 letters or more), or within a typo or two (4
 * letters or more; 2 typos from 8 letters). A typo is a letter missing,
 * added, wrong, or two letters swapped, also while a longer word is still
 * being typed. Words with digits (codes, numbers) are never "almost" right:
 * PL3002 is not a typo of PL3032.
 */
function scoreVocabulary(vocabulary: readonly string[], token: string): Float32Array {
  const scores = new Float32Array(vocabulary.length);
  const fuzzy = /\d/.test(token) ? 0 : token.length >= 8 ? 2 : token.length >= 4 ? 1 : 0;
  for (let i = 0; i < vocabulary.length; i++) {
    const word = vocabulary[i];
    if (word === token) scores[i] = 100;
    else if (word.startsWith(token)) scores[i] = 70;
    else if (token.length >= 3 && word.includes(token)) scores[i] = 40;
    else if (fuzzy > 0) {
      const typos = typosTo(token, word, fuzzy);
      if (typos <= fuzzy) scores[i] = typos === 1 ? 30 : 18;
    }
  }
  return scores;
}

/**
 * The fewest typos between `token` and `word` or, from 5 letters, the
 * beginning of `word`; more than `max` when that's all that's certain. (A
 * shorter word against beginnings finds too much: "kuis" in "kuesioner".)
 */
function typosTo(token: string, word: string, max: number): number {
  if (token.length < 5) return distance(token, word, max);
  let best = max + 1;
  const shortest = Math.max(1, token.length - max);
  const longest = Math.min(word.length, token.length + max);
  for (let length = shortest; length <= longest && best > 1; length++) best = Math.min(best, distance(token, word.slice(0, length), best - 1));
  return best;
}

let rows = [new Int32Array(40), new Int32Array(40), new Int32Array(40)];

/** Edit distance where swapping two neighbouring letters is one edit; stops early once it's surely more than `max`. */
function distance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (rows[0].length <= b.length) rows = rows.map(() => new Int32Array(b.length * 2 + 1));
  let [beforePrevious, previous, current] = rows;
  for (let j = 0; j <= b.length; j++) previous[j] = j;
  for (let i = 1; i <= a.length; i++) {
    current[0] = i;
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const same = a.charCodeAt(i - 1) === b.charCodeAt(j - 1);
      let value = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + (same ? 0 : 1));
      if (i > 1 && j > 1 && a.charCodeAt(i - 1) === b.charCodeAt(j - 2) && a.charCodeAt(i - 2) === b.charCodeAt(j - 1)) value = Math.min(value, beforePrevious[j - 2] + 1);
      current[j] = value;
      if (value < rowMin) rowMin = value;
    }
    // No row ever gets cheaper than the one before it, swaps included.
    if (rowMin > max) return max + 1;
    [beforePrevious, previous, current] = [previous, current, beforePrevious];
  }
  return previous[b.length];
}

/**
 * Every item that matches all the query's words, in any order, best first and
 * grouped by kind; groups in the order of their best item. An exact course
 * code ranks first, then a code or title the query begins.
 */
export function search(index: SearchIndex, query: string, perGroup = 6): SearchGroup[] {
  const folded = fold(query);
  if (!folded) return [];
  const tokens = [...new Set(folded.split(" "))];
  const compact = tokens.join("");
  const scores = tokens.map((token) => scoreVocabulary(index.vocabulary, token));

  const hits: { entry: Entry; score: number; order: number }[] = [];
  index.entries.forEach((entry, order) => {
    let score = 0;
    for (const tokenScores of scores) {
      let best = 0;
      for (let i = 0; i < entry.words.length; i++) {
        const value = tokenScores[entry.words[i]] * entry.weights[i];
        if (value > best) best = value;
      }
      if (best === 0) return;
      score += best;
    }
    if (entry.code !== null) {
      if (entry.code === compact) score += 1000;
      else if (compact.length >= 2 && entry.code.startsWith(compact)) score += 600;
    }
    if (entry.title.startsWith(folded)) score += 300;
    else if (entry.title.includes(` ${folded}`)) score += 120;
    hits.push({ entry, score: score + KIND_BIAS[entry.item.kind], order });
  });
  hits.sort((a, b) => b.score - a.score || a.order - b.order);

  const groups = new Map<SearchKind, SearchItem[]>();
  for (const { entry } of hits) {
    const items = groups.get(entry.item.kind) ?? [];
    if (items.length < perGroup) items.push(entry.item);
    groups.set(entry.item.kind, items);
  }
  return [...groups].map(([kind, items]) => ({ kind, items }));
}

/** Before anything is typed: the next Tasks to hand in, this term's courses, and the screens (not their tabs). */
export function suggestions(index: SearchIndex, now: number): SearchGroup[] {
  const items = index.entries.map((entry) => entry.item);
  const tasks = items
    .filter((item): item is Extract<SearchItem, { kind: "task" }> => item.kind === "task" && isOpenStatus(taskStatus(item.task, now)))
    .sort((a, b) => byDeadline(a.task, b.task))
    .slice(0, 3);
  const groups: SearchGroup[] = [
    { kind: "task", items: tasks },
    { kind: "course", items: items.filter((item) => item.kind === "course") },
    { kind: "screen", items: items.filter((item) => item.kind === "screen" && item.within === null) },
  ];
  return groups.filter((group) => group.items.length > 0);
}
