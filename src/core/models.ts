// App models: what the screens show, already joined and cleaned. The engine
// builds them from vendor data; the renderer only ever sees these.
import { z } from "zod";

export const SourceId = z.enum(["edunex", "six"]);
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

export const Account = z.object({
  name: z.string(),
  /** Student number (NIM). */
  nim: z.string(),
});
export type Account = z.infer<typeof Account>;

/** A course the Student takes this term, as EduNex knows it. SIX details join in later. */
export const Course = z.object({
  code: z.string(),
  name: z.string(),
  /** "01" from EduNex's "II4091-01". */
  classNo: z.string().nullable(),
  /** SIX term code: "2026-1". */
  term: z.string(),
  edunex: z.object({
    courseId: z.number(),
    classId: z.number(),
    /** Parent and child EduNex courses for the same class; information can sit in either. */
    relatedCourseIds: z.array(z.number()),
  }),
});
export type Course = z.infer<typeof Course>;

export const Theme = z.enum(["system", "light", "dark"]);
export const Lang = z.enum(["id", "en"]);
export type Lang = z.infer<typeof Lang>;

export const Settings = z.object({
  theme: Theme,
  lang: Lang,
});
export type Settings = z.infer<typeof Settings>;

export const DEFAULT_SETTINGS: Settings = { theme: "system", lang: "id" };

/** Every dataset the engine publishes, by name. */
export const Datasets = {
  "edunex.account": Account,
  "edunex.courses": z.array(Course),
} as const;
export type DatasetName = keyof typeof Datasets;
export type DatasetValue<N extends DatasetName> = z.infer<(typeof Datasets)[N]>;

export interface Dataset<T = unknown> {
  value: T;
  fetchedAt: number;
  hash: string;
}
