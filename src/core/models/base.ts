// What every part of the app shares: the sources, their status, and settings.
import { z } from "zod";

/** EduNex and SIX need the Student's sign-in; "itb" is ITB's public pages (academic calendar, course catalog). */
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

  // Attendance (#85)
});
export type Settings = z.infer<typeof Settings>;

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  lang: "id",

  // Alerts (#75)
  mutedAlerts: [],
  closeToTray: true,
  trayExplained: false,

  // Attendance (#85)
};

export interface Dataset<T = unknown> {
  value: T;
  fetchedAt: number;
  hash: string;
}
