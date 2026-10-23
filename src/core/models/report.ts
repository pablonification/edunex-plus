// A problem report ("Laporkan masalah", ADR 0007): what the app couldn't read, put together and
// scrubbed on the Student's computer (src/engine/report), for them to send the maintainer if they
// choose. Built only when asked; nothing here is saved or sent by itself.
import { z } from "zod";
import { SkippedRow, SourceId, SourceState } from "./base";

/**
 * What the Student asked about: a source (its banner, its row in the status panel), the datasets a
 * screen shows (its SIX page note), or neither (Settings: whatever the app has kept).
 */
export const ReportAbout = z.object({
  source: z.enum(["edunex", "six"]).optional(),
  datasets: z.array(z.string().max(60)).max(20).optional(),
});
export type ReportAbout = z.infer<typeof ReportAbout>;

/** A page as SIX or Edunex sent it, scrubbed: its path (scrubbed too), its status, its body (HTML or JSON). */
export const ReportPage = z.object({
  system: z.enum(["six", "edunex"]),
  path: z.string(),
  status: z.number(),
  body: z.string(),
});
export type ReportPage = z.infer<typeof ReportPage>;

/**
 * One read that went wrong: the feed, the datasets it fills, and how. `changed`: its page didn't
 * fit, `check` says what didn't. `skipped`: it read, with `rows` left out. With the pages it read.
 */
export const ReportProblem = z.object({
  feed: z.string(),
  datasets: z.array(z.string()),
  kind: z.enum(["changed", "skipped"]),
  check: z.string(),
  rows: z.array(SkippedRow),
  at: z.number(),
  pages: z.array(ReportPage),
});
export type ReportProblem = z.infer<typeof ReportProblem>;

export const ProblemReport = z.object({
  /** The report's layout, for the script that turns one into test data (scripts/report-to-fixtures.mjs). */
  format: z.literal(1),
  /** The app's version. */
  version: z.string(),
  /** When it was put together (ms). */
  at: z.number(),
  /** How each source the Student signs in to is doing, its detail scrubbed like the pages. */
  sources: z.array(z.object({ source: SourceId, state: SourceState, detail: z.string().nullable() })),
  /** The latest first. None: nothing the app couldn't read is kept (a report from Settings, say). */
  problems: z.array(ReportProblem),
});
export type ProblemReport = z.infer<typeof ProblemReport>;
