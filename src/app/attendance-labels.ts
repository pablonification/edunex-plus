// Attendance in words and status colors, the same on every screen that shows
// it (Presensi, Beranda, the course page, Jadwal, an exam): what's left
// before the course's target, and the action that counts in an Edunex
// Presence window.
import type { AttendanceHealth, AttendanceState, PresenceAction, PresenceActivity } from "../core/attendance";
import { absenceBudget, estimatedBudget } from "../core/attendance";
import type { StringKey } from "../core/strings";
import { type Translate, useT } from "./i18n";
import type { BarTone } from "./ui/meter";

/**
 * A state's text color: red when the target is out of reach (or lectures
 * ended below it), amber with no absence left, green while at least one still
 * is (one left at 100% is no warning) and when lectures ended at the target.
 */
export const STATE_TONE: Record<AttendanceState, string> = {
  out: "text-danger-fg",
  missed: "text-danger-fg",
  none: "text-warning-fg",
  risk: "text-success-fg",
  safe: "text-success-fg",
  met: "text-success-fg",
  unknown: "text-faint",
};

/**
 * What's left before the course's own target: "Sisa jatah absen 2×",
 * "Jatah absen habis", "Tak bisa lagi capai 80%"; once lectures are over,
 * the final word: "Selesai, 80% tercapai".
 */
export function budgetLabel(t: Translate, health: AttendanceHealth): string {
  switch (health.state) {
    case "unknown":
      return t("presence.budget.unknown");
    case "out":
      return t("presence.budget.out", { target: health.target });
    case "none":
      return t("presence.budget.none");
    case "met":
      return t("presence.budget.met", { target: health.target });
    case "missed":
      return t("presence.budget.missed", { target: health.target });
    default:
      return t("presence.budget.safe", { count: health.absencesLeft ?? 0 });
  }
}

/** The short verdict: "Sisa jatah absen 2×", "Jatah absen habis", "Tak bisa lagi capai 80%". */
export function verdictLabel(t: Translate, health: AttendanceHealth): string {
  return health.state === "out" ? t("presence.status.out", { target: health.target }) : budgetLabel(t, health);
}

/**
 * The absence bar and its words, the same wherever they're drawn: "Terpakai
 * 1× · sisa 1×" (the last part bold, in the bar's tone), the bar's segments,
 * and the bar's own name for a screen reader. Before SIX counts, the
 * timetable's allowance ("Sekitar 3× semester ini", hatched); a target of 100%
 * allows none ("Tak boleh absen", no bar). Null where the course has no budget
 * to show: lectures over, recorded only in Edunex, no count and nothing to come.
 * `soFar`: without ITB's calendar, the budget covers only SIX's timetable so far.
 */
export interface BudgetWords {
  /** The quiet part, first: "Terpakai 1×", "Belum terpakai". */
  lead: string | null;
  /** The part that answers, last and bold: "sisa 1×", "habis", "lewat batas 1×". */
  bold: string;
  tone: BarTone;
  bar: { allowed: number; used: number; over: number; estimate: boolean } | null;
  /** The bar's name. */
  label: string;
}

export function budgetWords(t: Translate, health: AttendanceHealth, soFar = false): BudgetWords | null {
  const budget = absenceBudget(health);
  if (!budget) {
    if (health.state !== "unknown" || health.countedIn === "edunex" || health.countedIn === "noSix") return null;
    const about = estimatedBudget(health);
    if (about === null) return null;
    if (about === 0) return { lead: null, bold: t("presence.bar.zero"), tone: "neutral", bar: null, label: t("presence.bar.zero") };
    return {
      lead: null,
      bold: t("presence.bar.about", { count: about }),
      tone: "neutral",
      bar: { allowed: about, used: 0, over: 0, estimate: true },
      label: t("presence.bar.a11yAbout", { count: about }),
    };
  }
  const missed = (health.held ?? 0) - (health.attended ?? 0);
  const { allowed, left, over } = budget;
  const bar = { allowed, used: budget.used, over, estimate: false };
  const lead = missed > 0 ? t("presence.bar.used", { count: missed }) : t("presence.bar.noneUsed");
  if (over > 0)
    return {
      lead,
      bold: t("presence.bar.over", { count: over }),
      tone: "danger",
      bar,
      label: t("presence.bar.a11yOver", { allowed, used: missed, over }),
    };
  if (allowed === 0) return { lead: null, bold: t("presence.bar.zero"), tone: "neutral", bar: null, label: t("presence.bar.zero") };
  if (left === 0) return { lead, bold: t("presence.bar.noneLeft"), tone: "warning", bar, label: t("presence.bar.a11yFull", { allowed }) };
  return {
    lead,
    bold: t("presence.bar.left", { count: left }),
    tone: "neutral",
    bar,
    label: t(soFar ? "presence.bar.a11ySoFar" : "presence.bar.a11y", { allowed, used: missed, left }),
  };
}

/** The bold part's text color, by the bar's tone. */
export const BAR_TEXT: Record<BarTone, string> = { neutral: "text-fg", warning: "text-warning-fg", danger: "text-danger-fg" };

const ACTION_KEY: Record<PresenceActivity, StringKey> = {
  course: "presence.action.course",
  module: "presence.action.module",
  thread: "presence.action.thread",
  assignment: "presence.action.assignment",
  exam: "presence.action.exam",
  vicon: "presence.action.vicon",
  crs: "presence.action.crs",
  other: "presence.action.other",
};

/** The action that counts in a Presence window, as a short instruction. */
export function useActionLabel(): (window: { action: PresenceAction }) => string {
  const t = useT();
  return ({ action }) =>
    action.activity === "assignment" && !action.task
      ? t("presence.action.assignmentUnknown")
      : t(ACTION_KEY[action.activity], { task: action.task?.title ?? "" });
}
