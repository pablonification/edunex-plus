// Where each required course of the curriculum (a "slot") stands for the
// Student, decided once for every screen: Rencana's rules, Kurikulum's rows
// and the counts all read it. Students who started on an older curriculum
// passed many courses under other codes (KU1001 Olah Raga for WI2003); SIX's
// graduation progress places those in the semester of the course they stand
// in for, so a slot is matched to such a course by semester and name, or by
// the hand-checked equivalence table. A slot SIX's progress doesn't list at
// all isn't asked of the Student (SIX lists every course still to take), so
// it isn't counted as left. The Student's own corrections win over all of it.
import { equivalentsOf } from "./curriculum-equivalence";
import { type CurriculumFix, isLetterGrade, type ProgressCourse } from "./models";

/**
 * passed: graded (not E). failed: graded E. in-progress: this term. exempt:
 * credited without a grade. left: still to take. unlisted: SIX's progress
 * doesn't list it for the Student. not-mine and done: the Student said so.
 */
export type StandingStatus = "passed" | "failed" | "in-progress" | "exempt" | "left" | "unlisted" | "not-mine" | "done";

export interface SlotStanding {
  status: StandingStatus;
  grade: string | null;
  /** The course that fills the slot under another code. */
  via: { code: string; name: string } | null;
  /** The Student's correction, when they made one. */
  fix: CurriculumFix | null;
  /** SIX still lists the course as to take (or failed), though the Student's correction says otherwise. */
  sixLeft: boolean;
  /** `via` is the app's guess by name, not SIX's placement, the table or the Student. */
  guessed: boolean;
  /** A what-if of this term decided it (see `withWhatIf`): a course tried now, or a KRS course left out. Only in the plan. */
  whatIf?: "added" | "left-out";
}

/** A row of SIX's graduation progress with the semester it sits in. */
export type ProgressRow = ProgressCourse & { semester: number };

export interface SlotInput {
  slots: readonly { code: string; name: string; semester: number }[];
  /** SIX's graduation progress, row by row; null without the page. */
  rows: readonly ProgressRow[] | null;
  graded: ReadonlyMap<string, { name: string; grade: string }>;
  thisTerm: readonly { code: string; name: string }[];
  fixes: Readonly<Record<string, CurriculumFix>>;
}

const STOP = new Set(["dan", "di", "untuk", "the", "and", "of", "pengantar", "pengenalan", "dasar", "i", "ii", "iii", "ia", "iia", "ib", "a", "b"]);
const words = (name: string) =>
  name
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
const sameWord = (a: string, b: string) => a === b || (a.length >= 7 && b.length >= 7 && a.slice(0, 7) === b.slice(0, 7));
/** Words two course names share, when they cover every word of the shorter name ("Olah Raga", "Pancasila"); else 0. */
export function nameMatch(a: string, b: string): number {
  const [short, long] = [words(a), words(b)].sort((x, y) => x.length - y.length);
  const shared = short.filter((w) => long.some((v) => sameWord(w, v))).length;
  return shared > 0 && shared === short.length ? shared : 0;
}

/** "WI201X" is any of WI2010–WI2019. */
export const fillsSlot = (slot: string, code: string) =>
  slot.endsWith("X") ? code.length === slot.length && code.startsWith(slot.slice(0, -1)) && /\d$/.test(code) : slot === code;

export function rowStatus(row: ProgressCourse): StandingStatus {
  if (row.status === "exempt") return "exempt";
  if (row.status === "in-progress") return "in-progress";
  if (row.status === "not-taken") return "left";
  return row.grade === "E" ? "failed" : isLetterGrade(row.grade) ? "passed" : "in-progress";
}

/** Every slot's standing, by the slot's code. */
export function slotStandings({ slots, rows, graded, thisTerm, fixes }: SlotInput): Map<string, SlotStanding> {
  const list = rows ?? [];
  const isSlotCode = (code: string) => slots.some((s) => fillsSlot(s.code, code));
  // Required-kind rows under codes the curriculum doesn't have: older-curriculum courses standing in for a slot.
  const substitutes = list.filter((r) => r.kind === "required" && !isSlotCode(r.code));
  // Courses the Student or the table put in a slot aren't guessed for another one; a guessed one can be guessed again (KU2071 was both Pancasila and Kewarganegaraan).
  const claimed = new Set<string>();
  const guessed = new Set<string>();
  const plain = { fix: null, sixLeft: false, guessed: false } as const;

  /** A course the Student took, wherever it is: in this term, SIX's progress, the transcript. */
  const taken = (code: string): { status: StandingStatus; grade: string | null; name: string } | null => {
    const now = thisTerm.find((c) => c.code === code);
    if (now) return { status: "in-progress", grade: null, name: now.name };
    const row = list.find((r) => r.code === code);
    if (row) return { status: rowStatus(row), grade: row.grade, name: row.name };
    const g = graded.get(code);
    return g ? { status: g.grade === "E" ? "failed" : "passed", grade: g.grade, name: g.name } : null;
  };

  const settled = (slot: SlotInput["slots"][number]): SlotStanding | null => {
    const own = list.find((r) => fillsSlot(slot.code, r.code));
    const fix = fixes[slot.code];
    if (fix) {
      const sixLeft = own !== undefined && (rowStatus(own) === "left" || rowStatus(own) === "failed");
      if (fix.kind !== "counted-as") return { status: fix.kind, grade: null, via: null, fix, sixLeft, guessed: false };
      claimed.add(fix.code);
      const course = taken(fix.code);
      return {
        status: course?.status ?? "done",
        grade: course?.grade ?? null,
        via: { code: fix.code, name: course?.name ?? fix.code },
        fix,
        sixLeft,
        guessed: false,
      };
    }
    if (own) return { ...plain, status: rowStatus(own), grade: own.grade, via: own.code === slot.code ? null : { code: own.code, name: own.name } };
    const mine = [...thisTerm.map((c) => c.code), ...graded.keys()].find((code) => fillsSlot(slot.code, code));
    const course = mine === undefined ? null : taken(mine);
    if (mine && course) return { ...plain, status: course.status, grade: course.grade, via: mine === slot.code ? null : { code: mine, name: course.name } };
    for (const code of equivalentsOf(slot.code)) {
      const older = taken(code);
      if (!older) continue;
      claimed.add(code);
      return { ...plain, status: older.status, grade: older.grade, via: { code, name: older.name } };
    }
    return null;
  };

  const guess = (slot: SlotInput["slots"][number]): SlotStanding => {
    const best = substitutes
      .filter((r) => !claimed.has(r.code))
      .map((r) => ({ r, match: nameMatch(slot.name, r.name) }))
      .filter((x) => x.match > 0)
      .map((x) => ({ r: x.r, score: x.match + (x.r.semester === slot.semester ? 2 : 0) - (guessed.has(x.r.code) ? 0.5 : 0) }))
      .sort((a, b) => b.score - a.score)[0];
    if (best) {
      guessed.add(best.r.code);
      return { ...plain, status: rowStatus(best.r), grade: best.r.grade, via: { code: best.r.code, name: best.r.name }, guessed: true };
    }
    return { ...plain, status: rows ? "unlisted" : "left", grade: null, via: null };
  };

  // What's certain first (SIX's own rows, the transcript, the table, the Student), then guesses by name for the rest.
  const standings = new Map<string, SlotStanding | null>(slots.map((slot) => [slot.code, settled(slot)]));
  for (const slot of slots) if (!standings.get(slot.code)) standings.set(slot.code, guess(slot));
  return standings as Map<string, SlotStanding>;
}
