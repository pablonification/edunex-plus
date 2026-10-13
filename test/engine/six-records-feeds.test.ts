// SIX records through the real engine (#78, #79, #80): the feeds read the
// pretend SIX when SIX's session starts and once a day, keep what SIX shows,
// and say "SIX changed something" instead of showing wrong or empty data.
// The SIX client is another ticket's; a stand-in reads pages the same way.
import { describe, expect, it } from "vitest";
import { z } from "zod";
import type { Event } from "../../src/core/contract";
import { type DatasetName, type DatasetValue, gradeChanges, krsChanges } from "../../src/core/models";
import { createEngine } from "../../src/engine/engine";
import { EngineError, isEngineError } from "../../src/engine/errors";
import type { SixPages } from "../../src/engine/sources/six/pages";
import { fetchSyllabus, registerSixRecordFeeds } from "../../src/engine/sources/six/records";
import type { Source } from "../../src/engine/sources/source";
import { MemoryStorage, MemoryVault } from "../pretend/memory";
import { PRETEND_SIX_COOKIE, SIX_ORIGIN } from "../pretend/six";
import { PretendWorld } from "../pretend/world";

const HOUR = 3_600_000;
const IDENTITY = { nim: "18223901", studentId: "2021000001", term: "2026-1" };
const TRANSCRIPT = /\/transkrip\/historis\/\d+$/;
const LIST = /\/kurikulum\/kurikulum\/list$/;
const wib = (iso: string) => Date.parse(`${iso}+07:00`);

/** Reads pretend SIX pages the way the SIX client does: a redirect to /login ends the session, 429 and 5xx are SIX being away. */
function pagesOver(world: PretendWorld): SixPages {
  return {
    who: async () => IDENTITY,
    async page(path) {
      const response = await world.request({ method: "GET", url: `${SIX_ORIGIN}${path}`, headers: { cookie: PRETEND_SIX_COOKIE }, redirect: "manual" });
      if (response.status === 302) throw new EngineError("Unauthorized", "SIX ended the session");
      if (response.status === 429 || response.status >= 500) throw new EngineError("Offline", `SIX answered ${response.status}`);
      if (response.status !== 200) throw new EngineError("Failed", `SIX answered ${response.status} for ${path}`);
      return response.body;
    },
  };
}

async function signedIn(options: { world?: PretendWorld; storage?: MemoryStorage; signIn?: boolean } = {}) {
  const world = options.world ?? new PretendWorld({ now: "2026-10-11T09:00:00+07:00" });
  const storage = options.storage ?? new MemoryStorage();
  const pages = pagesOver(world);
  const six: Source<{ cookie: string }> = {
    id: "six",
    session: z.object({ cookie: z.string() }),
    liveness: null,
    start: (context) => registerSixRecordFeeds(context, pages),
  };
  const events: Event[] = [];
  const engine = createEngine({
    transport: world,
    clock: world.clock,
    storage,
    vault: new MemoryVault(),
    version: "2.0.0-test",
    emit: (e) => events.push(e),
    random: () => 0.5,
    sources: [six],
  });
  await engine.load();
  engine.start();
  if (options.signIn !== false) await engine.signIn("six", { cookie: PRETEND_SIX_COOKIE });
  return {
    world,
    engine,
    storage,
    pages,
    events,
    status: () => engine.snapshot().statuses.find((s) => s.source === "six")!,
    dataset: <N extends DatasetName>(name: N) => engine.snapshot().datasets.find((d) => d.name === name)?.value as DatasetValue<N> | undefined,
    sixPaths: () => world.six.requests.map((r) => r.path),
  };
}

describe("SIX records: first sync and cadence", () => {
  it("signing in reads the transcript, progress, curriculum, KRS and bills, a page each", async () => {
    const h = await signedIn();
    expect(h.status()).toMatchObject({ state: "live", detail: null });
    expect(new Set(h.sixPaths())).toEqual(
      new Set([
        "/app/mahasiswa:18223901/statusmhs/transkrip/historis/2021000001",
        "/app/mahasiswa:18223901/statusmhs/transkrip/kurikulum/2021000001",
        "/app/mahasiswa:18223901/kurikulum/kurikulum/list",
        "/app/mahasiswa:18223901/kurikulum/kurikulum/1047/struktur",
        "/app/mahasiswa:18223901/statusmhs/program-integrasi/riwayat/2021000001",
        "/app/mahasiswa:18223901+2026-1/registrasi/rencanastudi/2021000001",
        "/app/mahasiswa:18223901/keuangan",
      ]),
    );
    expect(h.sixPaths()).toHaveLength(7);

    const transcript = h.dataset("six.transcript")!;
    expect(transcript.terms).toHaveLength(7);
    expect(transcript.ipk).toMatchObject({ six: 3.26, computed: 3.26, agrees: true });
    expect(h.dataset("six.progress")).toMatchObject({ ipk: 3.26, sksPassed: 125, entryTerm: "2023-1" });
    expect(h.dataset("six.curriculum")).toMatchObject({
      name: "Kurikulum 2024 - Sarjana Sistem dan Teknologi Informasi",
      year: 2024,
      program: { code: "182", faculty: "STEI" },
      graduationSks: 144,
      semesters: 8,
      registrations: [{ kind: "specialization", name: "Sistem Informasi Cerdas", status: "On Progress" }],
    });
    expect(h.dataset("six.curriculum")!.required).toHaveLength(45);
    expect(h.dataset("six.krs")).toMatchObject({ term: "2026-1", state: "official", sks: 14 });
    expect(h.dataset("six.bills")!.find((b) => b.term === "2026-1")).toMatchObject({ status: "paid", dueDate: "2026-08-24" });
    // The first read is silent: nothing counts as new.
    expect(gradeChanges(undefined, transcript)).toEqual([]);
  });

  it("reads again once a day, and keeps everything readable across a restart without the network", async () => {
    const h = await signedIn();
    await h.world.clock.advance(23 * HOUR);
    expect(h.sixPaths()).toHaveLength(7);
    await h.world.clock.advance(1 * HOUR + 5_000);
    expect(h.sixPaths()).toHaveLength(14);

    h.engine.stop();
    h.world.setOffline(true);
    const again = await signedIn({ world: h.world, storage: h.storage, signIn: false });
    // Saved data is checked against the models when it loads: all of it passes.
    for (const name of ["six.transcript", "six.progress", "six.curriculum", "six.krs", "six.bills"] as const) {
      expect(again.dataset(name)).toBeDefined();
      expect(again.dataset(name)).toEqual(h.dataset(name));
    }
  });

  it("an unchanged SIX doesn't bother the screens; a changed one does", async () => {
    const h = await signedIn();
    const told = () => h.events.flatMap((e) => (e.type === "dataset" && e.dataset.name.startsWith("six.") ? [e.dataset.name] : []));
    const before = told().length;
    await h.engine.refresh("six");
    expect(told().length).toBe(before);
    h.world.six.gradeCourse("2026-1", "II4091", "A");
    await h.engine.refresh("six");
    expect(told().slice(before).sort()).toEqual(["six.progress", "six.transcript"]);
  });
});

describe("SIX records: grades (#78)", () => {
  it("a new grade posted", async () => {
    const h = await signedIn();
    const before = h.dataset("six.transcript")!;
    h.world.six.gradeCourse("2026-1", "II4091", "A");
    await h.world.clock.advance(24 * HOUR + 5_000);
    const after = h.dataset("six.transcript")!;
    expect(gradeChanges(before, after)).toEqual([{ term: "2026-1", code: "II4091", name: "Proposal Tugas Akhir", from: null, to: "A" }]);
    // On the page but not on the transcript yet: the IPK still agrees with SIX's.
    expect(after.terms.at(-1)!.courses.find((c) => c.code === "II4091")).toMatchObject({ grade: "A", standing: "off-transcript" });
    expect(after.ipk).toMatchObject({ computed: 3.26, agrees: true });
    expect(h.dataset("six.progress")!.stages[1]!.semesters.find((s) => s.semester === 7)!.courses[0]).toMatchObject({
      code: "II4091",
      status: "graded",
      grade: "A",
    });
  });

  it("a grade changed: the new grade, and SIX's old IP and IPK shown as not matching until SIX recomputes them", async () => {
    const h = await signedIn();
    const before = h.dataset("six.transcript")!;
    h.world.six.gradeCourse("2025-1", "II3130", "B");
    await h.engine.refresh("six");
    const after = h.dataset("six.transcript")!;
    expect(gradeChanges(before, after)).toEqual([{ term: "2025-1", code: "II3130", name: "Arsitektur Enterprise", from: "C", to: "B" }]);
    expect(after.terms.find((t) => t.term === "2025-1")!.ip).toMatchObject({ six: 3.1, computed: 3.25, agrees: false });
    expect(after.ipk).toMatchObject({ six: 3.26, computed: 3.29, agrees: false });

    h.world.six.editPage(TRANSCRIPT, (html) => html.replace("NR 3.10", "NR 3.25"));
    h.world.six.editPage(/\/transkrip\/kurikulum\/\d+$/, (html) => html.replace('title="dari 125 SKS">3.26', 'title="dari 125 SKS">3.29'));
    await h.engine.refresh("six");
    expect(h.dataset("six.transcript")!.terms.find((t) => t.term === "2025-1")!.ip.agrees).toBe(true);
    expect(h.dataset("six.transcript")!.ipk).toMatchObject({ six: 3.29, computed: 3.29, agrees: true });
  });

  it("a repeated course: the newest grade counts once SIX moves it onto the transcript", async () => {
    const h = await signedIn();
    h.world.six.retake("II3130", "2025-1", "2026-1");
    await h.engine.refresh("six");
    let transcript = h.dataset("six.transcript")!;
    expect(transcript.terms.at(-1)!.courses.find((c) => c.code === "II3130")).toMatchObject({ attempt: 2, standing: "pending" });
    expect(transcript.terms.at(-1)!.sks).toBe(17);
    expect(transcript.sksTaken).toBe(142);

    h.world.six.gradeCourse("2026-1", "II3130", "A");
    h.world.six.markOnTranscript("2026-1", "II3130", true);
    h.world.six.markOnTranscript("2025-1", "II3130", false);
    h.world.six.editPage(/\/transkrip\/kurikulum\/\d+$/, (html) => html.replace('title="dari 125 SKS">3.26', 'title="dari 125 SKS">3.31'));
    await h.engine.refresh("six");
    transcript = h.dataset("six.transcript")!;
    expect(transcript.terms.find((t) => t.term === "2025-1")!.courses.find((c) => c.code === "II3130")!.standing).toBe("replaced");
    expect(transcript.terms.at(-1)!.courses.find((c) => c.code === "II3130")!.standing).toBe("counted");
    expect(transcript.ipk).toMatchObject({ six: 3.31, computed: 3.31, sks: 125, agrees: true });
  });

  it("a course not counted in the transcript", async () => {
    const h = await signedIn();
    h.world.six.markOnTranscript("2025-2", "FK3057", false);
    await h.engine.refresh("six");
    const transcript = h.dataset("six.transcript")!;
    expect(transcript.terms.find((t) => t.term === "2025-2")!.courses.find((c) => c.code === "FK3057")!.standing).toBe("off-transcript");
    expect(transcript.ipk).toMatchObject({ six: 3.26, sixSks: 125, computed: 3.27, sks: 123, agrees: false });
  });

  it("layout changed: SIX changed something, and the last transcript stays as it was", async () => {
    const h = await signedIn();
    const before = h.dataset("six.transcript");
    h.world.six.changeLayout(TRANSCRIPT, "Masuk Transkrip", "Status");
    h.world.six.gradeCourse("2026-1", "II4091", "A");
    await h.engine.refresh("six");
    expect(h.status()).toMatchObject({
      state: "changed",
      detail: 'SIX transcript page: the course header reads " | Kode | Mata Kuliah | SKS | Nilai | Semester Kurikulum | Status"',
    });
    expect(h.dataset("six.transcript")).toEqual(before);
    expect(h.dataset("six.krs")).toBeDefined();

    h.world.six.changeLayout(TRANSCRIPT, ">Status<", ">Masuk Transkrip<");
    await h.engine.refresh("six");
    expect(h.status().state).toBe("live");
    expect(gradeChanges(before, h.dataset("six.transcript")!)).toHaveLength(1);
  });
});

describe("SIX records: curriculum (#79)", () => {
  it("no curriculum in force is a change on SIX's side, not an empty planner", async () => {
    const world = new PretendWorld({ now: "2026-10-11T09:00:00+07:00" });
    world.six.editPage(LIST, (html) =>
      html.replace('<span class="text-success"><i class="fa fa-fw fa-check"></i></span>', '<span class="text-danger"><i class="fa fa-fw fa-times"></i></span>'),
    );
    const h = await signedIn({ world });
    expect(h.status()).toMatchObject({ state: "changed", detail: "SIX curriculum list page: no curriculum is in force" });
    expect(h.dataset("six.curriculum")).toBeUndefined();
    expect(h.dataset("six.transcript")).toBeDefined();
  });

  it("a syllabus on demand", async () => {
    const h = await signedIn();
    const syllabus = await fetchSyllabus(h.pages, h.dataset("six.curriculum")!.required.find((c) => c.code === "II1200")!.courseId!);
    expect(syllabus).toMatchObject({ code: "II1200", sks: 3, name: { en: "Introduction to Information Systems and Technology" } });
    expect(h.sixPaths().at(-1)).toBe("/app/mahasiswa:18223901/kurikulum/silabus/47837/view");
    const refused = await fetchSyllabus(h.pages, "../keuangan").catch((error: unknown) => (isEngineError(error) ? error.kind : error));
    expect(refused).toBe("Rejected");
  });
});

describe("SIX records: KRS and bills (#80)", () => {
  it("the plan sent, then approved by the advisor", async () => {
    const world = new PretendWorld({ now: "2026-08-17T09:00:00+07:00" });
    world.six.dropKrsChange();
    world.six.krsStep("plan", "Pengesahan KSM", null);
    world.six.krsStep("plan", "Persetujuan Dosen Wali", null);
    const h = await signedIn({ world });
    const sent = h.dataset("six.krs")!;
    expect(sent).toMatchObject({ state: "sent", plan: { sentAt: wib("2026-08-16T10:45:42"), approvedAt: null }, change: null });

    h.world.six.krsStep("plan", "Persetujuan Dosen Wali", "18 Agu 2026 14.39.32");
    await h.world.clock.advanceTo("2026-08-18T09:00:05+07:00");
    const approved = h.dataset("six.krs")!;
    expect(approved.state).toBe("approved");
    expect(krsChanges(sent, approved)).toEqual([{ kind: "approved", round: "plan", at: wib("2026-08-18T14:39:32") }]);
  });

  it("the plan changed by the advisor", async () => {
    const h = await signedIn();
    const before = h.dataset("six.krs")!;
    h.world.six.krsCourse("PL3032", "remove");
    h.world.six.krsCourse("KU5014", { approved: false });
    await h.engine.refresh("six");
    const after = h.dataset("six.krs")!;
    expect(after.sks).toBe(11);
    expect(krsChanges(before, after).map((c) => [c.kind, "code" in c ? c.code : null])).toEqual([
      ["course-changed", "KU5014"],
      ["course-removed", "PL3032"],
    ]);
  });

  it("a new bill, paid later; and one left unpaid past its last day is overdue", async () => {
    const world = new PretendWorld({ now: "2027-01-20T09:00:00+07:00" });
    world.six.setBill("2026-2", { amount: "5.400.000", paid: "-", due: "31 Jan 2027" });
    const h = await signedIn({ world });
    const bill = () => h.dataset("six.bills")!.find((b) => b.term === "2026-2")!;
    expect(bill()).toMatchObject({ amount: 5_400_000, paid: null, status: "unpaid", dueDate: "2027-01-31", nextDueAt: wib("2027-01-31T23:59:59.999") });
    expect(bill().nextDueAt! > h.world.clock.now()).toBe(true);

    await h.world.clock.advanceTo("2027-02-01T08:00:00+07:00");
    expect(bill().status).toBe("unpaid");
    expect(bill().nextDueAt! < h.world.clock.now()).toBe(true);

    h.world.six.setBill("2026-2", { amount: "5.400.000", paid: "5.400.000", due: "31 Jan 2027" });
    await h.engine.refresh("six");
    expect(bill()).toMatchObject({ status: "paid", paid: 5_400_000, nextDueAt: null });
  });

  it("SIX away: offline, the last records kept", async () => {
    const h = await signedIn();
    const bills = h.dataset("six.bills");
    h.world.six.fail(/\/keuangan$/, 503);
    await h.engine.refresh("six");
    expect(h.status()).toMatchObject({ state: "offline", detail: "SIX answered 503" });
    expect(h.dataset("six.bills")).toEqual(bills);
  });
});
