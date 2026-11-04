// `npm run report:replay` (scripts/report-replay.mjs): a report's scrubbed pages read again with today's readers, the
// way a fix is checked on the Student's own page before it goes out. Offline, from the report alone.
import { describe, expect, it } from "vitest";
import type { ProblemReport, ReportProblem } from "../../src/core/models";
import { replayReport } from "../../src/engine/report/replay";
import { edunexJson, sixPage } from "../kit/fixtures";

const TRANSCRIPT = "/app/mahasiswa:18223901/statusmhs/transkrip/historis/2021000001";
const PROGRESS = "/app/mahasiswa:18223901/statusmhs/transkrip/kurikulum/2021000001";
const TASKS = "/course/tasks?filter%5Bcourse_id%5D%5Bis%5D=95001&page%5Blimit%5D=0";

const reportOf = (...problems: Partial<ReportProblem>[]): ProblemReport => ({
  format: 2,
  version: "0.1.0-alpha.28",
  at: Date.parse("2026-11-03T09:00:00+07:00"),
  sources: [],
  problems: problems.map((problem) => ({
    feed: "six.transcript",
    datasets: [],
    kind: "changed",
    check: "",
    rows: [],
    at: Date.parse("2026-11-03T09:00:00+07:00"),
    pages: [],
    ...problem,
  })),
});

/** The curriculum position page with its second stage's heading cut short: a check today's reader still fails. */
const brokenProgress = () => sixPage(/\/transkrip\/kurikulum\/\d+$/).replace("(IP 3.18 / SKS Lulus 107)", "(IP 3.18 / SKS Lulus 107");
const sixPages = (progress: string) => [
  { system: "six" as const, path: TRANSCRIPT, status: 200, body: sixPage(/\/transkrip\/historis\/\d+$/) },
  { system: "six" as const, path: PROGRESS, status: 200, body: progress },
];

describe("a report read again with today's readers", () => {
  it("a SIX page that still fails says so, with the check it fails", async () => {
    const check = 'SIX curriculum position page: stage "Tahap Sarjana (IP 3.18 / SKS Lulus 107" isn\'t readable';
    const [result] = await replayReport(reportOf({ check, pages: sixPages(brokenProgress()) }));
    expect(result).toMatchObject({ feed: "six.transcript", verdict: "same", now: { check, rows: [] } });
  });

  it("a SIX page today's reader takes whole says it's fixed", async () => {
    const [result] = await replayReport(
      reportOf({ check: "SIX curriculum position page: a check an older reader failed", pages: sixPages(sixPage(/\/transkrip\/kurikulum\/\d+$/)) }),
    );
    expect(result).toMatchObject({ verdict: "fixed", now: { check: null, rows: [] } });
  });

  it("a page that fails another check than the report's says which: the next problem on a page with two", async () => {
    const [result] = await replayReport(reportOf({ check: "SIX curriculum position page: a problem fixed since", pages: sixPages(brokenProgress()) }));
    expect(result!.verdict).toBe("other");
    expect(result!.now!.check).toMatch(/stage "Tahap Sarjana .*" isn't readable/);
  });

  it("an Edunex answer is checked as its address is: a Task's null files read whole, a number still doesn't", async () => {
    const tasks = edunexJson<{ data: { attributes: { files: unknown } }[] }>("/course/tasks", { "filter[course_id][is]": "95001" });
    const answer = (files: unknown) => {
      tasks.data[0]!.attributes.files = files;
      return { system: "edunex" as const, path: TASKS, status: 200, body: JSON.stringify(tasks) };
    };
    const was = "/course/tasks: data.0.attributes.files Invalid input: expected array, received null";
    const [fixed, same] = await replayReport(
      reportOf(
        { feed: "edunex.tasks", check: was, pages: [answer(null)] },
        { feed: "edunex.tasks", check: "/course/tasks: data.0.attributes.files Invalid input: expected array, received number", pages: [answer(5)] },
      ),
    );
    expect(fixed!.verdict).toBe("fixed");
    expect(same!.verdict).toBe("same");
  });

  it("an Edunex address with no check listed, or a SIX page that isn't in the report, can't be read again: unknown, never fixed", async () => {
    const results = await replayReport(
      reportOf(
        { feed: "edunex.course", check: "x", pages: [{ system: "edunex", path: "/course/somewhere-new", status: 200, body: "{}" }] },
        { feed: "six.transcript", check: "x", pages: [sixPages(brokenProgress())[1]!] },
      ),
    );
    expect(results.map((result) => [result.verdict, result.now])).toEqual([
      ["unknown", null],
      ["unknown", null],
    ]);
  });
});
