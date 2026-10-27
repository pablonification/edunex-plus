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
/** When a dataset was last read, as the screens say it ("Diperbarui …"). */
const readAt = (h: Harness, name: string) => h.engine.snapshot().datasets.find((dataset) => dataset.name === name)?.fetchedAt;

describe("a SIX page the app couldn't read", () => {
  it("is kept for a report, scrubbed, and fails there the same check; it's never saved or sent to the window", async () => {
    const h = await signedIn();
    expect(h.dataset("six.student")?.name).toBe("Rahmat Hidayatullah");
    expect((await h.engine.report({})).problems).toEqual([]);

    h.world.six.changeLayout(BILLS, "<th class='text-left'>Semester</th>", "<th>Periode</th>");
    await until(h, h.engine.refresh("six"));
    const changed = h.status("six").changedPages![0]!;
    const report = await h.engine.report({ datasets: ["six.bills"] });
    expect(report).toMatchObject({ format: 2, version: "2.0.0-test", sources: [{ source: "edunex" }, { source: "six", state: "live" }] });
    expect(report.problems).toEqual([
      {
        feed: "six.bills",
        datasets: ["six.bills"],
        kind: "changed",
        check: changed.detail,
        rows: [],
        at: expect.any(Number),
        pages: [{ system: "six", path: "/app/mahasiswa:18223901/keuangan", status: 200, body: expect.stringContaining("<th>Periode</th>") }],
        // Read again as it was scrubbed, it fails the same check: what the maintainer gets reproduces it.
        reproduces: "yes",
        // What the Student lost: the fees screen keeps the data from the read before.
        impact: { datasets: ["six.bills"], rowsLeftOut: 0, detailsBlank: 0, lastGoodAt: readAt(h, "six.bills") },
      },
    ]);
    expect(() => readBills(report.problems[0]!.pages[0]!.body)).toThrow(changed.detail);
    expect(sent(report)).not.toContain("Rahmat");
    expect(personalHits(sent(report))).toEqual([]);

    // Asked about the whole of SIX (its banner) or from Settings, it's there too; not for another page or Edunex.
    expect((await h.engine.report({ source: "six" })).problems).toHaveLength(1);
    expect((await h.engine.report({})).problems).toHaveLength(1);
    expect((await h.engine.report({ datasets: ["six.krs"] })).problems).toEqual([]);
    expect((await h.engine.report({ source: "edunex" })).problems).toEqual([]);

    // The page itself stays in memory: not on disk, not in what the window hears.
    expect([...h.storage.files.values()].some((text) => text.includes(MARKER))).toBe(false);
    expect(JSON.stringify(h.events)).not.toContain(MARKER);
    expect(JSON.stringify(h.engine.snapshot())).not.toContain(MARKER);
  });

  it("read as it was again, it's forgotten", async () => {
    const h = await signedIn();
    h.world.six.changeLayout(BILLS, "<th class='text-left'>Semester</th>", "<th>Periode</th>");
    await until(h, h.engine.refresh("six"));
    expect((await h.engine.report({})).problems).toHaveLength(1);
    h.world.six.changeLayout(BILLS, "<th>Periode</th>", "<th class='text-left'>Semester</th>");
    await until(h, h.engine.refresh("six"));
    expect((await h.engine.report({})).problems).toEqual([]);
  });

  it("signing out of SIX forgets it", async () => {
    const h = await signedIn();
    h.world.six.changeLayout(BILLS, "<th class='text-left'>Semester</th>", "<th>Periode</th>");
    await until(h, h.engine.refresh("six"));
    await h.engine.signOut("six");
    expect((await h.engine.report({})).problems).toEqual([]);
  });

  it("a page that never read says so: nothing was read well before", async () => {
    const h = await startEngine();
    h.world.six.changeLayout(BILLS, "<th class='text-left'>Semester</th>", "<th>Periode</th>");
    await until(h, h.engine.signIn("six", { cookie: PRETEND_SIX_COOKIE }));
    const [problem] = (await h.engine.report({ datasets: ["six.bills"] })).problems;
    expect(problem!.impact).toEqual({ datasets: ["six.bills"], rowsLeftOut: 0, detailsBlank: 0, lastGoodAt: null });
  });

  it("the timetable is read again for the month it was read in", async () => {
    const h = await signedIn();
    h.world.six.editPage(/\/kelas\/jadwal\/mahasiswa\/\d+$/, (html) => html.replace(/<thead>[\s\S]*?<\/thead>/, ""));
    await until(h, h.engine.refresh("six"));
    const [problem] = (await h.engine.report({ datasets: ["six.schedule"] })).problems;
    expect(problem).toMatchObject({ feed: "six.schedule", kind: "changed", check: "SIX jadwal: the month grid is missing", reproduces: "yes" });
  });

  it("a read that left rows out keeps its page and the rows, as the screens say them", async () => {
    const h = await signedIn();
    const wellRead = readAt(h, "six.courses");
    await h.wait(60_000);
    h.world.six.changeLayout(STATUS, "<td>PL3002</td>", "<td>PL-3002</td>");
    await until(h, h.engine.refresh("six"));
    const [problem] = (await h.engine.report({ datasets: ["six.courses"] })).problems;
    expect(problem).toMatchObject({ feed: "six.status", kind: "skipped", datasets: ["six.courses"], rows: h.dataset("six.skipped")!["six.courses"] });
    expect(problem!.check).toBe(problem!.rows[0]!.why);
    expect(problem!.pages.map((page) => page.path)).toContain("/app/mahasiswa:18223901/statusmhs");
    expect(sent(await h.engine.report({}))).not.toContain("Rahmat");
    // Scrubbed and read again, the page leaves out the same row for the same reason.
    expect(problem!.reproduces).toBe("yes");
    // The row itself, as SIX wrote it (its tooltip too), under its table's header, without the rest of the page.
    expect(problem!.cells).toEqual([
      {
        row: "4 · PL-3002 · Ekonomi dan Inovasi dalam Perencanaan · 01 · 3 · 85.71%",
        html: `<tr><th scope="row" class='text-right'>4</th><td>PL-3002</td><td>Ekonomi dan Inovasi dalam Perencanaan</td><td class="text-center">01</td><td class="text-center">3</td><td class="text-right"><span title="Hadir 6 dari 7 pertemuan">85.71%</span></td><td class="text-center"></td></tr>`,
        header: `<tr><th></th><th>Kode</th><th>Mata Kuliah</th><th class="text-center">Kelas</th><th class="text-center">SKS</th><th class="text-right">Kehadiran</th><th class="text-center">Nilai</th></tr>`,
        // Every word and number of the real row turned into "a" and "9": safe to show anyone, and its form stays.
        shape: "9 · a-9 · a a a a a · 9 · 9 · 9.9%",
      },
    ]);
    // One course gone from the screens; they were last read whole at sign-in.
    expect(problem!.impact).toEqual({ datasets: ["six.courses"], rowsLeftOut: 1, detailsBlank: 0, lastGoodAt: wellRead });

    h.world.six.changeLayout(STATUS, "<td>PL-3002</td>", "<td>PL3002</td>");
    await until(h, h.engine.refresh("six"));
    expect((await h.engine.report({})).problems).toEqual([]);
  });
});

describe("when a page last read whole", () => {
  it("is still known after the app restarts", async () => {
    const h = await signedIn();
    const wellRead = readAt(h, "six.courses");
    h.engine.stop();
    h.world.six.changeLayout(STATUS, "<td>PL3002</td>", "<td>PL-3002</td>");
    await h.wait(60 * 60_000);
    const again = await startEngine({ world: h.world, storage: h.storage, vault: h.vault });
    await until(again, again.engine.refresh("six"));
    const [problem] = (await again.engine.report({ datasets: ["six.courses"] })).problems;
    expect(problem!.impact).toMatchObject({ rowsLeftOut: 1, lastGoodAt: wellRead });
  });
});

describe("a report whose scrubbing took out what went wrong", () => {
  /** KU5014's attendance as SIX shows it: the percentage, and the count in its tooltip. */
  const attendance = (h: Harness, shown: string, count: string) =>
    h.world.six.editPage(STATUS, (html) =>
      html.replace(/<span title="Hadir 2 dari 6 pertemuan">33\.33%<\/span>|<span title="[^"]*">1\.00%<\/span>/, `<span title="${count}">${shown}</span>`),
    );
  const madeUp = (page: string) => /<td>KU5014<\/td>[\s\S]*?<span title="[^"]*">([\d.]+)%<\/span>/.exec(page)![1]!;

  it("says it doesn't fail the same way, and the row's shape keeps how SIX wrote it", async () => {
    const h = await signedIn();
    // "1.00%" for one meeting of two: the count doesn't fit, so the row is left out.
    attendance(h, "1.00%", "Hadir 1 dari 2 pertemuan");
    await until(h, h.engine.refresh("six"));
    const first = (await h.engine.report({ datasets: ["six.courses"] })).problems[0]!;
    expect(first.reproduces).toBe("yes");
    // Scrubbing makes up a small figure like that, as it does an IP ("1.00" → "2.xx"–"3.xx").
    const fake = madeUp(first.pages.find((page) => page.path.endsWith("/statusmhs"))!.body);
    expect(fake).not.toBe("1.00");

    // A count that fits the made-up figure, not the real one: SIX's page still leaves the row out, the scrubbed one doesn't.
    attendance(h, "1.00%", `Hadir ${Math.round(Number(fake) * 100)} dari 10000 pertemuan`);
    await until(h, h.engine.refresh("six"));
    const [problem] = (await h.engine.report({ datasets: ["six.courses"] })).problems;
    expect(problem!.rows.map((row) => row.why)).toEqual(["SIX statusmhs: course 3: attendance count and percentage disagree"]);
    expect(problem!.reproduces).toBe("no");
    const [cell] = problem!.cells!;
    expect(cell!.html).toContain(`>${fake}%</span>`);
    expect(cell!.shape).toBe("9 · a9 · a a a a · 9 · 9 · 9.9%");
  });
});

describe("an Edunex answer the app couldn't read", () => {
  it("keeps that answer alone, scrubbed, and it fails the same check", async () => {
    const h = await startEngine();
    await h.engine.signIn("edunex", { token: PRETEND_TOKEN });
    h.world.edunex.mangle(/^\/course\/presences\/list$/, { kind: "missing-field", field: "course_code" });
    await h.engine.refresh("edunex");
    expect(h.status("edunex").state).toBe("changed");

    const report = await h.engine.report({ source: "edunex" });
    expect(report.sources.find((source) => source.source === "edunex")).toEqual({ source: "edunex", state: "changed", detail: h.status("edunex").detail });
    const [problem] = report.problems;
    expect(problem).toMatchObject({ feed: "edunex.courses", kind: "changed", check: h.status("edunex").detail });
    expect(problem!.pages.map((page) => [page.system, page.path])).toEqual([["edunex", "/course/presences/list"]]);
    const parsed = CoursePairs.safeParse(JSON.parse(problem!.pages[0]!.body));
    const issue = parsed.success ? null : parsed.error.issues[0]!;
    expect(issue && `/course/presences/list: ${issue.path.join(".")} ${issue.message}`).toBe(problem!.check);
    expect(personalHits(sent(report))).toEqual([]);
    // Checked again as its call checks it, the scrubbed answer fails the same way.
    expect(problem!.reproduces).toBe("yes");
    // The courses as last read, at sign-in, are what the screens keep showing.
    expect(problem!.impact).toEqual({ datasets: ["edunex.courses"], rowsLeftOut: 0, detailsBlank: 0, lastGoodAt: readAt(h, "edunex.courses") });

    await h.engine.signOut("edunex");
    expect((await h.engine.report({})).problems).toEqual([]);
  });
});

describe("the app's own log", () => {
  it("goes with every report, one with no page too: what was read, sign-ins, errors, scrubbed like the pages", async () => {
    const h = await signedIn();
    h.log.add("error", "window", "TypeError: no grade for Rahmat Hidayatullah in /Users/rahmat/Library/Application Support/Edunex Plus");
    const report = await h.engine.report({});
    expect(report.problems).toEqual([]);
    expect(report.log).toEqual(
      expect.arrayContaining([
        { at: expect.any(Number), level: "info", area: "six", message: "signing in" },
        { at: expect.any(Number), level: "info", area: "six", message: "connecting → live" },
        { at: expect.any(Number), level: "info", area: "six.status", message: "ok" },
        {
          at: expect.any(Number),
          level: "error",
          area: "window",
          message: "TypeError: no grade for Dimas Pratama in /Users/~/Library/Application Support/Edunex Plus",
        },
      ]),
    );
    expect(sent(report).toLowerCase()).not.toContain("rahmat");
  });

  it("says how each read went, a page change and rows left out included", async () => {
    const h = await signedIn();
    h.world.six.changeLayout(BILLS, "<th class='text-left'>Semester</th>", "<th>Periode</th>");
    h.world.six.changeLayout(STATUS, "<td>PL3002</td>", "<td>PL-3002</td>");
    await until(h, h.engine.refresh("six"));
    const { log } = await h.engine.report({});
    expect(log).toEqual(
      expect.arrayContaining([
        {
          at: expect.any(Number),
          level: "error",
          area: "six.bills",
          message: expect.stringMatching(/^VendorChanged: SIX finance page: the bills header has no "Semester" column/),
        },
        { at: expect.any(Number), level: "warn", area: "six.courses", message: "1 row left out" },
      ]),
    );
  });

  it("never carries the Student's Edunex id, which the address of their notifications holds", async () => {
    const h = await startEngine();
    h.world.edunex.me = { ...h.world.edunex.me, id: 4_242_424 };
    await h.engine.signIn("edunex", { token: PRETEND_TOKEN });
    h.world.edunex.mangle(/^\/notifications\/\d+$/, { kind: "empty-body" });
    await h.engine.refresh("edunex");
    const report = await h.engine.report({});
    expect(report.log!.some((entry) => entry.area === "edunex.notifications" && entry.level === "error")).toBe(true);
    expect(sent(report)).not.toContain("4242424");
  });

  it("starts again when the Student signs out, or another Student's data arrives", async () => {
    const h = await signedIn();
    h.log.add("info", "test", "the first Student's line");
    await h.engine.signOut("six");
    expect(JSON.stringify((await h.engine.report({})).log)).not.toContain("the first Student's line");

    // Edunex now answers for someone else (another Student signed in on this computer).
    const other = await startEngine();
    await other.engine.signIn("edunex", { token: PRETEND_TOKEN });
    other.log.add("info", "test", "the first Student's line");
    other.world.edunex.me = { ...other.world.edunex.me, code: "18223955", name: "Budi Santoso" };
    await other.engine.refresh("edunex");
    expect(other.dataset("edunex.account")?.nim).toBe("18223955");
    expect(JSON.stringify((await other.engine.report({})).log)).not.toContain("the first Student's line");
  });

  it("keeps the last hour, 300 entries at most, and never on disk", async () => {
    const h = await startEngine({ start: false });
    for (let i = 1; i <= 350; i++) h.log.add("info", "test", `entry ${i}`);
    const capped = (await h.engine.report({})).log!.filter((entry) => entry.area === "test");
    expect(capped).toHaveLength(300);
    expect(capped[0]!.message).toBe("entry 51");
    expect([...h.storage.files.values()].some((text) => text.includes("entry 51"))).toBe(false);

    await h.wait(61 * 60_000);
    h.log.add("info", "test", "later");
    expect((await h.engine.report({})).log!.filter((entry) => entry.area === "test").map((entry) => entry.message)).toEqual(["later"]);
  });
});
