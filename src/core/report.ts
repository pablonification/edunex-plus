// What "Laporkan masalah" sends (ADR 0007), put into words: each problem said plainly, its page
// named as the app's screens name it; the new GitHub issue, filled in; and the file with the
// scrubbed pages and the Student's note, which goes to LINE or GitHub. The report itself is built
// and scrubbed by the engine (src/engine/report); main saves and opens (src/desktop/report.ts).
import { z } from "zod";
import { NEW_ISSUE_URL } from "./links";
import { ProblemReport, type ReportProblem } from "./models";
import { type Lang, type StringKey, translate } from "./strings";

/** A report as the window shows it and main sends it: the engine's, with the computer's system. `id` names it back. */
export const ReportPreview = z.object({ id: z.string(), os: z.string(), report: ProblemReport });
export type ReportPreview = z.infer<typeof ReportPreview>;

/** The longest note a Student can add ("Apa yang sedang kamu lakukan?"). */
export const MAX_NOTE = 1000;
/** What goes in a web address GitHub opens, with room for its title and form. */
const MAX_SUMMARY = 2500;
const MAX_ROWS = 10;

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

/** "/app/mahasiswa:18223901+2026-1/keuangan?bulan=202610" → "/keuangan": a page's address, for the technical details. */
export const pageLabel = (path: string) => path.replace(/^\/app\/mahasiswa:[^/]+/, "").replace(/\?.*$/, "") || "/";

export const systemOf = (problem: Pick<ReportProblem, "feed">) => (problem.feed.startsWith("six.") ? "six" : "edunex");

/** Each feed's page, named as the screens that show its data name it. */
const PAGES: Record<string, StringKey> = {
  "six.status": "report.page.status",
  "six.schedule": "report.page.schedule",
  "six.checkIn": "report.page.schedule",
  "six.transcript": "report.page.grades",
  "six.curriculum": "report.page.curriculum",
  "six.krs": "report.page.krs",
  "six.bills": "report.page.ukt",
  "edunex.account": "report.page.account",
  "edunex.courses": "report.page.courses",
  "edunex.tasks": "report.page.tasks",
  "edunex.materials": "report.page.materials",
  "edunex.notifications": "report.page.notifications",
};

/** A feed's page as the screens name it ("UKT"), or null for one they don't name. */
export function pageName(feed: string, lang: Lang): string | null {
  const key = PAGES[feed];
  return key ? translate(lang, key) : null;
}

/**
 * What went wrong, in a sentence a Student reads: "SIX mengubah halaman UKT", "1 baris di halaman
 * UKT belum dikenali". `rows`: the rows left out, or how many.
 */
export function problemHeading(problem: Pick<ReportProblem, "feed" | "kind"> & { rows: readonly unknown[] | number }, lang: Lang): string {
  const page = pageName(problem.feed, lang);
  const rows = typeof problem.rows === "number" ? problem.rows : problem.rows.length;
  if (problem.kind === "skipped") return translate(lang, "report.skipped", { count: rows, page: page ?? "SIX" });
  if (systemOf(problem) === "six") return page ? translate(lang, "report.changed.six", { page }) : translate(lang, "report.changed.sixAny");
  return page ? translate(lang, "report.changed.edunex", { page }) : translate(lang, "report.changed.edunexAny");
}

/** "`a`", safe for any text from a page: a code span with a fence longer than any backticks inside. */
const code = (text: string) => {
  const fence = "`".repeat(Math.max(0, ...[...text.matchAll(/`+/g)].map((run) => run[0].length)) + 1);
  return `${fence} ${text} ${fence}`;
};

/** The issue's own words: each problem in a sentence, the app's check as code under it, then the app and system. */
export function reportSummary({ report, os }: ReportPreview, lang: Lang): string {
  const lines: string[] = [];
  for (const problem of report.problems) {
    lines.push(`${problemHeading(problem, lang)}.`);
    if (problem.kind === "changed") lines.push(code(clip(problem.check, 400)));
    else for (const row of problem.rows.slice(0, MAX_ROWS)) lines.push(`- ${code(clip(row.row, 160))} ${code(clip(row.why, 200))}`);
    lines.push("");
  }
  lines.push(translate(lang, "report.app", { version: report.version, os }));
  return clip(lines.join("\n"), MAX_SUMMARY);
}

/**
 * A new issue on the app's repository, filled in: through the issue form for the system that
 * changed (its labels, six-drift or edunex-drift, apply for anyone who opens it), or the bug form
 * when the app has no page to report. The Student's note goes in its own box.
 */
export function reportIssueUrl(preview: ReportPreview, note: string, lang: Lang): string {
  const first = preview.report.problems[0];
  const summary = reportSummary(preview, lang);
  const doing = clip(note.trim(), MAX_NOTE);
  const query = new URLSearchParams();
  if (first) {
    query.set("template", `${systemOf(first)}-drift.yml`);
    query.set("title", problemHeading(first, lang));
    query.set("report", summary);
    if (doing) query.set("doing", doing);
  } else {
    query.set("template", "bug.yml");
    query.set("title", translate(lang, "report.summaryTitle", { version: preview.report.version }));
    query.set("what", summary);
    if (doing) query.set("steps", doing);
    query.set("version", preview.report.version);
  }
  return `${NEW_ISSUE_URL}?${query}`;
}

/** Whether there's more than a web address can carry: a page, or what the app did (its log). The file carries it. */
export const needsFile = ({ report }: ReportPreview) => report.problems.some((problem) => problem.pages.length > 0) || (report.log?.length ?? 0) > 0;

/** "edunex-plus-report-2026-10-23-1405.json", in this computer's time. */
export function reportFileName(at: number): string {
  const d = new Date(at);
  const two = (n: number) => String(n).padStart(2, "0");
  return `edunex-plus-report-${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}-${two(d.getHours())}${two(d.getMinutes())}.json`;
}

/** The file: the report as the engine scrubbed it, with the system and the Student's note, for `npm run fixtures:from-report`. */
export const reportFile = ({ report, os }: ReportPreview, note: string) => `${JSON.stringify({ ...report, os, note: clip(note.trim(), MAX_NOTE) }, null, 2)}\n`;
