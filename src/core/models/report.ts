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
 * Whether the scrubbed pages, read again the way the feed read them, still fail the same way (the
 * same check, or the same rows left out for the same reasons): "no" when taking the Student's
 * details out also took out what went wrong, "unknown" when the read can't run again offline.
 */
export const Reproduces = z.enum(["yes", "no", "unknown"]);
export type Reproduces = z.infer<typeof Reproduces>;

/**
 * A row a read left out, found in its scrubbed page: its markup and its table's header row (each cut
 * to 2000 characters; "" when no table row reads as it), and `shape`, the real row with every word
 * an "a" and every number a "9" ("82.35% / 94.12%" → "9.9% / 9.9%").
 */
export const ReportCell = z.object({ row: z.string(), html: z.string(), header: z.string(), shape: z.string() });
export type ReportCell = z.infer<typeof ReportCell>;

/**
 * What a problem cost the Student: the datasets it touched, how many rows it left out of them, how
 * many details it left blank, and when the screens' data was last read well (null: never).
 */
export const ReportImpact = z.object({
  datasets: z.array(z.string()),
  rowsLeftOut: z.number(),
  detailsBlank: z.number(),
  lastGoodAt: z.number().nullable(),
});
export type ReportImpact = z.infer<typeof ReportImpact>;

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
  /** Format 2 on. */
  reproduces: Reproduces.optional(),
  /** Format 2 on: the rows left out, as the page wrote them. */
  cells: z.array(ReportCell).optional(),
  /** Format 2 on. */
  impact: ReportImpact.optional(),
});
export type ReportProblem = z.infer<typeof ReportProblem>;

/** How much a line of the app's log matters: what it did, what didn't go to plan, what broke. */
export const LogLevel = z.enum(["info", "warn", "error"]);
export type LogLevel = z.infer<typeof LogLevel>;

/** A line of the app's own log (src/engine/app-log.ts): when, how much it matters, what it's about ("six.bills", "window"), what happened. */
export const LogEntry = z.object({ at: z.number(), level: LogLevel, area: z.string(), message: z.string() });
export type LogEntry = z.infer<typeof LogEntry>;

/** The public issue the relay filed for a report. */
export const ReportIssue = z.object({ number: z.number().int().positive(), url: z.string().url() });
export type ReportIssue = z.infer<typeof ReportIssue>;

/**
 * A report sent to the maintainer's relay: when, about which feeds' pages, how (by itself, or the
 * Student's "Kirim"), its id there (null when the relay files it later), and its public issue once
 * there is one. Never what was in it.
 */
export const SentReport = z.object({
  id: z.string().max(100).nullable(),
  at: z.number(),
  feeds: z.array(z.string().max(60)).max(20),
  how: z.enum(["auto", "manual"]),
  issue: ReportIssue.nullable(),
});
export type SentReport = z.infer<typeof SentReport>;

/** A problem the app is asking the Student about: the first one ever (`first`, asked once), or one more in "ask" mode. */
export const ReportAsking = z.object({
  feed: z.string().max(60),
  kind: z.enum(["changed", "skipped"]),
  rowsLeftOut: z.number().int().min(0),
  datasets: z.array(z.string().max(60)).max(20),
  first: z.boolean(),
  at: z.number(),
});
export type ReportAsking = z.infer<typeof ReportAsking>;

/** "app.reports": the reports sent, the newest first, and the problem the app is asking about now. */
export const ReportsState = z.object({ sent: z.array(SentReport).max(30), asking: ReportAsking.nullable() });
export type ReportsState = z.infer<typeof ReportsState>;

export const reportDatasets = {
  "app.reports": ReportsState,
} as const;

export const ProblemReport = z.object({
  /**
   * The report's layout, for the script that turns one into test data (scripts/report-to-fixtures.mjs).
   * 2 added what each problem's pages say when read again, with fields 1 doesn't have, all optional.
   */
  format: z.union([z.literal(1), z.literal(2)]),
  /** The app's version. */
  version: z.string(),
  /** When it was put together (ms). */
  at: z.number(),
  /** How each source the Student signs in to is doing, its detail scrubbed like the pages. */
  sources: z.array(z.object({ source: SourceId, state: SourceState, detail: z.string().nullable() })),
  /** The latest first. None: nothing the app couldn't read is kept (a report from Settings, say). */
  problems: z.array(ReportProblem),
  /** Format 2 on: the app's own log of the last hour, the oldest first, scrubbed like the pages. */
  log: z.array(LogEntry).optional(),
});
export type ProblemReport = z.infer<typeof ProblemReport>;
