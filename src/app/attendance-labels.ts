// Attendance in words and status colors, the same on every screen that shows
// it (Presensi, Beranda, the course page, Jadwal, an exam): what's left
// before the course's target, and the action that counts in an Edunex
// Presence window.
import type { AttendanceHealth, AttendanceState, PresenceAction, PresenceActivity } from "../core/attendance";
import { percent } from "../core/attendance";
import type { StringKey } from "../core/strings";
import { type Translate, useT } from "./i18n";
import type { MeterTone } from "./ui/meter";

/** A state's text color: red when the target is out of reach, amber with no room left, green with room to spare. */
export const STATE_TONE: Record<AttendanceState, string> = {
  out: "text-danger-fg",
  none: "text-warning-fg",
  risk: "text-warning-fg",
  safe: "text-success-fg",
  unknown: "text-faint",
};

/** A state's meter fill, in the same status colors. */
export const METER_TONE: Record<AttendanceState, MeterTone> = { out: "danger", none: "warning", risk: "warning", safe: "success", unknown: "neutral" };

/** What's left before the course's own target: "Masih bisa absen 2× lagi", "Jangan absen lagi", "Tak bisa lagi capai 80% · paling tinggi 71%". */
export function budgetLabel(t: Translate, health: AttendanceHealth): string {
  switch (health.state) {
    case "unknown":
      return t("presence.budget.unknown");
    case "out":
      return t("presence.budget.out", { target: health.target, best: percent(health.best ?? 0) });
    case "none":
      return t("presence.budget.none");
    default:
      return t("presence.budget.safe", { count: health.absencesLeft ?? 0 });
  }
}

/** The short verdict: "Masih bisa absen 2× lagi", "Jangan absen lagi", "Tak bisa lagi capai 80%". */
export function verdictLabel(t: Translate, health: AttendanceHealth): string {
  return health.state === "out" ? t("presence.status.out", { target: health.target }) : budgetLabel(t, health);
}

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
