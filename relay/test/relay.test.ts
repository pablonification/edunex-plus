// The report relay (relay/src, ADR 0015) through its API, as the app, the maintainer and the fix
// bot use it, on pretend storage and a pretend GitHub: what each of them is answered, and the
// issues the maintainer gets. Values that look personal are joined at run time, so the
// repository's own privacy test doesn't take this file for a leak.
import { describe, expect, it } from "vitest";
import { actionsToken, billsEnvelope, MAINTAINER, MINUTE, type Pretend, REPO, settingsEnvelope, startRelay, statusEnvelope } from "./fakes";

interface Sent {
  id: string;
  noteToken: string;
  issue: { number: number; url: string } | null;
  duplicate: boolean;
  seen: number;
}

async function sent(response: Response): Promise<Sent> {
  expect(response.status).toBe(201);
  return (await response.json()) as Sent;
}

/** The marker the fix bot reads, from the first line of an issue. */
function marker(body: string) {
  const [, json] = /^<!-- edunex-plus-relay (\{.*\}) -->$/m.exec(body.split("\n")[0]!) ?? [];
  return JSON.parse(json!) as { kind: string; signature: string; reports: string[]; reproducing: string | null; reproduces: string; botStarts: boolean };
}

/** Until each issue is up to date: the cooldown passes, then the cron trigger runs. */
async function later(r: Pretend, minutes = 11) {
  r.advance(minutes * MINUTE);
  await r.cron();
}

const NOTE =
  "Absenku dihitung sakit, jadi kehadirannya ditulis dua angka dan tiga mata kuliah hilang dari Edunex Plus. Tolong dicek ya, makasih. `kode` @someone #12";

describe("a report the app sends", () => {
  it("opens an issue that says what couldn't be read and how, the rows as SIX wrote them, and nothing private (#237)", async () => {
    const r = startRelay();
    const { id, issue, duplicate, seen } = await sent(await r.send(statusEnvelope([3, 4, 5], { note: NOTE })));
    expect(issue).toEqual({ number: 300, url: "https://github.com/pablonification/edunex-plus/issues/300" });
    expect({ duplicate, seen }).toEqual({ duplicate: false, seen: 1 });

    const opened = r.github.issue(300);
    expect(opened.title).toBe("3 rows on the student status page aren't recognised (SIX statusmhs: course 3: attendance without its count)");
    expect(opened.labels).toEqual(["six-drift", "needs-triage", "from-relay"]);
    expect(marker(opened.body)).toEqual({
      v: 1,
      kind: "drift",
      signature: expect.stringMatching(/^six-[0-9a-f]{16}$/),
      reports: [id],
      reproducing: id,
      reproduces: "yes",
      botStarts: true,
    });
    const row = (cells: string) => `<tr><th scope="row" class='text-right'>${cells}</td><td class="text-center"></td></tr>`;
    expect(opened.body.slice(opened.body.indexOf("\n") + 1)).toBe(
      [
        "> [!NOTE]",
        "> Filed by the report relay. Seen by **1 report**, the latest on 27 Oct 2026, 10:00 WIB, from Edunex Plus 0.1.0-alpha.22. The pages and the app's log stay private: the maintainer and the fix bot fetch them by report id.",
        "<!-- /edunex-plus-relay -->",
        "",
        "## 3 rows on the student status page aren't recognised",
        "",
        "### Rows left out",
        "",
        "**1.** ` 3 · IF2123 · Aljabar Linier dan Geometri · 01 · 3 · 81.25% / 93.75% `",
        "Check: ` SIX statusmhs: course 3: attendance without its count `",
        "Shape: ` 9 · aa9999 · a a a a · 9 · 9 · 9.9% / 9.9% `",
        "",
        "```html",
        row(
          '3</th><td>IF2123</td><td>Aljabar Linier dan Geometri</td><td class="text-center">01</td><td class="text-center">3</td><td class="text-right"><span title="Hadir">81.25%</span> / <span title="Sakit">93.75%</span>',
        ),
        "```",
        "",
        "Its table's header row:",
        "",
        "```html",
        '<tr><th></th><th>Kode</th><th>Mata Kuliah</th><th class="text-center">Kelas</th><th class="text-center">SKS</th><th class="text-right">Kehadiran</th><th class="text-center">Nilai</th></tr>',
        "```",
        "",
        "**2.** ` 4 · IF2130 · Sistem Operasi · 01 · 3 · 68.75% / 87.50% `",
        "Check: ` SIX statusmhs: course 4: attendance without its count `",
        "Shape: ` 9 · aa9999 · a a · 9 · 9 · 9.9% / 9.9% `",
        "",
        "```html",
        row(
          '4</th><td>IF2130</td><td>Sistem Operasi</td><td class="text-center">01</td><td class="text-center">3</td><td class="text-right"><span title="Hadir">68.75%</span> / <span title="Sakit">87.50%</span>',
        ),
        "```",
        "",
        "**3.** ` 5 · IF2150 · Rekayasa Perangkat Lunak · 01 · 4 · 87.50% / 93.75% `",
        "Check: ` SIX statusmhs: course 5: attendance without its count `",
        "Shape: ` 9 · aa9999 · a a a · 9 · 9 · 9.9% / 9.9% `",
        "",
        "```html",
        row(
          '5</th><td>IF2150</td><td>Rekayasa Perangkat Lunak</td><td class="text-center">01</td><td class="text-center">4</td><td class="text-right"><span title="Hadir">87.50%</span> / <span title="Sakit">93.75%</span>',
        ),
        "```",
        "",
        "### What it affects",
        "",
        "- Reproduces: **yes**, re-reading the scrubbed pages fails the same way.",
        "- Data: ` six.courses `.",
        "- Rows left out: 3. Details left blank: 0.",
        "- Last good read: never.",
        "",
        "### Where it came from",
        "",
        "- Edunex Plus 0.1.0-alpha.22 on ` Windows 10.0.26200 (x64) `.",
        "- Sent by the student.",
        "",
        "### What the student wrote",
        "",
        "```text",
        "Absenku dihitung sakit, jadi kehadirannya ditulis dua angka dan tiga mata kuliah hilang dari Edunex",
        "Plus. Tolong dicek ya, makasih. `kode` @someone #12",
        "```",
      ].join("\n"),
    );
    // The page and the app's log stay with the relay.
    expect(opened.body).not.toContain("Daftar Kuliah");
    expect(opened.body).not.toContain("read the status page");
  });

  it("goes to the issue every report of that problem goes to, whichever rows; the issue's count follows once a burst is over", async () => {
    const r = startRelay();
    const first = await sent(await r.send(statusEnvelope([3, 4, 5])));
    // Another Student, another course written the same way: the same problem.
    const second = await sent(await r.send(statusEnvelope([4], { note: "Sistem Operasi hilang" }), "198.51.100.20"));
    expect(second).toMatchObject({ issue: first.issue, duplicate: true, seen: 2 });
    for (let i = 0; i < 5; i++) await r.send(statusEnvelope([5], { version: "0.1.0-alpha.23" }));
    expect(r.github.calls).toEqual(["open"]);

    // Within the cooldown, the issue isn't changed for each report.
    await r.cron();
    expect(r.github.calls).toEqual(["open"]);
    await later(r);
    expect(r.github.calls).toEqual(["open", "read 300", "edit 300", "comment 300"]);
    const issue = r.github.issue(300);
    expect(issue.body).toContain("Seen by **7 reports**, the latest on 27 Oct 2026, 10:00 WIB, from Edunex Plus 0.1.0-alpha.23.");
    expect(marker(issue.body).reports).toHaveLength(7);
    expect(marker(issue.body).reports[0]).not.toBe(first.id);
    // The later report's note goes on as a comment.
    expect(issue.comments).toEqual([`**A note on report \` ${second.id} \`**, 27 Oct 2026, 10:00 WIB:\n\n\`\`\`text\nSistem Operasi hilang\n\`\`\``]);
    // The rest of the issue is as it was, and nothing more happens until another report.
    expect(issue.body).toContain("## 3 rows on the student status page aren't recognised");
    await later(r);
    expect(r.github.calls).toHaveLength(4);
  });

  it("keeps a maintainer's edits to the issue when it updates the count", async () => {
    const r = startRelay();
    await r.send(statusEnvelope());
    const issue = r.github.issue(300);
    issue.body = issue.body.replace("### What it affects", "Fixed in #250, needs a release.\n\n### What it affects");
    await r.send(statusEnvelope([4]));
    await later(r);
    expect(issue.body).toContain("Seen by **2 reports**");
    expect(issue.body).toContain("Fixed in #250, needs a release.");
  });

  it("opens another issue for another problem, and one for a changed page with its check", async () => {
    const r = startRelay();
    await r.send(statusEnvelope());
    const bills = await sent(await r.send(billsEnvelope()));
    const other = await sent(await r.send(billsEnvelope("SIX keuangan: a year of bills without its term")));
    expect([bills.issue?.number, other.issue?.number]).toEqual([301, 302]);
    const issue = r.github.issue(301);
    expect(issue.title).toBe("SIX changed its UKT page (SIX keuangan: the bills table has a different layout)");
    expect(issue.body).toContain("## SIX changed its UKT page\n\n**Check**\n\n```text\nSIX keuangan: the bills table has a different layout\n```");
    // A report from a version that doesn't check whether the scrubbed page fails: the bot waits for the maintainer.
    expect(issue.body).toContain("- Reproduces: not known: this version of the app doesn't check.");
    expect(issue.body).toContain("- Sent automatically: the student turned that on.");
    expect(marker(issue.body)).toMatchObject({ reproducing: null, reproduces: "unknown", botStarts: false });
  });

  it("from Settings, with no page in it, opens a bug of its own, a few a day", async () => {
    const r = startRelay();
    const one = await sent(await r.send(settingsEnvelope()));
    const issue = r.github.issue(one.issue!.number);
    expect(issue.title).toBe("Report from Edunex Plus 0.1.0-alpha.22");
    expect(issue.labels).toEqual(["bug", "needs-triage", "from-relay"]);
    expect(issue.body).toContain("### How each system was doing\n\n- ` edunex `: ` live `\n- ` six `: ` expired `, ` SIX asked to sign in again `");
    expect(issue.body).toContain("### What the student wrote\n\n```text\nJadwal minggu depan kosong\n```");
    expect(marker(issue.body)).toMatchObject({ kind: "bug", reports: [one.id], botStarts: false });

    for (let i = 0; i < 4; i++) await sent(await r.send(settingsEnvelope(), `198.51.100.${i}`));
    expect(r.github.issues).toHaveLength(5);
    const sixth = await r.send(settingsEnvelope(), "198.51.100.99");
    expect(sixth.status).toBe(429);
    expect(r.github.issues).toHaveLength(5);
  });
});

describe("what the relay turns away", () => {
  it("a report that still holds something personal, saying which kinds, and keeps nothing of it", async () => {
    const r = startRelay();
    const email = ["rahmat.hidayat", "gmail.com"].join("@");
    const nim = ["135", "22045"].join("");
    const envelope = statusEnvelope();
    envelope.report.problems[0]!.pages[0]!.body += `<p>${email}</p>`;
    envelope.report.log[0]!.message = `signed in as ${nim}`;
    const refused = await r.send(envelope);
    expect(refused.status).toBe(422);
    expect(await refused.json()).toEqual({ error: "personal", found: ["email", "student number"] });

    // A page with the Student's family data, which the app never reads.
    const family = statusEnvelope();
    family.report.problems[0]!.pages[0]!.path = "/app/mahasiswa:18223901/statusmhs/datainduk/summary/2021000001";
    expect(await (await r.send(family)).json()).toEqual({ error: "personal", found: ["private page"] });

    expect([...r.store.data.keys()].filter((key) => !key.startsWith("count:"))).toEqual([]);
    expect(r.github.calls).toEqual([]);
  });

  it("checks even a page of one endless word at once: anyone can send anything", async () => {
    const r = startRelay();
    const envelope = statusEnvelope();
    envelope.report.problems[0]!.pages[0]!.body = `${"a".repeat(300_000)}@ ${"eyJ".repeat(100_000)}`;
    const started = performance.now();
    await sent(await r.send(envelope));
    // Searched from every letter for an email address, or from every "eyJ" for a session token, this took minutes.
    expect(performance.now() - started).toBeLessThan(5000);
  });

  it("what isn't a report, and a report too big", async () => {
    const r = startRelay();
    const invalid = async (body: unknown) =>
      (await r.call("/v1/reports", { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) })).json();
    expect(await invalid("not json")).toEqual({ error: "invalid" });
    expect(await invalid({ ...statusEnvelope(), envelope: 2 })).toEqual({ error: "invalid" });
    expect(await invalid({ ...statusEnvelope(), report: { ...statusEnvelope().report, version: "<script>" } })).toEqual({ error: "invalid" });
    expect(await invalid({ ...statusEnvelope(), note: "x".repeat(1001) })).toEqual({ error: "invalid" });

    const big = statusEnvelope();
    big.report.problems[0]!.pages[0]!.body = "<p>".repeat(1024 * 1024);
    const tooBig = await r.send(big);
    expect(tooBig.status).toBe(413);
    expect(await tooBig.json()).toEqual({ error: "too-big" });
    expect(r.github.calls).toEqual([]);
  });

  it("past a day's cap for one address or for everyone, until midnight UTC", async () => {
    const r = startRelay({ limits: { reportsPerAddress: 2, reportsPerDay: 3 } });
    await sent(await r.send(statusEnvelope()));
    await sent(await r.send(statusEnvelope()));
    const third = await r.send(statusEnvelope());
    expect(third.status).toBe(429);
    expect(await third.json()).toEqual({ error: "slow-down" });
    // 03:00 UTC: 21 hours to the next day's caps.
    expect(third.headers.get("retry-after")).toBe(String(21 * 3600));

    await sent(await r.send(statusEnvelope(), "198.51.100.20"));
    expect((await r.send(statusEnvelope(), "198.51.100.21")).status).toBe(429);

    r.advance(21 * 60 * MINUTE);
    await sent(await r.send(statusEnvelope()));
  });

  it("past the day's new issues: the report is kept and its issue opens the next day", async () => {
    const r = startRelay({ limits: { issuesPerDay: 2 } });
    await r.send(statusEnvelope());
    await r.send(billsEnvelope());
    const waiting = await sent(await r.send(billsEnvelope("SIX keuangan: a year of bills without its term")));
    expect(waiting).toMatchObject({ issue: null, duplicate: false, seen: 1 });
    // Reports of the issues already open still count on them.
    expect(await sent(await r.send(statusEnvelope([4])))).toMatchObject({ issue: { number: 300 }, duplicate: true });
    await later(r);
    expect(r.github.issues).toHaveLength(2);

    r.advance(21 * 60 * MINUTE);
    await r.cron();
    expect(r.github.issues).toHaveLength(3);
    expect(marker(r.github.issue(302).body).reports).toEqual([waiting.id]);
  });
});

describe("a note on a report", () => {
  it("goes on the report's issue with the token it was sent with, a few times at most", async () => {
    const r = startRelay();
    const { id, noteToken } = await sent(await r.send(statusEnvelope()));
    const ok = await r.note(id, noteToken, "  Terjadi sejak minggu lalu  ");
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ ok: true });
    expect(r.github.issue(300).comments).toEqual([
      `**A note on report \` ${id} \`**, 27 Oct 2026, 10:00 WIB:\n\n\`\`\`text\nTerjadi sejak minggu lalu\n\`\`\``,
    ]);

    await r.note(id, noteToken, "Kedua");
    await r.note(id, noteToken, "Ketiga");
    expect((await r.note(id, noteToken, "Keempat")).status).toBe(429);
    expect(r.github.issue(300).comments).toHaveLength(3);
  });

  it("is refused without that token, for a report that isn't there, empty, or with something personal in it", async () => {
    const r = startRelay();
    const { id, noteToken } = await sent(await r.send(statusEnvelope()));
    const other = await sent(await r.send(billsEnvelope()));
    expect((await r.note(id, other.noteToken, "Bukan punyaku")).status).toBe(401);
    expect((await r.call(`/v1/reports/${id}/note`, { method: "POST", body: JSON.stringify({ note: "Tanpa token" }) })).status).toBe(401);
    expect((await r.note("00000000-0000-4000-8000-000000000000", noteToken, "Tidak ada")).status).toBe(404);
    expect((await r.note(id, noteToken, "   ")).status).toBe(400);
    const phone = ["0812", "34567890"].join("");
    const personal = await r.note(id, noteToken, `Hubungi aku di ${phone}`);
    expect(personal.status).toBe(422);
    expect(await personal.json()).toEqual({ error: "personal", found: ["phone number"] });
    expect(r.github.issue(300).comments).toEqual([]);
  });
});

describe("the maintainer and the fix bot", () => {
  it("fetch a report as the app sent it, fields the relay doesn't know included, with the maintainer's token only", async () => {
    const r = startRelay();
    const envelope = statusEnvelope([3, 4, 5], { note: NOTE });
    const { id, noteToken } = await sent(await r.send(envelope));
    const fetched = await r.fetchReport(id);
    expect(fetched.status).toBe(200);
    expect(fetched.headers.get("cache-control")).toBe("no-store");
    expect(await fetched.text()).toBe(JSON.stringify(envelope));

    expect((await r.fetchReport(id, noteToken)).status).toBe(401);
    expect((await r.call(`/v1/reports/${id}`)).status).toBe(401);
    expect((await r.fetchReport("00000000-0000-4000-8000-000000000000")).status).toBe(404);
    // Without a maintainer's token set (or one too short to be safe), nobody can.
    const unset = startRelay({ maintainerToken: "" });
    const kept = await sent(await unset.send(statusEnvelope()));
    expect((await unset.fetchReport(kept.id, "")).status).toBe(401);
  });

  it("keep a big report whole", async () => {
    const r = startRelay();
    const envelope = statusEnvelope();
    // Over a million characters: kept in pieces, given back as one.
    envelope.report.problems[0]!.pages[0]!.body = `<p>Daftar Kuliah · ${"<td>Kehadiran</td>".repeat(70_000)}</p>`;
    const { id } = await sent(await r.send(envelope));
    expect([...r.store.data.keys()].filter((key) => key.startsWith(`body:${id}:`))).toHaveLength(3);
    expect(await (await r.fetchReport(id)).text()).toBe(JSON.stringify(envelope));
  });

  it("get a ticket that reads one report, only for the fix bot's own run, a few times in the next three hours", async () => {
    const r = startRelay();
    const { id } = await sent(await r.send(statusEnvelope()));
    const other = await sent(await r.send(billsEnvelope()));
    const ticketFor = (report: string, run: unknown = "424242", token = MAINTAINER) =>
      r.call(`/v1/reports/${report}/ticket`, { method: "POST", headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ run }) });
    expect((await ticketFor(id, "424242", "not-the-maintainer")).status).toBe(401);
    expect((await ticketFor(id, "not a run")).status).toBe(400);

    const made = await ticketFor(id);
    expect(made.status).toBe(201);
    const { ticket, until } = (await made.json()) as { ticket: string; until: number };
    expect(until).toBe(r.now() + 180 * MINUTE);
    const run = await actionsToken(r.now());

    // A ticket shows in the run's public log: alone, or with another run's token, a branch's, one
    // made for another site, an old one or a forged one, it reads nothing (and uses up nothing).
    expect((await r.fetchReport(id, ticket)).status).toBe(401);
    for (const claims of [
      { run_id: "999" },
      { workflow_ref: `${REPO}/.github/workflows/drift-fix.yml@refs/heads/try-something` },
      { workflow_ref: `${REPO}/.github/workflows/ci.yml@refs/heads/main` },
      { repository: "someone/edunex-plus" },
      { aud: "https://elsewhere.example" },
      { exp: r.now() / 1000 - 120 },
    ])
      expect((await r.fetchReport(id, ticket, await actionsToken(r.now(), claims))).status).toBe(401);
    expect((await r.fetchReport(id, ticket, await actionsToken(r.now(), {}, true))).status).toBe(401);
    expect((await r.fetchReport(id, ticket, "not.a.token")).status).toBe(401);

    // From the run it was made for: that report, three times, and no other.
    expect((await r.fetchReport(other.id, ticket, run)).status).toBe(401);
    for (let i = 0; i < 3; i++) expect((await r.fetchReport(id, ticket, run)).status).toBe(200);
    expect((await r.fetchReport(id, ticket, run)).status).toBe(401);
    // Not the maintainer's: it can't make tickets of its own.
    expect((await ticketFor(id, "424242", ticket)).status).toBe(401);

    const late = (await (await ticketFor(id)).json()) as { ticket: string };
    r.advance(181 * MINUTE);
    expect((await r.fetchReport(id, late.ticket, await actionsToken(r.now()))).status).toBe(401);
  });
});

describe("when GitHub doesn't answer", () => {
  it("keeps the report, says it's filed later, and files it with its notes once GitHub is back", async () => {
    const r = startRelay();
    r.github.down = true;
    const refused = await r.send(statusEnvelope());
    expect(refused.status).toBe(503);
    expect(await refused.json()).toEqual({ error: "later" });
    // A second Student meanwhile: counted, and told the same.
    expect((await r.send(statusEnvelope([4]), "198.51.100.20")).status).toBe(503);
    await later(r);
    expect(r.github.issues).toEqual([]);

    r.github.down = false;
    await later(r);
    expect(r.github.issues).toHaveLength(1);
    expect(r.github.issue(300).body).toContain("Seen by **2 reports**");

    // Once filed, a note that can't go on at once goes on with the cron trigger.
    const { id, noteToken } = await sent(await r.send(statusEnvelope([5])));
    r.github.down = true;
    expect((await r.note(id, noteToken, "Masih terjadi")).status).toBe(200);
    r.github.down = false;
    await later(r);
    expect(r.github.issue(300).comments).toEqual([expect.stringContaining("Masih terjadi")]);
    expect(r.github.issue(300).body).toContain("Seen by **3 reports**");
  });

  it("opens one issue for a new problem two Students report at once", async () => {
    const r = startRelay();
    let release = () => {};
    r.github.slow = new Promise((resolve) => (release = resolve));
    const both = Promise.all([r.send(statusEnvelope([3])), r.send(statusEnvelope([4]), "198.51.100.20")]);
    await new Promise((resolve) => setTimeout(resolve, 10));
    release();
    const [one, two] = await Promise.all((await both).map(sent));
    expect(r.github.issues).toHaveLength(1);
    expect(one.issue).toEqual(two.issue);
    expect([one.duplicate, two.duplicate].sort()).toEqual([false, true]);
    expect(Math.max(one.seen, two.seen)).toBe(2);
    await later(r);
    expect(r.github.issue(300).body).toContain("Seen by **2 reports**");
  });
});

describe("the issue after it's filed", () => {
  it("lets the fix bot start by itself on the first few problems a day that fail the same way when re-read", async () => {
    const r = startRelay({ limits: { botStartsPerDay: 1 } });
    await r.send(statusEnvelope());
    await r.send(billsEnvelope());
    const another = statusEnvelope();
    another.report.problems[0]!.rows[0]!.why = "SIX statusmhs: course 3: attendance isn't a percentage";
    await r.send(another);
    expect(r.github.issues.map((issue) => marker(issue.body).botStarts)).toEqual([true, false, false]);
    expect(r.github.issues.map((issue) => marker(issue.body).reproduces)).toEqual(["yes", "unknown", "yes"]);
  });

  it("takes 50 MB of reports a day at most, so spam can't fill the free plan's storage", async () => {
    const r = startRelay({ limits: { bytesPerDay: 3 * 1024 * 1024 } });
    const big = (n: number) => {
      const envelope = billsEnvelope(`SIX keuangan: a big page, the ${n}${"th"} one`);
      envelope.report.problems[0]!.pages[0]!.body = "<td>Rp</td>".repeat(130_000);
      return envelope;
    };
    await sent(await r.send(big(1)));
    await sent(await r.send(big(2)));
    expect((await r.send(big(3), "198.51.100.20")).status).toBe(429);
    r.advance(21 * 60 * MINUTE);
    await sent(await r.send(big(3)));
  });

  it("opens five issues for one report at most, and the ones waiting oldest first, for two weeks at most", async () => {
    const r = startRelay({ limits: { issuesPerDay: 6 } });
    const many = billsEnvelope();
    const problem = many.report.problems[0]!;
    many.report.problems = ["a", "b", "c", "d", "e", "f", "g"].map((n) => ({ ...problem, check: `SIX keuangan: the ${n} table has a different layout` }));
    await sent(await r.send(many));
    expect(r.github.issues.map((issue) => issue.title)).toEqual(
      ["a", "b", "c", "d", "e"].map((n) => `SIX changed its UKT page (SIX keuangan: the ${n} table has a different layout)`),
    );

    // The day's last issue, then two that wait: they open the next day, the older first.
    await r.send(billsEnvelope("SIX keuangan: the first that came"));
    r.advance(MINUTE);
    await r.send(billsEnvelope("SIX keuangan: the second that came"));
    r.advance(MINUTE);
    await r.send(billsEnvelope("SIX keuangan: the third that came"));
    expect(r.github.issues).toHaveLength(6);
    r.advance(21 * 60 * MINUTE);
    await r.relay.cron();
    expect(r.github.issues.slice(6).map((issue) => issue.title)).toEqual([
      "SIX changed its UKT page (SIX keuangan: the second that came)",
      "SIX changed its UKT page (SIX keuangan: the third that came)",
    ]);

    // Past the day's issues for two weeks, a problem stops waiting.
    const late = startRelay({ limits: { issuesPerDay: 0 } });
    await late.send(billsEnvelope());
    late.advance(15 * 24 * 60 * MINUTE);
    await late.cron();
    expect(late.lines).toContainEqual(expect.stringContaining("waited 14 days for its issue to open"));
    expect([...late.store.data.keys()].filter((key) => key.startsWith("thread:") || key.startsWith("unopened:"))).toEqual([]);
  });

  it("brings open issues up to date however many new ones wait for the next day", async () => {
    const r = startRelay({ limits: { issuesPerDay: 1 } });
    await r.send(statusEnvelope());
    for (let i = 0; i < 12; i++) await r.send(billsEnvelope(`SIX keuangan: a bill without its term, the ${"x".repeat(i)} way`), `198.51.100.${i}`);
    await r.send(statusEnvelope([4]));
    await later(r);
    expect(r.github.issues).toHaveLength(1);
    expect(r.github.issue(300).body).toContain("Seen by **2 reports**");
  });

  it("names the latest report whose pages fail the same way, for the fix bot", async () => {
    const r = startRelay();
    const first = await sent(await r.send(statusEnvelope([3], { reproduces: "no" })));
    const second = await sent(await r.send(statusEnvelope([4])));
    await r.send(statusEnvelope([5], { reproduces: "unknown" }));
    await later(r);
    const now = marker(r.github.issue(300).body);
    expect(now).toMatchObject({ reproducing: second.id, reproduces: "yes", botStarts: false });
    expect(now.reports).toHaveLength(3);
    expect(now.reports.at(-1)).toBe(first.id);
  });

  it("says once when a closed issue is seen again, and starts again when its issue was deleted", async () => {
    const r = startRelay();
    await r.send(statusEnvelope());
    const issue = r.github.issue(300);
    issue.closedAt = r.now();
    issue.reason = "completed";
    r.advance(MINUTE);
    await r.send(statusEnvelope([4], { version: "0.1.0-alpha.21" }));
    await later(r);
    expect(issue.comments).toEqual([
      "Seen again since this was closed: 1 more report, the latest on 27 Oct 2026, 10:01 WIB, from Edunex Plus 0.1.0-alpha.21. Reopen it if the fix should have reached that version.",
    ]);
    await r.send(statusEnvelope([4]));
    await later(r);
    expect(issue.comments).toHaveLength(1);
    expect(issue.body).toContain("Seen by **3 reports**");

    issue.deleted = true;
    await r.send(statusEnvelope([5]));
    await later(r);
    expect(r.lines).toContainEqual(expect.stringContaining("issue 300 was deleted"));
    const fresh = await sent(await r.send(statusEnvelope([5])));
    expect(fresh).toMatchObject({ issue: { number: 301 }, duplicate: false, seen: 1 });
  });

  it("answers its health check", async () => {
    const r = startRelay();
    const health = await r.call("/v1/health");
    expect([health.status, await health.json()]).toEqual([200, { ok: true }]);
    expect((await r.call("/v1/nothing")).status).toBe(404);
  });
});
