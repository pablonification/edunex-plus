// Presensi's answer, first thing on the screen (#85): "am I OK, and what do I
// need to do?" in a line or two that name the courses and the action, worst
// first: "Jangan absen lagi di DK4073 dan PL3032." / "KU5014 sudah tak bisa
// capai 80%." When all is fine, it says so, and which course is closest.
import type { AttendanceHealth } from "./attendance";
import type { StringKey, Vars } from "./strings";

export type AnswerTone = "danger" | "warning" | "success";

export interface AnswerLine {
  tone: AnswerTone;
  text: string;
}

/**
 * `t` translates; `list` joins course codes the way the language does
 * ("DK4073 dan PL3032"). Empty when nothing is known yet (no SIX count).
 */
export function attendanceAnswer(
  courses: readonly AttendanceHealth[],
  t: (key: StringKey, vars?: Vars) => string,
  list: (items: string[]) => string,
): AnswerLine[] {
  const codes = (pick: (health: AttendanceHealth) => boolean) => courses.filter(pick).map((health) => health.code);
  const lines: AnswerLine[] = [];

  // Every class from here on, said first: it's what the Student can still change.
  const none = codes((h) => h.state === "none");
  if (none.length) lines.push({ tone: "warning", text: t("presence.answer.none", { codes: list(none) }) });

  // Out of reach, one line per target (courses may have their own).
  const out = courses.filter((h) => h.state === "out");
  for (const target of [...new Set(out.map((h) => h.target))])
    lines.push({ tone: "danger", text: t("presence.answer.out", { codes: list(out.filter((h) => h.target === target).map((h) => h.code)), target }) });

  const oneLeft = codes((h) => h.state === "risk" && h.absencesLeft === 1);
  if (oneLeft.length) lines.push({ tone: "warning", text: t("presence.answer.one", { codes: list(oneLeft) }) });
  // Below the target now, with absences to spare by the end of term.
  const below = codes((h) => h.state === "risk" && h.absencesLeft !== 1);
  if (below.length) lines.push({ tone: "warning", text: t("presence.answer.below", { codes: list(below), count: below.length }) });

  if (lines.length) return lines;
  const safe = courses.filter((h) => h.state === "safe").sort((a, b) => (a.absencesLeft ?? 0) - (b.absencesLeft ?? 0));
  const closest = safe[0];
  if (!closest) return [];
  return [{ tone: "success", text: t("presence.answer.safe", { code: closest.code, count: closest.absencesLeft ?? 0 }) }];
}
