// Problem reports that send themselves when the Student agreed (ADR 0014), through the real engine
// against the pretend SIX and the pretend relay: each problem once, by what it is, again only when
// it went away and came back a week later, never offline, never without the Student's yes or a
// relay address.
import { describe, expect, it } from "vitest";
import { personalHits } from "../kit/privacy-rules";
import { PRETEND_RELAY } from "../pretend/relay";
import { PRETEND_SIX_COOKIE } from "../pretend/six";
import { PretendWorld } from "../pretend/world";
import { type Harness, startEngine } from "./harness";

const BILLS = /\/keuangan$/;
const STATUS = /\/statusmhs$/;

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

/** What the Student said, or "unset": they haven't been asked yet. */
type Choice = "auto" | "ask" | "never" | "unset";

/** Signed in to SIX, with the Student's choice made (or not) and a relay to send to (or none). */
async function signedIn({
  relay = PRETEND_RELAY as string | undefined,
  choice = "auto" as Choice,
  world = new PretendWorld(),
  storage = undefined as Harness["storage"] | undefined,
  vault = undefined as Harness["vault"] | undefined,
} = {}) {
  const h = await startEngine({ world, storage, vault, relay });
  if (choice !== "unset") await h.engine.updateSettings({ reportSending: choice, reportAsked: true });
  if (!vault) await until(h, h.engine.signIn("six", { cookie: PRETEND_SIX_COOKIE }));
  return h;
}

/** Reads SIX again, and lets what's due go. */
async function readAgain(h: Harness) {
  await until(h, h.engine.refresh("six"));
  await until(h, h.engine.reports.idle());
}

/** SIX changes its fees page (or puts it back), and the app reads it. */
async function feesChange(h: Harness, back = false) {
  const [from, to] = ["<th class='text-left'>Semester</th>", "<th>Periode</th>"];
  h.world.six.changeLayout(BILLS, back ? to : from, back ? from : to);
  await readAgain(h);
}

/** SIX writes one course code another way: that row is left out. */
async function rowLeftOut(h: Harness, code = "PL3002", written = "PL-3002") {
  h.world.six.changeLayout(STATUS, `<td>${code}</td>`, `<td>${written}</td>`);
  await readAgain(h);
}

const feeds = (h: Harness) => h.world.relay.reports.map((report) => report.envelope.report.problems[0]!.feed);

describe("sending a report by itself", () => {
  it("sends a page the app couldn't read once, as a Student would see it, and lists it for Settings", async () => {
    const h = await signedIn();
    await feesChange(h);
    const [sent] = h.world.relay.reports;
    expect(h.world.relay.reports).toHaveLength(1);
    expect(sent!.envelope).toMatchObject({
      envelope: 1,
      os: "macOS 15.3 (arm64)",
      lang: "id",
      how: "auto",
      report: { format: 2, problems: [{ feed: "six.bills", kind: "changed", reproduces: "yes" }] },
    });
    expect(sent!.envelope.report.log!.length).toBeGreaterThan(0);
    expect(sent!.userAgent).toBe("EdunexPlus/2.0.0-test (+https://github.com/pablonification/edunex-plus)");
    expect(personalHits(JSON.stringify(sent!.envelope))).toEqual([]);
    // When, which page, and its issue: what Settings lists.
    expect(h.dataset("app.reports")?.sent).toEqual([
      {
        id: "r1",
        at: expect.any(Number),
        feeds: ["six.bills"],
        how: "auto",
        issue: { number: 301, url: "https://github.com/pablonification/edunex-plus/issues/301" },
      },
    ]);

    // Read again and still changed: it isn't sent again.
    await readAgain(h);
    expect(h.world.relay.reports).toHaveLength(1);
  });

  it("knows a problem by what it is, not by which row it was: another course left out the same way isn't sent again", async () => {
    const h = await signedIn();
    await rowLeftOut(h);
    expect(feeds(h)).toEqual(["six.status"]);
    // Course 4 reads again, course 3 doesn't, for the same reason: "course 9 has no course code" both times.
    h.world.six.changeLayout(STATUS, "<td>PL-3002</td>", "<td>PL3002</td>");
    await rowLeftOut(h, "KU5014", "KU-5014");
    expect(h.world.relay.reports).toHaveLength(1);
  });

  it("doesn't send it again after a restart, nor a week on while it never went away; it goes again once it came back", async () => {
    const h = await signedIn();
    await feesChange(h);
    h.engine.stop();

    // The app opens again: the page is read again, still changed, and the problem is known.
    const again = await signedIn({ world: h.world, storage: h.storage, vault: h.vault });
    await readAgain(again);
    expect(h.world.relay.reports).toHaveLength(1);
    again.engine.stop();

    // Eight days on, still changed all along: the same problem, not sent again.
    const week = new PretendWorld({ now: "2026-10-16T08:12:00+07:00" });
    const third = await signedIn({ world: week, storage: h.storage, vault: h.vault });
    await feesChange(third);
    expect(week.relay.reports).toEqual([]);
    // It reads as it was, then changes again: it came back, a week after it went, so it goes once more.
    await feesChange(third, true);
    await feesChange(third);
    expect(week.relay.reports).toHaveLength(1);
  });

  for (const [what, options] of [
    ["the Student said to ask each time", { choice: "ask" }],
    ["the Student said never", { choice: "never" }],
    ["the Student hasn't said yet", { choice: "unset" }],
    ["the app has no relay address", { relay: "" }],
  ] as const)
    it(`sends nothing when ${what}`, async () => {
      const h = await signedIn(options);
      await feesChange(h);
      expect(h.world.relay.requests).toEqual([]);
    });

  it("never sends while the app is offline: it waits, quietly, and sends once things answer again", async () => {
    const h = await signedIn();
    h.world.relay.answer = "offline";
    await feesChange(h);
    expect(h.world.relay.reports).toEqual([]);
    expect(h.dataset("app.reports")?.sent ?? []).toEqual([]);

    // Nothing answers at all now (SIX neither): the relay isn't even tried.
    h.world.setOffline(true);
    await until(h, h.engine.refresh("six"));
    expect(h.engine.snapshot().statuses.find((status) => status.source === "six")?.state).toBe("offline");
    h.world.relay.answer = "ok";
    const tried = h.world.relay.requests.length;
    await h.wait(30 * 60_000);
    expect(h.world.relay.requests).toHaveLength(tried);

    // Back online: it goes.
    h.world.setOffline(false);
    await readAgain(h);
    expect(h.world.relay.reports).toHaveLength(1);
  });

  it("tries again later when the relay answers as a deploy gone wrong, instead of dropping the problem", async () => {
    const h = await signedIn();
    h.world.relay.answer = "missing";
    await feesChange(h);
    expect(h.world.relay.reports).toEqual([]);
    h.world.relay.answer = "ok";
    await h.wait(20 * 60_000);
    await until(h, h.engine.reports.idle());
    expect(feeds(h)).toEqual(["six.bills"]);
  });

  it("sends a problem kept while another is still on its way", async () => {
    const h = await signedIn();
    const release = h.world.relay.hold();
    h.world.six.changeLayout(BILLS, "<th class='text-left'>Semester</th>", "<th>Periode</th>");
    await until(h, h.engine.refresh("six"));
    await h.wait(2_000);
    h.world.six.changeLayout(STATUS, "<td>PL3002</td>", "<td>PL-3002</td>");
    await until(h, h.engine.refresh("six"));
    release();
    await until(h, h.engine.reports.idle());
    expect(feeds(h).sort()).toEqual(["six.bills", "six.status"]);
  });

  it("signing out of everything while one is on its way leaves nothing of it for the next Student", async () => {
    const h = await signedIn();
    const release = h.world.relay.hold();
    h.world.six.changeLayout(BILLS, "<th class='text-left'>Semester</th>", "<th>Periode</th>");
    await until(h, h.engine.refresh("six"));
    await h.wait(2_000);
    await h.engine.signOut();
    release();
    await until(h, h.engine.reports.idle());
    expect(h.dataset("app.reports")?.sent ?? []).toEqual([]);
    expect(h.storage.files.get("reports-sent.json")).not.toContain('"sent":{"');
    expect(h.engine.snapshot().settings).toMatchObject({ reportSending: "ask", reportAsked: false });
  });
});

describe("asking the Student", () => {
  it('asks once, the first time a problem is kept; answering "auto" sends that one, and the rest as they\'re read', async () => {
    const h = await signedIn({ choice: "unset" });
    await feesChange(h);
    expect(h.dataset("app.reports")?.asking).toEqual({
      feed: "six.bills",
      kind: "changed",
      rowsLeftOut: 0,
      datasets: ["six.bills"],
      first: true,
      at: expect.any(Number),
    });
    // Another problem meanwhile: one question at a time.
    await rowLeftOut(h);
    expect(h.dataset("app.reports")?.asking).toMatchObject({ feed: "six.bills", first: true });

    await h.engine.updateSettings({ reportSending: "auto", reportAsked: true });
    await until(h, h.engine.reports.idle());
    expect(h.dataset("app.reports")?.asking).toBeNull();
    expect(feeds(h)).toEqual(["six.bills"]);
    // The status page is read again, still with its row left out: it goes too.
    await readAgain(h);
    expect(feeds(h).sort()).toEqual(["six.bills", "six.status"]);
  });

  it("closed without an answer, it asks each time from then on, a problem once", async () => {
    const h = await signedIn({ choice: "unset" });
    await feesChange(h);
    await h.engine.reports.dismiss();
    expect(h.engine.snapshot().settings).toMatchObject({ reportSending: "ask", reportAsked: true });
    expect(h.dataset("app.reports")?.asking).toBeNull();

    await rowLeftOut(h);
    expect(h.dataset("app.reports")?.asking).toMatchObject({ feed: "six.status", kind: "skipped", rowsLeftOut: 1, first: false });
    await h.engine.reports.dismiss();
    await readAgain(h);
    expect(h.dataset("app.reports")?.asking).toBeNull();
    expect(h.world.relay.requests).toEqual([]);
  });

  it('stops asking once the page reads as it was, and never asks after "never"', async () => {
    const h = await signedIn({ choice: "ask" });
    await rowLeftOut(h);
    expect(h.dataset("app.reports")?.asking).toMatchObject({ feed: "six.status" });
    h.world.six.changeLayout(STATUS, "<td>PL-3002</td>", "<td>PL3002</td>");
    await readAgain(h);
    expect(h.dataset("app.reports")?.asking).toBeNull();

    const never = await signedIn({ choice: "never" });
    await feesChange(never);
    expect(never.dataset("app.reports")).toBeUndefined();
  });
});

describe("Kirim langsung, and the Student's story after it", () => {
  it("posts the report it's given, with the note, and takes a story on it after; one that looks personal is refused", async () => {
    const h = await signedIn({ choice: "ask" });
    await feesChange(h);
    const report = await h.engine.report({ datasets: ["six.bills"] });
    const sent = await h.engine.reports.send(report, { note: "membuka tab UKT", os: "macOS 15.3 (arm64)" });
    expect(sent).toEqual({
      result: "filed",
      id: "r1",
      issue: { number: 301, url: "https://github.com/pablonification/edunex-plus/issues/301" },
      duplicate: false,
    });
    expect(h.world.relay.reports[0]!.envelope).toMatchObject({
      how: "manual",
      note: "membuka tab UKT",
      report: { at: report.at, problems: [{ check: report.problems[0]!.check }] },
    });
    expect(h.dataset("app.reports")).toMatchObject({ sent: [{ id: "r1", how: "manual", feeds: ["six.bills"] }], asking: null });

    expect(await h.engine.reports.note("r1", "Tabelnya kosong setelah aku buka.")).toBe("added");
    expect(h.world.relay.reports[0]!.notes).toEqual(["Tabelnya kosong setelah aku buka."]);
    // A made-up address of the Student's own, joined here so the repository's privacy check doesn't read it as one.
    expect(await h.engine.reports.note("r1", `Hubungi aku di ${["rahmat.hidayat", "gmail.com"].join("@")}`)).toBe("personal");
    expect(await h.engine.reports.note("r9", "Ini laporan lain")).toBe("gone");

    // Sent by hand, the same problem doesn't go again by itself.
    await h.engine.updateSettings({ reportSending: "auto" });
    await readAgain(h);
    expect(h.world.relay.reports).toHaveLength(1);
  });

  it("says when there's no connection, when the relay can't take it now, and when it files it later", async () => {
    const h = await signedIn({ choice: "ask" });
    await feesChange(h);
    const report = await h.engine.report({});
    h.world.relay.answer = "offline";
    await expect(h.engine.reports.send(report, { note: "", os: "macOS 15.3 (arm64)" })).rejects.toMatchObject({ kind: "Offline" });
    for (const answer of ["busy", "missing"] as const) {
      h.world.relay.answer = answer;
      expect(await h.engine.reports.send(report, { note: "", os: "macOS 15.3 (arm64)" })).toEqual({ result: "busy" });
    }
    h.world.relay.answer = "later";
    expect(await h.engine.reports.send(report, { note: "", os: "macOS 15.3 (arm64)" })).toEqual({ result: "stored", id: null, issue: null, duplicate: false });
    expect(h.dataset("app.reports")?.sent).toEqual([{ id: null, at: expect.any(Number), feeds: ["six.bills"], how: "manual", issue: null }]);
  });
});
