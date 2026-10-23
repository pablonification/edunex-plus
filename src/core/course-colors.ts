// Each course has a color as its identity: its dot and its stripe, never a
// status. So the palette leaves out every hue status speaks in (red, amber,
// orange, yellow, green), teal (it reads as green) and grey (an unknown
// course, "not yet"): a course must never look in danger, done or switched
// off because of its color. Each color is a name with a light and a dark tone
// (`--course-<id>` in styles.css); only the name is saved.
//
// Which color a course of the term gets: the Student's pick; else the
// automatic color it got when it first showed, remembered so it never moves by
// itself (when SIX connects, or a course is added or dropped); else the first
// color no other course of the term has. A pick that takes an automatic
// course's color moves only that course.
import { type CourseColors, MAX_COURSE_COLORS } from "./models";

/** In the automatic order: the most distinct first, so a term's first five courses get the five most distinct. */
export const COURSE_PALETTE = [
  { id: "cyan", hue: 220 },
  { id: "indigo", hue: 285 },
  { id: "berry", hue: 354 },
  { id: "blue", hue: 245 },
  { id: "orchid", hue: 320 },
  { id: "magenta", hue: 332 },
  { id: "purple", hue: 309 },
  { id: "pink", hue: 348 },
  { id: "plum", hue: 324 },
  { id: "lavender", hue: 304 },
] as const;
export type PaletteId = (typeof COURSE_PALETTE)[number]["id"];

const IDS: readonly PaletteId[] = COURSE_PALETTE.map((color) => color.id);
/** By hue (OKLCH), so neighbours in the picker look like neighbours. */
export const PICKER_ORDER: readonly PaletteId[] = [...COURSE_PALETTE].sort((a, b) => a.hue - b.hue).map((color) => color.id);

export function isCourseColorId(id: string | null | undefined): id is PaletteId {
  return IDS.includes(id as PaletteId);
}

/** The color to draw: the tone of the theme on screen. */
export const courseTone = (id: PaletteId) => `var(--course-${id})`;

export interface CourseColor {
  id: PaletteId;
  picked: boolean;
}

export interface ResolvedColors {
  /** Every code of the term, once. */
  colors: Map<string, CourseColor>;
  /** Automatic colors handed out that aren't remembered yet (a new course, or one a pick moved): to save. */
  remember: Record<string, PaletteId>;
  /** Automatic courses that had to leave their remembered color, because a pick took it. */
  moved: { code: string; from: PaletteId; to: PaletteId }[];
}

/** The term's colors, from what's saved. `codes` may repeat (a course in two classes is one course). */
export function resolveCourseColors(codes: readonly string[], saved: CourseColors | undefined): ResolvedColors {
  const colors = new Map<string, CourseColor>();
  const used = new Map<PaletteId, number>();
  const remember: Record<string, PaletteId> = {};
  const moved: ResolvedColors["moved"] = [];
  const give = (code: string, id: PaletteId, picked: boolean) => {
    colors.set(code, { id, picked });
    used.set(id, (used.get(id) ?? 0) + 1);
  };
  const sorted = [...new Set(codes)].sort();
  // 1. The Student's picks.
  for (const code of sorted) {
    const pick = saved?.picks[code]?.color;
    if (isCourseColorId(pick)) give(code, pick, true);
  }
  // 2. Each other course's remembered color, unless a pick or an earlier course took it.
  const left: string[] = [];
  for (const code of sorted) {
    if (colors.has(code)) continue;
    const kept = saved?.automatic?.[code];
    if (isCourseColorId(kept) && !used.has(kept)) give(code, kept, false);
    else left.push(code);
  }
  // 3. The first color no course of the term has; with none free, the least used, earliest in the order.
  for (const code of left) {
    const id = IDS.find((candidate) => !used.has(candidate)) ?? IDS.reduce((a, b) => ((used.get(b) ?? 0) < (used.get(a) ?? 0) ? b : a));
    const kept = saved?.automatic?.[code];
    if (isCourseColorId(kept) && kept !== id) moved.push({ code, from: kept, to: id });
    if (kept !== id) remember[code] = id;
    give(code, id, false);
  }
  return { colors, remember, moved };
}

/**
 * The Student's choice for one course: a color, or automatic (null). `at` (ms) is when, for the cap. A course
 * going back to automatic keeps its remembered color, so it returns to the one it had if that's free.
 */
export function applyChoice(value: CourseColors, code: string, choice: PaletteId | null, at: number): CourseColors {
  const { [code]: _, ...picks } = value.picks;
  return { ...value, picks: choice ? { ...picks, [code]: { color: choice, at } } : picks };
}

/** What the term's colors make of `value` saved: the automatic colors handed out are remembered with it. */
export function withRemembered(codes: readonly string[], value: CourseColors): CourseColors {
  const { remember } = resolveCourseColors(codes, value);
  return Object.keys(remember).length ? { ...value, automatic: { ...value.automatic, ...remember } } : value;
}

/**
 * Kept to the saved cap (more than a whole degree's courses): the picks made longest ago go first, then the
 * colors remembered first, never this term's.
 */
export function pruneCourseColors(value: CourseColors, codes: readonly string[]): CourseColors {
  const term = new Set(codes);
  let picks = value.picks;
  const pickCodes = Object.keys(picks);
  if (pickCodes.length > MAX_COURSE_COLORS) {
    const gone = new Set(
      pickCodes
        .filter((code) => !term.has(code))
        .sort((a, b) => picks[a].at - picks[b].at)
        .slice(0, pickCodes.length - MAX_COURSE_COLORS),
    );
    picks = Object.fromEntries(Object.entries(picks).filter(([code]) => !gone.has(code)));
  }
  let automatic = value.automatic;
  const autoCodes = Object.keys(automatic ?? {});
  if (automatic && autoCodes.length > MAX_COURSE_COLORS) {
    const gone = new Set(autoCodes.filter((code) => !term.has(code)).slice(0, autoCodes.length - MAX_COURSE_COLORS));
    automatic = Object.fromEntries(Object.entries(automatic).filter(([code]) => !gone.has(code)));
  }
  return picks === value.picks && automatic === value.automatic ? value : { ...value, picks, ...(automatic ? { automatic } : {}) };
}

/** The Student's pick for a course outside the term (a grade from last term, a Task of a course not in SIX). */
export function pickedColor(code: string, saved: CourseColors | undefined): PaletteId | undefined {
  const id = saved?.picks[code]?.color;
  return isCourseColorId(id) ? id : undefined;
}

// The move from the colors before the palette, run once, the first time this version shows the courses: each course
// keeps the color nearest the one it had. The grey and the brown aren't kept (they read as switched off), so those
// courses take the first free colors. TODO: remove in the release after the one that brings the palette.
const LEGACY = ["#3366F0", "#7C5CFC", "#0FA3B1", "#D6409F", "#64748B", "#9D4EDD", "#0284C7", "#8D6E63"] as const;
const LEGACY_TO_PALETTE: Record<(typeof LEGACY)[number], PaletteId | null> = {
  "#3366F0": "indigo",
  "#7C5CFC": "lavender",
  "#0FA3B1": "cyan",
  "#D6409F": "pink",
  "#64748B": null,
  "#9D4EDD": "purple",
  "#0284C7": "blue",
  "#8D6E63": null,
};

function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** The colors the version before the palette showed for these codes, as the nearest palette colors. */
export function legacyAutomatic(codes: readonly string[]): Record<string, PaletteId> {
  const out: Record<string, PaletteId> = {};
  const taken = new Set<number>();
  for (const code of [...new Set(codes)].sort()) {
    let index = hash(code) % LEGACY.length;
    for (let step = 0; step < LEGACY.length && taken.has(index); step++) index = (index + 1) % LEGACY.length;
    taken.add(index);
    const id = LEGACY_TO_PALETTE[LEGACY[index]];
    if (id) out[code] = id;
  }
  return out;
}
