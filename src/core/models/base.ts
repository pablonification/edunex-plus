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

/**
 * A row of a service's page the app didn't understand, so it left that row out and read the rest
 * (a fee SIX lists that isn't a term's UKT, say): the row as the page shows it, and what didn't fit.
 * `blank`: the row was kept, with what didn't fit left blank (a bill's payment written another way).
 */
export const SkippedRow = z.object({ row: z.string(), why: z.string(), blank: z.boolean().optional() });
export type SkippedRow = z.infer<typeof SkippedRow>;
/** By dataset ("six.bills"): the rows its last read left out. A dataset read without any isn't here. */
export const SkippedRows = z.record(z.string(), z.array(SkippedRow));
export type SkippedRows = z.infer<typeof SkippedRows>;

/**
 * One page of a source whose layout changed while the rest still reads (SIX's fees page, its timetable):
 * the datasets it fills, whose screens say so and keep the last data, and what didn't fit.
 */
export const ChangedPage = z.object({ datasets: z.array(z.string()), detail: z.string() });
export type ChangedPage = z.infer<typeof ChangedPage>;

export const SourceStatus = z.object({
  source: SourceId,
  state: SourceState,
  /** When this source's data last refreshed successfully (ms). */
  updatedAt: z.number().nullable(),
  /** Short, factual detail for "changed" and "offline", e.g. the call that failed. */
  detail: z.string().nullable(),
  /** Pages that changed without the whole source changing (FeedSpec.shows). Saved by a version from 0.1.0-alpha.16 on. */
  changedPages: z.array(ChangedPage).optional(),
});
export type SourceStatus = z.infer<typeof SourceStatus>;

/** An attendance target: a whole percent, 50–100. */
export const AttendanceTarget = z.number().int().min(50).max(100);

/** How long before a Task's deadline a reminder can come, in hours: 2 days, 1 day, 3 hours, 1 hour. */
export const DEADLINE_REMINDERS = [48, 24, 3, 1] as const;
export const DeadlineReminder = z.literal(DEADLINE_REMINDERS);
export type DeadlineReminder = z.infer<typeof DeadlineReminder>;

/** How many whole days after today Beranda's "Perlu perhatianmu" looks ahead: 3 days, a week, 2 weeks. */
export const NEEDS_AHEAD = [3, 7, 14] as const;
export const NeedsAhead = z.literal(NEEDS_AHEAD);
export type NeedsAhead = z.infer<typeof NeedsAhead>;

/** Hours on this computer's clock when the phone holds alerts that can wait (start to end, across midnight when end is earlier). */
export const QuietHours = z
  .object({ start: z.number().int().min(0).max(23), end: z.number().int().min(0).max(23) })
  .refine((quiet) => quiet.start !== quiet.end, "Quiet hours must start and end at different hours");
export type QuietHours = z.infer<typeof QuietHours>;

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
  /** On the phone only: alerts that aren't urgent wait until these hours end. Null: off. */
  phoneQuietHours: QuietHours.nullable(),

  // Attendance (#85)
  /** The share of meetings (percent) the Student aims to attend, for every course without its own target. */
  attendanceTarget: AttendanceTarget,
  /** A course's own target (percent) by course code, from its course contract; see `targetFor`. */
  attendanceTargets: z.record(z.string().min(1).max(32), AttendanceTarget),

  // Beranda
  /** How far ahead "Perlu perhatianmu" looks: what's due by the end of that day shows there (see `needsRange`). */
  needsAhead: NeedsAhead,

  // Files
  /** The app the Student last opened each kind of file in, by extension (".pdf"): its place on this computer. */
  openWith: z.record(z.string().max(16), z.string().max(1000)),

  // Updates
  /** "Perbarui otomatis": a newer version downloads by itself and is put in place when the Student quits the app. */
  autoUpdate: z.boolean(),

  // First-run scan (#81)
  /** The first full sync's findings were shown (or there were none): the scan doesn't open by itself again. */
  firstScanDone: z.boolean(),
});
export type Settings = z.infer<typeof Settings>;

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  // A first start is in English; a Student who picked Bahasa Indonesia keeps it (it's saved).
  lang: "en",

  // Alerts (#75)
  mutedAlerts: [],
  closeToTray: true,
  trayExplained: false,
  deadlineReminders: [48, 24, 3],
  classSoonAlerts: false,
  phoneQuietHours: { start: 22, end: 6 },

  // Attendance (#85)
  attendanceTarget: 80,
  attendanceTargets: {},

  // Beranda
  needsAhead: 7,

  // Files
  openWith: {},

  // Updates
  autoUpdate: true,

  // First-run scan (#81)
  firstScanDone: false,
};

export interface Dataset<T = unknown> {
  value: T;
  fetchedAt: number;
  hash: string;
}
