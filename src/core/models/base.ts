// What every part of the app shares: the sources, their status, and settings.
import { z } from "zod";

/** Edunex and SIX need the Student's sign-in; "itb" is ITB's public pages (academic calendar, course catalog). */
export const SourceId = z.enum(["edunex", "six", "itb"]);
export type SourceId = z.infer<typeof SourceId>;

/**
 * signed-out: no session. connecting: a session exists and is being checked.
 * live: the last check worked. offline: the network or the service is down.
 * expired: the service ended the session. changed: the service answered
 * something the app doesn't understand (a vendor change).
 */
export const SourceState = z.enum(["signed-out", "connecting", "live", "offline", "expired", "changed"]);
export type SourceState = z.infer<typeof SourceState>;

export const SourceStatus = z.object({
  source: SourceId,
  state: SourceState,
  /** When this source's data last refreshed successfully (ms). */
  updatedAt: z.number().nullable(),
  /** Short, factual detail for "changed" and "offline", e.g. the call that failed. */
  detail: z.string().nullable(),
});
export type SourceStatus = z.infer<typeof SourceStatus>;

/** An attendance target: a whole percent, 50–100. */
export const AttendanceTarget = z.number().int().min(50).max(100);

/** How long before a Task's deadline a reminder can come, in hours: 2 days, 1 day, 3 hours, 1 hour. */
export const DEADLINE_REMINDERS = [48, 24, 3, 1] as const;
export const DeadlineReminder = z.literal(DEADLINE_REMINDERS);
export type DeadlineReminder = z.infer<typeof DeadlineReminder>;

export const Theme = z.enum(["system", "light", "dark"]);
export const Lang = z.enum(["id", "en"]);
export type Lang = z.infer<typeof Lang>;

/**
 * The Student's choices. Every field also has a default in DEFAULT_SETTINGS,
 * so settings saved by an older version still load. (Defaults stay out of the
 * schema: a partial update must never reset the fields it doesn't mention.)
 */
export const Settings = z.object({
  theme: Theme,
  lang: Lang,

  // Alerts (#75)
  /** Alert groups the Student turned off: no OS notification (they still land in the history). */
  mutedAlerts: z.array(z.string()),
  /** Closing the window keeps the app alerting from the tray; false quits instead. */
  closeToTray: z.boolean(),
  /** The one-time "still running in the tray" explainer was shown. */
  trayExplained: z.boolean(),
  /** When to remind the Student before a deadline they haven't handed in (hours before). None chosen: no deadline reminders at all. */
  deadlineReminders: z.array(DeadlineReminder),
  /**
   * "Class in 15 minutes", off until the Student turns it on. Its own switch:
   * a group missing from `mutedAlerts` is on, even for settings saved before it existed.
   */
  classSoonAlerts: z.boolean(),

  // Attendance (#85)
  /** The share of meetings (percent) the Student aims to attend, for every course without its own target. */
  attendanceTarget: AttendanceTarget,
  /** A course's own target (percent) by course code, from its course contract; see `targetFor`. */
  attendanceTargets: z.record(z.string().min(1).max(32), AttendanceTarget),

  // First-run scan (#81)
  /** The first full sync's findings were shown (or there were none): the scan doesn't open by itself again. */
  firstScanDone: z.boolean(),
});
export type Settings = z.infer<typeof Settings>;

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  lang: "id",

  // Alerts (#75)
  mutedAlerts: [],
  closeToTray: true,
  trayExplained: false,
  deadlineReminders: [48, 24, 3],
  classSoonAlerts: false,

  // Attendance (#85)
  attendanceTarget: 80,
  attendanceTargets: {},

  // First-run scan (#81)
  firstScanDone: false,
};

export interface Dataset<T = unknown> {
  value: T;
  fetchedAt: number;
  hash: string;
}
