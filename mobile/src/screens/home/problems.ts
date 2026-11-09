// What needs the Student before any Task (round 3, the real phone): courses at or past their absence limit, and classes
// that clash. Beranda's "Perlu kamu urus" leads with them, and its whole list does too (./urus.tsx, ./needs-screen.tsx).
// Nothing worked out here: the absences are the desktop's count (`homeContext`'s health, the same Kuliah's meter
// draws), the clashes are Jadwal's and the bell's (`overlaps`, src/core/schedule.ts), within the days "Perlu
// perhatianmu" looks ahead (`needsRange`). A course past the limit before one with none left, most over first.
import { type AttendanceHealth, absenceBudget } from "../../../../src/core/attendance";
import type { ClassSession } from "../../../../src/core/models";
import { type HomeContext, needsRange } from "../../../../src/core/needs";
import { overlaps, pairKey } from "../../../../src/core/schedule";

export interface AbsenceProblem {
  code: string;
  health: AttendanceHealth;
}

export interface ClashProblem {
  /** The pair of courses, the same whichever comes first. */
  key: string;
  a: ClassSession;
  b: ClassSession;
  /** The part they share. */
  from: number;
  to: number;
}

export interface Problems {
  absences: AbsenceProblem[];
  clashes: ClashProblem[];
}

const over = (health: AttendanceHealth) => absenceBudget(health)?.over ?? 0;

export function problems(context: HomeContext): Problems {
  const absences: AbsenceProblem[] = [];
  for (const course of context.courses) {
    const health = context.health.get(course.code);
    if (health && (health.state === "out" || health.state === "none")) absences.push({ code: course.code, health });
  }
  absences.sort((x, y) => Number(y.health.state === "out") - Number(x.health.state === "out") || over(y.health) - over(x.health));
  // Each pair once, at its next clash still to come in the range.
  const { until } = needsRange(context);
  const clashes: ClashProblem[] = [];
  const seen = new Set<string>();
  for (const overlap of overlaps(context.schedule ?? [])) {
    if (overlap.to <= context.now || overlap.from >= until) continue;
    const key = pairKey(overlap);
    if (seen.has(key)) continue;
    seen.add(key);
    clashes.push({ key, a: overlap.a, b: overlap.b, from: overlap.from, to: overlap.to });
  }
  return { absences, clashes };
}

/** At most `max` rows, problems first, always keeping room for the first thing to do: a deadline tonight is never pushed off. */
export function firstRows<T extends { kind: string }>(all: readonly T[], max: number): T[] {
  const todos = all.filter((row) => row.kind === "todo");
  const found = all.filter((row) => row.kind !== "todo").slice(0, max - Math.min(todos.length, 1));
  return [...found, ...todos.slice(0, max - found.length)];
}
