// What Beranda's strip counts (./strip.tsx), kept apart from its drawing so "Perlu kamu urus" (./urus.tsx) can leave
// the same things out, and Beranda says each fact once. Nothing worked out here: the rows are "Perlu kamu urus"'s, the
// exam is `attention`'s (src/core/needs).
import { wibDay } from "../../../../src/core/course-meetings";
import type { Need } from "../../../../src/core/needs";
import type { UrusRow } from "./urus-rows";

const DAY = 86_400_000;

/** What the strip counts, so Beranda says each fact once: the due rows it counts, and the exam it gives days to. */
export interface StripFacts {
  /** The rows the due tile counts (their `key`s): today's when something is due today, otherwise the week's. */
  due: ReadonlySet<string>;
  /** Something is due today: the count is today's, in red. */
  today: boolean;
  /** One of the counted rows is already past its deadline. */
  late: boolean;
  /** The next exam's need, as `attention` has it. */
  exam: { need: Extract<Need, { kind: "exam" }>; at: number } | null;
}

/** The strip's figures from "Perlu kamu urus"'s rows and `attention`'s needs (both already worked out). */
export function stripFacts(rows: readonly UrusRow[], needs: readonly Need[], now: number): StripFacts {
  // What's due in the week ahead: "Perlu kamu urus"'s Task rows (a Presence handed in as a Task too), late ones in.
  const week = rows.flatMap((row) =>
    row.kind === "todo" && (row.item.need.kind === "task" || (row.item.need.kind === "presence" && row.item.presenceTag)) && row.item.at < now + 7 * DAY
      ? [row]
      : [],
  );
  const day = wibDay(now);
  const todays = week.filter((row) => wibDay(row.item.at) === day);
  const counted = todays.length ? todays : week;
  // The next exam: the soonest sitting still ahead (an open window: its close).
  const exam =
    needs
      .flatMap((need) => (need.kind === "exam" ? [{ need, at: need.sitting.start > now ? need.sitting.start : (need.at ?? need.sitting.start) }] : []))
      .sort((x, y) => x.at - y.at)[0] ?? null;
  return { due: new Set(counted.map((row) => row.key)), today: todays.length > 0, late: counted.some((row) => row.item.late), exam };
}

/** The strip already says this row: every absence, a due row it counts, the next exam. */
export function stripSays(facts: StripFacts, row: UrusRow): boolean {
  if (row.kind === "absence") return true;
  if (row.kind !== "todo") return false;
  return facts.due.has(row.key) || (facts.exam !== null && row.item.need.kind === "exam" && row.item.need.id === facts.exam.need.id);
}
