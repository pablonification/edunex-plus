// What "Laporkan masalah" sends (ADR 0007), put into words: the summary pasted on LINE and put in a
// new GitHub issue, that issue's address, and the file with the scrubbed pages. The report itself
// is built and scrubbed by the engine (src/engine/report); main sends it (src/desktop/report.ts).
import { z } from "zod";
import { NEW_ISSUE_URL } from "./links";
import { ProblemReport, type ReportProblem } from "./models";
import { type Lang, type StringKey, translate, type Vars } from "./strings";

/** A report as the window shows it and main sends it: the engine's, with the computer's system. `id` names it back to send. */
export const ReportPreview = z.object({ id: z.string(), os: z.string(), report: ProblemReport });
export type ReportPreview = z.infer<typeof ReportPreview>;

/** The longest note a Student can add ("Apa yang sedang kamu lakukan?"). */
export const MAX_NOTE = 1000;
/** A summary fits a web address GitHub opens, with room for its title and form. */
const MAX_SUMMARY = 2500;
const MAX_ROWS = 10;

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** "/app/mahasiswa:18223901+2026-1/keuangan?bulan=202610" → "/keuangan": a page as the report names it. */
export const pageLabel = (path: string) => path.replace(/^\/app\/mahasiswa:[^/]+/, "").replace(/\?.*$/, "") || "/";

export const systemOf = (problem: ReportProblem) => (problem.feed.startsWith("six.") ? "six" : "edunex");

/** "SIX · /keuangan · Tidak bisa dibaca": the system, its page, what went wrong. */
export function problemHeading(problem: ReportProblem, lang: Lang): string {
  const page = problem.pages[0] ? pageLabel(problem.pages[0].path) : problem.feed;
  const what = problem.kind === "changed" ? translate(lang, "report.changed") : translate(lang, "report.skipped", { count: problem.rows.length });
  return [translate(lang, `source.${systemOf(problem)}`), page, what].join(" · ");
}

/** The words that go with a report: what couldn't be read, how each source is doing, the Student's note, the file's name. */
export function reportSummary({ report, os }: ReportPreview, note: string, file: string | null, lang: Lang): string {
  const t = (key: StringKey, vars?: Vars) => translate(lang, key, vars);
  const lines = [t("report.summary.from", { version: report.version, os })];
  for (const problem of report.problems) {
    lines.push("", problemHeading(problem, lang));
    if (problem.kind === "changed") lines.push(clip(problem.check, 400));
    else for (const row of problem.rows.slice(0, MAX_ROWS)) lines.push(`- ${clip(row.row, 160)} (${clip(row.why, 200)})`);
  }
  const states = report.sources.map(
    (source) => `${t(`source.${source.source}`)}: ${source.state === "changed" ? t("status.changedShort") : t(`status.${source.state}`)}`,
  );
  if (states.length) lines.push("", t("report.summary.status", { list: states.join(" · ") }));
  if (note.trim()) lines.push("", t("report.summary.doing", { note: clip(note.trim(), MAX_NOTE) }));
  if (file) lines.push("", t("report.summary.file", { file }));
  return clip(lines.join("\n"), MAX_SUMMARY);
}

/**
 * A new issue on the app's repository, filled in: through the issue form for the system that
 * changed (its labels, six-drift or edunex-drift, apply for anyone who opens it), or the bug form
 * when the app has no page to report.
 */
export function reportIssueUrl({ report }: ReportPreview, summary: string, lang: Lang): string {
  const first = report.problems[0];
  const query = new URLSearchParams();
  if (first) {
    query.set("template", `${systemOf(first)}-drift.yml`);
    query.set("title", problemHeading(first, lang));
    query.set("report", summary);
  } else {
    query.set("template", "bug.yml");
    query.set("title", translate(lang, "report.summary.title", { version: report.version }));
    query.set("what", summary);
    query.set("version", report.version);
  }
  return `${NEW_ISSUE_URL}?${query}`;
}

/** Whether there's a page to send along, in the file. */
export const hasPages = ({ report }: ReportPreview) => report.problems.some((problem) => problem.pages.length > 0);

/** "edunex-plus-report-2026-10-23-1405.json", in this computer's time. */
export function reportFileName(at: number): string {
  const d = new Date(at);
  const two = (n: number) => String(n).padStart(2, "0");
  return `edunex-plus-report-${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}.json`;
}

/** The file: the report as the engine scrubbed it, with the system, for `npm run fixtures:from-report`. */
export const reportFile = ({ report, os }: ReportPreview) => `${JSON.stringify({ ...report, os }, null, 2)}\n`;
