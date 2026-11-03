// A report read again with today's readers (`npm run report:replay`, scripts/report-replay.mjs): for each problem, what
// its scrubbed pages make now. The same check failing, another one (a page with two problems shows the next one once the
// first is fixed), rows left out, or the page read whole: what a fix is checked against, on the Student's own page,
// before it goes out. Offline, from the report alone, as ./reread.ts reads them when the report is put together.
import type { ProblemReport, ReportProblem } from "../../core/models";
import type { AnswerCheck } from "../http/transport";
import { read } from "../sources/edunex/client";
import { Announcements, Exams, Gradebook } from "../sources/edunex/course-page";
import { CoursePairs, LoginMe, NotificationFeed } from "../sources/edunex/schemas";
import { CourseTasks } from "../sources/edunex/task-records";
import { Comments } from "../sources/edunex/task-threads";
import type { SixIdentity } from "../sources/six/pages";
import { type Outcome, type PageAgain, readAgain } from "./reread";

/** Edunex's answers by their address, with the check the app runs on each. An address not here can't be read again. */
const EDUNEX_CHECKS: [RegExp, Parameters<typeof read>[1]][] = [
  [/^\/course\/tasks$/, CourseTasks],
  [/^\/course\/comments$/, Comments],
  [/^\/login\/me$/, LoginMe],
  [/^\/course\/presences\/list$/, CoursePairs],
  [/^\/notifications\/\d+$/, NotificationFeed],
  [/^\/gradebook$/, Gradebook],
  [/^\/exam\/exams$/, Exams],
  [/^\/course\/announcements\/course\/\d+$/, Announcements],
];

export interface Replayed {
  feed: string;
  /** What went wrong on the Student's computer, in the report's words. */
  was: Outcome;
  /** What today's readers make of the same pages; null when they can't run on them (a page that isn't in the report). */
  now: Outcome | null;
  /** In a word: "fixed" (read whole), "same" (fails as it did), "other" (fails another way, or leaves out other rows), "unknown". */
  verdict: "fixed" | "same" | "other" | "unknown";
}

export async function replayReport(report: ProblemReport): Promise<Replayed[]> {
  return Promise.all(report.problems.map((problem) => replayProblem(problem)));
}

async function replayProblem(problem: ReportProblem): Promise<Replayed> {
  const was: Outcome = { check: problem.kind === "changed" ? problem.check : null, rows: problem.rows };
  const pages = problem.pages.map((page): PageAgain => ({ ...page, ...(page.system === "edunex" ? { check: edunexCheck(page.path) } : {}) }));
  const now = await readAgain({ feed: problem.feed, at: problem.at, get: () => undefined }, { pages, who: identityOf(problem), expected: was });
  return { feed: problem.feed, was, now, verdict: verdictOf(was, now) };
}

function edunexCheck(path: string): AnswerCheck | undefined {
  const pathname = new URL(path, "https://edunex.invalid").pathname;
  const schema = EDUNEX_CHECKS.find(([address]) => address.test(pathname))?.[1];
  return schema && ((answer) => read(answer, schema));
}

/** Who SIX's pages are about, as their scrubbed addresses say: "/app/mahasiswa:18223901+2026-1/…/2021000001". */
function identityOf(problem: ReportProblem): SixIdentity | null {
  const paths = problem.pages.filter((page) => page.system === "six").map((page) => page.path);
  const nim = paths.map((path) => /mahasiswa:(\d+)/.exec(path)?.[1]).find(Boolean);
  if (!nim) return null;
  const studentId = paths.map((path) => /\/(\d{10})(?=[/?]|$)/.exec(path)?.[1]).find(Boolean) ?? "";
  const term = paths.map((path) => /mahasiswa:\d+\+(\d{4}-[123])/.exec(path)?.[1]).find(Boolean) ?? "";
  return { nim, studentId, term };
}

function verdictOf(was: Outcome, now: Outcome | null): Replayed["verdict"] {
  if (!now) return "unknown";
  if (now.check === null && now.rows.length === 0) return "fixed";
  const sameRows = now.rows.length === was.rows.length && now.rows.every((row, i) => row.why === was.rows[i]!.why);
  return now.check === was.check && sameRows ? "same" : "other";
}
