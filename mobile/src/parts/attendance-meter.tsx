// A course's absences worked out once for every screen (round 3): its tone on the app's one absence scale
// (ui/absence.ts, as Beranda's chips: red once the target is out of reach or the course finished below it, amber with
// none left, green with some to spare), the segments a meter would draw (./meter-marks.ts), the state in plain words,
// the same on every tab ("Absen lewat 2×", "Jatah absen habis", "Sisa 1×"), and the whole sentence for TalkBack. The
// screens draw it their own way (Kuliah's rows, the course's line, its sheet).
import type { CourseAttendance } from "../../../src/app/attendance";
import { budgetLabel } from "../../../src/app/attendance-labels";
import type { Translate } from "../../../src/app/i18n";
import { type AttendanceHealth, absenceBudget, estimatedBudget, percent, presenceGroup } from "../../../src/core/attendance";
import { absenceName, absenceTone } from "../ui/absence";
import type { MeterBar } from "./meter-marks";

export type MeterTone = "ok" | "amber" | "red" | "neutral";

/** The risk as a tone, the app's one absence scale (ui/absence.ts): grey before SIX has a count. */
export function meterTone(health: AttendanceHealth): MeterTone {
  return absenceTone(health.state) ?? "neutral";
}

/** "sisa 1×" → "Sisa 1×": the words stand alone at a row's end. */
const lead = (words: string) => words.charAt(0).toLocaleUpperCase() + words.slice(1);

export interface MeterModel {
  tone: MeterTone;
  /** The segments: allowed, used of them, over the limit; `estimate` before SIX counts (dashed rings, nothing used). */
  bar: MeterBar | null;
  /** The state in a few plain words ("Absen lewat 2×", "Jatah absen habis", "Sisa 1×"; null: the picture alone). */
  word: string | null;
  /** A finished course: its share, with a mark instead of segments. */
  final: { share: number; met: boolean } | null;
  /** The whole of it, for a screen reader. */
  label: string;
}

/** What the meter draws for a course, worked out once (no hooks: a row can memoize it). Null: nothing to draw. */
export function meterModel(t: Translate, item: Pick<CourseAttendance, "health">, soFar = false): MeterModel | null {
  const { health } = item;
  const tone = meterTone(health);
  const group = presenceGroup(health);
  if (group === "edunex") {
    if (!health.edunexClosed) return null;
    const words = t("presence.edunexTally", { recorded: health.edunexRecorded, closed: health.edunexClosed });
    return {
      tone: "neutral",
      bar: null,
      word: t("mobile.absence.edunex", { recorded: health.edunexRecorded, closed: health.edunexClosed }),
      final: null,
      label: words,
    };
  }
  if (health.state === "met" || health.state === "missed") {
    if (!health.held) return null;
    const share = percent(health.attended ?? 0, health.held);
    return {
      tone,
      bar: null,
      word: t("mobile.absence.final", { percent: share }),
      final: { share, met: health.state === "met" },
      label: t("presence.row.final", { percent: share }),
    };
  }
  const budget = absenceBudget(health);
  if (!budget) {
    if (health.state !== "unknown" || health.countedIn === "edunex" || health.countedIn === "noSix") return null;
    const about = estimatedBudget(health);
    if (!about) return null;
    return {
      tone: "neutral",
      bar: { allowed: about, used: 0, over: 0, estimate: true },
      word: null,
      final: null,
      label: t("presence.bar.a11yAbout", { count: about }),
    };
  }
  const missed = (health.held ?? 0) - (health.attended ?? 0);
  const { allowed, left, over } = budget;
  const bar = { allowed, used: budget.used, over, estimate: false };
  if (over > 0)
    return {
      tone,
      bar,
      word: absenceName(t, health) ?? lead(t("presence.bar.over", { count: over })),
      final: null,
      label: `${budgetLabel(t, health)}. ${t("presence.bar.a11yOver", { allowed, used: missed, over })}`,
    };
  if (left === 0)
    return {
      tone,
      bar: allowed > 0 ? bar : null,
      word: absenceName(t, health) ?? lead(t("presence.bar.noneLeft")),
      final: null,
      label: allowed > 0 ? t("presence.bar.a11yFull", { allowed }) : t("presence.bar.zero"),
    };
  return {
    tone,
    bar,
    word: lead(t("presence.bar.left", { count: left })),
    final: null,
    label: t(soFar ? "presence.bar.a11ySoFar" : "presence.bar.a11y", { allowed, used: missed, left }),
  };
}
