// The issue a report becomes, in English for the maintainer (the Student's note may be Indonesian):
// what couldn't be read and which check failed, the rows as SIX wrote them, whether the scrubbed
// pages fail the same way, what it cost, and where it came from. Never the pages or the app's log:
// those stay with the relay, for the maintainer and the fix bot to fetch by report id.
//
// Every word that comes from a report is inside code, behind a fence nothing in it can close, so it
// can't mention anyone, link anywhere or change the page. The relay's own lines come first, between
// two markers, with the reports' ids and the signature in the first: the fix bot reads that line.
import type { Envelope, Problem, Reproduces } from "./report";
import { systemOf } from "./report";

export const MARKER = "edunex-plus-relay";
const END = `<!-- /${MARKER} -->`;

/** An issue's title, labels and its text below the relay's lines: what a report opens. */
export interface Draft {
  title: string;
  labels: string[];
  body: string;
}

/** What the relay's lines at the top of an issue say. */
export interface IssueHeader {
  kind: "drift" | "bug";
  key: string;
  count: number;
  /** The latest ten, newest first, and the latest whose scrubbed pages fail the same way. */
  reports: string[];
  reproducing: string | null;
  reproduces: Reproduces;
  /** Whether the fix bot starts on the issue by itself. */
  botStarts: boolean;
  latest: { at: number; version: string };
}

export interface QueuedNote {
  report: string;
  at: number;
  note: string;
}

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

const longestRun = (text: string) => Math.max(0, ...[...text.matchAll(/`+/g)].map((run) => run[0].length));

/** Text as inline code, on one line, with a fence longer than any backticks in it. */
export function span(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  const fence = "`".repeat(longestRun(flat) + 1);
  return `${fence} ${flat} ${fence}`;
}

/** Text as a code block, its fence longer than any backticks in it. */
export function block(text: string, lang = "text"): string {
  const fence = "`".repeat(Math.max(3, longestRun(text) + 1));
  return `${fence}${lang}\n${text}\n${fence}`;
}

/** Lines of at most `width` characters, so a note reads without scrolling sideways. */
function wrap(text: string, width = 100): string {
  return text
    .split("\n")
    .map((line) => {
      const lines: string[] = [];
      let current = "";
      for (const word of line.split(/ +/)) {
        if (current && current.length + 1 + word.length > width) {
          lines.push(current);
          current = word;
        } else current = current ? `${current} ${word}` : word;
      }
      lines.push(current);
      return lines.join("\n");
    })
    .join("\n");
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "27 Oct 2026, 14:05 WIB": the maintainer's time. */
export function when(at: number): string {
  const wib = new Date(at + 7 * 3_600_000);
  const two = (n: number) => String(n).padStart(2, "0");
  return `${wib.getUTCDate()} ${MONTHS[wib.getUTCMonth()]} ${wib.getUTCFullYear()}, ${two(wib.getUTCHours())}:${two(wib.getUTCMinutes())} WIB`;
}

const plural = (count: number, one: string, other: string) => `${count} ${count === 1 ? one : other}`;

/** Each feed's page, as the app's screens name it (src/core/strings/report.ts, in English). */
const PAGES: Record<string, string> = {
  "six.status": "student status",
  "six.schedule": "schedule",
  "six.checkIn": "schedule",
  "six.transcript": "grades",
  "six.curriculum": "curriculum",
  "six.krs": "KRS",
  "six.bills": "UKT",
  "edunex.account": "account",
  "edunex.courses": "course",
  "edunex.tasks": "task",
  "edunex.materials": "material",
  "edunex.notifications": "notification",
};

/** What went wrong, as the app says it in English: "SIX changed its UKT page", "3 rows on the student status page aren't recognised". */
export function heading(problem: Problem): string {
  const page = PAGES[problem.feed];
  if (problem.kind === "skipped") {
    const count = problem.rows.length;
    return `${plural(count, "row", "rows")} on the ${page ?? "SIX"} page ${count === 1 ? "isn't" : "aren't"} recognised`;
  }
  if (systemOf(problem.feed) === "six") return page ? `SIX changed its ${page} page` : "SIX changed one of its pages";
  return page ? `Edunex changed its ${page} data` : "Edunex changed its data";
}

const REPRODUCES: Record<Reproduces, string> = {
  yes: "**yes**, re-reading the scrubbed pages fails the same way.",
  no: "**no**, the scrubbed pages read fine: scrubbing may have changed what failed.",
  unknown: "not known: this version of the app doesn't check.",
};

const CELLS = 5;
const ROWS = 10;

function rowsLeftOut(problem: Problem): string[] {
  const out = ["### Rows left out", ""];
  const why = (row: string) => problem.rows.find((one) => one.row === row)?.why;
  if (problem.cells?.length) {
    let header: string | null = null;
    for (const [i, cell] of problem.cells.slice(0, CELLS).entries()) {
      const check = why(cell.row);
      out.push(`**${i + 1}.** ${span(clip(cell.row, 300))}`);
      if (check) out.push(`Check: ${span(clip(check, 300))}`);
      out.push(`Shape: ${span(clip(cell.shape, 300))}`, "", block(cell.html, "html"), "");
      // Rows of one table share its header: it's shown once, under the first.
      if (cell.header !== null && cell.header !== header) out.push("Its table's header row:", "", block(cell.header, "html"), "");
      header = cell.header;
    }
    if (problem.cells.length > CELLS) out.push(`And ${plural(problem.cells.length - CELLS, "more row", "more rows")}: the report has them all.`, "");
    return out;
  }
  for (const row of problem.rows.slice(0, ROWS)) out.push(`- ${span(clip(row.row, 300))}, check: ${span(clip(row.why, 300))}`);
  if (problem.rows.length > ROWS) out.push(`- And ${plural(problem.rows.length - ROWS, "more row", "more rows")}: the report has them all.`);
  out.push("");
  return out;
}

function affects(problem: Problem): string[] {
  const out = ["### What it affects", "", `- Reproduces: ${REPRODUCES[problem.reproduces ?? "unknown"]}`];
  const impact = problem.impact;
  if (impact) {
    if (impact.datasets.length) out.push(`- Data: ${impact.datasets.map(span).join(", ")}.`);
    out.push(`- Rows left out: ${impact.rowsLeftOut}. Details left blank: ${impact.detailsBlank}.`);
    out.push(`- Last good read: ${impact.lastGoodAt === null ? "never" : when(impact.lastGoodAt)}.`);
  }
  out.push("");
  return out;
}

function from(envelope: Envelope): string[] {
  const out = [
    "### Where it came from",
    "",
    `- Edunex Plus ${envelope.report.version} on ${span(clip(envelope.os, 200))}.`,
    envelope.how === "auto" ? "- Sent automatically: the student turned that on." : "- Sent by the student.",
    "",
  ];
  const note = envelope.note?.trim();
  if (note) out.push("### What the student wrote", "", block(wrap(note)), "");
  return out;
}

/** What a problem opens: its title, labels and text. */
export function driftDraft(problem: Problem, envelope: Envelope): Draft {
  const body = [`## ${heading(problem)}`, ""];
  // Rows left out each say their own check.
  if (problem.kind === "skipped" && problem.rows.length) body.push(...rowsLeftOut(problem));
  else body.push("**Check**", "", block(problem.check), "");
  body.push(...affects(problem), ...from(envelope));
  return {
    title: clip(`${heading(problem)} (${clip(problem.check.replace(/\s+/g, " "), 90)})`, 200),
    labels: [`${systemOf(problem.feed)}-drift`, "needs-triage", "from-relay"],
    body: clip(body.join("\n").trimEnd(), 60_000),
  };
}

/** What a report with no problem in it opens (sent from Settings): a bug, with how each system was doing. */
export function bugDraft(envelope: Envelope): Draft {
  const body = ["## A report with no page in it", "", "The student sent it from Settings, while nothing the app couldn't read was kept.", ""];
  const sources = envelope.report.sources ?? [];
  if (sources.length) {
    body.push("### How each system was doing", "");
    for (const source of sources) body.push(`- ${span(source.source)}: ${span(source.state)}${source.detail ? `, ${span(clip(source.detail, 300))}` : ""}`);
    body.push("");
  }
  body.push(...from(envelope));
  return { title: `Report from Edunex Plus ${envelope.report.version}`, labels: ["bug", "needs-triage", "from-relay"], body: body.join("\n").trimEnd() };
}

/** The relay's lines at the top of an issue: the marker the fix bot reads, and how many reports it has seen. */
export function header(facts: IssueHeader): string {
  const marker = {
    v: 1,
    kind: facts.kind,
    signature: facts.key,
    reports: facts.reports,
    reproducing: facts.reproducing,
    reproduces: facts.reproduces,
    botStarts: facts.botStarts,
  };
  return [
    `<!-- ${MARKER} ${JSON.stringify(marker)} -->`,
    "> [!NOTE]",
    `> Filed by the report relay. Seen by **${plural(facts.count, "report", "reports")}**, the latest on ${when(facts.latest.at)}, from Edunex Plus ${facts.latest.version}. ` +
      "The pages and the app's log stay private: the maintainer and the fix bot fetch them by report id.",
    END,
  ].join("\n");
}

/** `body` with the relay's lines replaced, or put back on top if someone took them out. */
export function withHeader(body: string, lines: string): string {
  const end = body.startsWith(`<!-- ${MARKER} `) ? body.indexOf(END) : -1;
  return end === -1 ? `${lines}\n\n${body}` : `${lines}${body.slice(end + END.length)}`;
}

/** A comment with notes Students added, each in its own block. */
export function notesComment(notes: readonly QueuedNote[]): string {
  return notes.map((one) => `**A note on report ${span(one.report)}**, ${when(one.at)}:\n\n${block(wrap(one.note))}`).join("\n\n");
}

/** A comment for a closed issue that more reports reached. */
export function seenAgain(more: number, latest: { at: number; version: string }): string {
  return (
    `Seen again since this was closed: ${plural(more, "more report", "more reports")}, the latest on ${when(latest.at)}, from Edunex Plus ${latest.version}. ` +
    "Reopen it if the fix should have reached that version."
  );
}
