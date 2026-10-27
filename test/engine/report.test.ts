// "Laporkan masalah" (ADR 0007) through the real engine, against the pretend SIX and Edunex: a
// read that goes wrong keeps the page behind it, in memory only, for a report that's scrubbed
// before anything leaves the engine. A read that goes right again, or signing out, forgets it.
import { describe, expect, it } from "vitest";
import type { ProblemReport } from "../../src/core/models";
import { CoursePairs } from "../../src/engine/sources/edunex/schemas";
import { readBills } from "../../src/engine/sources/six/readers/bills";
import { personalHits } from "../kit/privacy-rules";
import { PRETEND_TOKEN } from "../pretend/edunex";
import { PRETEND_SIX_COOKIE } from "../pretend/six";
import { type Harness, startEngine } from "./harness";

const BILLS = /\/keuangan$/;
const STATUS = /\/statusmhs$/;
/** In the fees page, where no reader looks: whether that page went anywhere it shouldn't. */
const MARKER = "<!-- the fees page itself -->";

/** Lets the fake clock run until `work` is done (SIX is read at human pace). */
async function until<T>(h: Harness, work: Promise<T>): Promise<T> {
  let outcome: { value: T } | { error: unknown } | null = null;
  void work.then(
    (value) => (outcome = { value }),
    (error: unknown) => (outcome = { error }),
  );
  for (let second = 0; second < 600 && !outcome; second++) await h.world.clock.advance(1_000);
  if (!outcome) throw new Error("still waiting after ten minutes");
  const done = outcome as { value: T } | { error: unknown };
  if ("error" in done) throw done.error;
  return done.value;
}

/** Signed in to SIX as a Student whose name isn't the made-up one, so the report has something to take out. */
async function signedIn() {
  const h = await startEngine();
  h.world.six.editPage(/./, (html) => html.split("Dimas Pratama").join("Rahmat Hidayatullah"));
  h.world.six.editPage(BILLS, (html) => html.replace("</body>", `${MARKER}</body>`));
  await until(h, h.engine.signIn("six", { cookie: PRETEND_SIX_COOKIE }));
  return h;
}

const sent = (report: ProblemReport) => JSON.stringify(report);

describe("a SIX page the app couldn't read", () => {
  it("is kept for a report, scrubbed, and fails there the same check; it's never saved or sent to the window", async () => {
    const h = await signedIn();
    expect(h.dataset("six.student")?.name).toBe("Rahmat Hidayatullah");
    expect(h.engine.report({}).problems).toEqual([]);

    h.world.six.changeLayout(BILLS, "<th class='text-left'>Semester</th>", "<th>Periode</th>");
    await until(h, h.engine.refresh("six"));
    const changed = h.status("six").changedPages![0]!;
    const report = h.engine.report({ datasets: ["six.bills"] });
    expect(report).toMatchObject({ format: 1, version: "2.0.0-test", sources: [{ source: "edunex" }, { source: "six", state: "live" }] });
    expect(report.problems).toEqual([
      {
        feed: "six.bills",
        datasets: ["six.bills"],
        kind: "changed",
        check: changed.detail,
        rows: [],
        at: expect.any(Number),
        pages: [{ system: "six", path: "/app/mahasiswa:18223901/keuangan", status: 200, body: expect.stringContaining("<th>Periode</th>") }],
      },
    ]);
    expect(() => readBills(report.problems[0]!.pages[0]!.body)).toThrow(changed.detail);
    expect(sent(report)).not.toContain("Rahmat");
    expect(personalHits(sent(report))).toEqual([]);

    // Asked about the whole of SIX (its banner) or from Settings, it's there too; not for another page or Edunex.
    expect(h.engine.report({ source: "six" }).problems).toHaveLength(1);
    expect(h.engine.report({}).problems).toHaveLength(1);
    expect(h.engine.report({ datasets: ["six.krs"] }).problems).toEqual([]);
    expect(h.engine.report({ source: "edunex" }).problems).toEqual([]);

    // The page itself stays in memory: not on disk, not in what the window hears.
    expect([...h.storage.files.values()].some((text) => text.includes(MARKER))).toBe(false);
    expect(JSON.stringify(h.events)).not.toContain(MARKER);
    expect(JSON.stringify(h.engine.snapshot())).not.toContain(MARKER);
  });

  it("read as it was again, it's forgotten", async () => {
    const h = await signedIn();
    h.world.six.changeLayout(BILLS, "<th class='text-left'>Semester</th>", "<th>Periode</th>");
    await until(h, h.engine.refresh("six"));
    expect(h.engine.report({}).problems).toHaveLength(1);
    h.world.six.changeLayout(BILLS, "<th>Periode</th>", "<th class='text-left'>Semester</th>");
    await until(h, h.engine.refresh("six"));
    expect(h.engine.report({}).problems).toEqual([]);
  });

  it("signing out of SIX forgets it", async () => {
    const h = await signedIn();
    h.world.six.changeLayout(BILLS, "<th class='text-left'>Semester</th>", "<th>Periode</th>");
    await until(h, h.engine.refresh("six"));
    await h.engine.signOut("six");
    expect(h.engine.report({}).problems).toEqual([]);
  });

  it("a read that left rows out keeps its page and the rows, as the screens say them", async () => {
    const h = await signedIn();
    h.world.six.changeLayout(STATUS, "<td>PL3002</td>", "<td>PL-3002</td>");
    await until(h, h.engine.refresh("six"));
    const [problem] = h.engine.report({ datasets: ["six.courses"] }).problems;
    expect(problem).toMatchObject({ feed: "six.status", kind: "skipped", datasets: ["six.courses"], rows: h.dataset("six.skipped")!["six.courses"] });
    expect(problem!.check).toBe(problem!.rows[0]!.why);
    expect(problem!.pages.map((page) => page.path)).toContain("/app/mahasiswa:18223901/statusmhs");
    expect(sent(h.engine.report({}))).not.toContain("Rahmat");

    h.world.six.changeLayout(STATUS, "<td>PL-3002</td>", "<td>PL3002</td>");
    await until(h, h.engine.refresh("six"));
    expect(h.engine.report({}).problems).toEqual([]);
  });
});

describe("an Edunex answer the app couldn't read", () => {
  it("keeps that answer alone, scrubbed, and it fails the same check", async () => {
    const h = await startEngine();
    await h.engine.signIn("edunex", { token: PRETEND_TOKEN });
    h.world.edunex.mangle(/^\/course\/presences\/list$/, { kind: "missing-field", field: "course_code" });
    await h.engine.refresh("edunex");
    expect(h.status("edunex").state).toBe("changed");

    const report = h.engine.report({ source: "edunex" });
    expect(report.sources.find((source) => source.source === "edunex")).toEqual({ source: "edunex", state: "changed", detail: h.status("edunex").detail });
    const [problem] = report.problems;
    expect(problem).toMatchObject({ feed: "edunex.courses", kind: "changed", check: h.status("edunex").detail });
    expect(problem!.pages.map((page) => [page.system, page.path])).toEqual([["edunex", "/course/presences/list"]]);
    const parsed = CoursePairs.safeParse(JSON.parse(problem!.pages[0]!.body));
    const issue = parsed.success ? null : parsed.error.issues[0]!;
    expect(issue && `/course/presences/list: ${issue.path.join(".")} ${issue.message}`).toBe(problem!.check);
    expect(personalHits(sent(report))).toEqual([]);

    await h.engine.signOut("edunex");
    expect(h.engine.report({}).problems).toEqual([]);
  });
});
