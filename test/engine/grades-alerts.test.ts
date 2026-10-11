// v2-10 (#78), seam 1: the grade alerts, by the real engine and alert center
// against the pretend SIX (its recorded pages, changed the way SIX would) and
// the pretend ITB calendar, on a fake clock. Assertions are on the OS
// notifications the Student would see and the history.
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { translate } from "../../src/core/strings";
import { DETECTORS } from "../../src/engine/alerts/detectors";
import { createEngine, type Engine } from "../../src/engine/engine";
import { EngineError } from "../../src/engine/errors";
import { itb } from "../../src/engine/sources/itb";
import type { SixPages } from "../../src/engine/sources/six/pages";
import { registerSixRecordFeeds } from "../../src/engine/sources/six/records";
import type { Source } from "../../src/engine/sources/source";
import { MemoryStorage, MemoryVault } from "../pretend/memory";
import { PRETEND_SIX_COOKIE, SIX_ORIGIN } from "../pretend/six";
import { PretendWorld } from "../pretend/world";
import type { Shown } from "./alerts-harness";

const TRANSCRIPT = /\/transkrip\/historis\/\d+$/;
const wib = (iso: string) => Date.parse(`${iso}+07:00`);

function sixOver(world: PretendWorld): Source<{ cookie: string }> {
  const pages: SixPages = {
    who: async () => ({ nim: "18223901", studentId: "2021000001", term: "2026-1" }),
    async page(path) {
      const response = await world.request({ method: "GET", url: `${SIX_ORIGIN}${path}`, headers: { cookie: PRETEND_SIX_COOKIE }, redirect: "manual" });
      if (response.status === 302) throw new EngineError("Unauthorized", "SIX ended the session");
      if (response.status !== 200) throw new EngineError("Offline", `SIX answered ${response.status}`);
      return response.body;
    },
  };
  return { id: "six", session: z.object({ cookie: z.string() }), liveness: null, start: (context) => registerSixRecordFeeds(context, pages) };
}

async function start(options: { world?: PretendWorld; storage?: MemoryStorage; vault?: MemoryVault; signIn?: boolean } = {}) {
  const world = options.world ?? new PretendWorld({ now: "2026-10-11T09:00:00+07:00" });
  const storage = options.storage ?? new MemoryStorage();
  const vault = options.vault ?? new MemoryVault();
  const shown: Shown[] = [];
  const engine: Engine = createEngine({
    transport: world,
    clock: world.clock,
    storage,
    vault,
    version: "2.0.0-test",
    emit: () => undefined,
    random: () => 0.5,
    sources: [sixOver(world), itb],
    detectors: DETECTORS,
    alert: (notice) => {
      const text = [notice.title, notice.body].flatMap((part) => (part ? [translate("id", part.key, part.vars)] : [])).join(" — ");
      shown.push({ ...notice, shownAt: world.clock.now(), text });
    },
  });
  await engine.load();
  engine.start();
  if (options.signIn !== false) await engine.signIn("six", { cookie: PRETEND_SIX_COOKIE });
  /** SIX is read again (the daily read, or the Student's refresh), and the grouping window passes. */
  const sixAgain = async () => {
    await engine.refresh("six");
    await world.clock.advance(30_000);
  };
  const history = () => (engine.snapshot().datasets.find((d) => d.name === "app.alerts")?.value as { items: { id: string; kind: string }[] } | undefined)?.items ?? [];
  return { world, engine, storage, vault, shown, sixAgain, history, grades: () => shown.filter((n) => n.kind === "grade") };
}

describe("new and changed grades", () => {
  it("silent on the first sync", async () => {
    const app = await start();
    await app.world.clock.advance(60_000);
    expect(app.grades()).toEqual([]);
  });

  it("a new grade posted: the course, the grade, and the IPK it leaves; never twice", async () => {
    const app = await start();
    app.world.six.gradeCourse("2026-1", "II4091", "A");
    await app.sixAgain();
    expect(app.grades().map((n) => [n.text, n.target, n.source])).toEqual([["Nilai baru · II4091: A — Proposal Tugas Akhir · IPK sekarang 3.26", { screen: "grades" }, "six"]]);
    await app.sixAgain();
    expect(app.grades()).toHaveLength(1);

    // Not again after a restart either.
    app.engine.stop();
    const again = await start({ world: app.world, storage: app.storage, vault: app.vault, signIn: false });
    await again.sixAgain();
    expect(again.grades()).toEqual([]);
  });

  it("a grade changed: from what to what", async () => {
    const app = await start();
    app.world.six.gradeCourse("2025-1", "II3130", "B");
    await app.sixAgain();
    expect(app.grades().map((n) => n.text)).toEqual(["Nilai berubah · II3130: C → B — Arsitektur Enterprise · IPK sekarang 3.26"]);
  });

  it("several grades at once: one notification naming them", async () => {
    const app = await start();
    for (const code of ["DK4073", "II4091", "KU5014"]) app.world.six.gradeCourse("2026-1", code, "AB");
    await app.sixAgain();
    expect(app.grades().map((n) => [n.count, n.text])).toEqual([[3, "3 nilai baru — DK4073, II4091, KU5014"]]);
    expect(app.history().filter((a) => a.kind === "grade")).toHaveLength(3);
  });

  it("a repeated course: the retake's grade is new, the old attempt's isn't touched", async () => {
    const app = await start();
    app.world.six.retake("II3130", "2025-1", "2026-1");
    await app.sixAgain();
    expect(app.grades()).toEqual([]);
    app.world.six.gradeCourse("2026-1", "II3130", "A");
    await app.sixAgain();
    expect(app.grades().map((n) => n.text)).toEqual(["Nilai baru · II3130: A — Arsitektur Enterprise · IPK sekarang 3.26"]);
  });

  it("a course not counted in the transcript: its grade still arrives", async () => {
    const app = await start();
    app.world.six.markOnTranscript("2026-1", "PL3002", false);
    app.world.six.gradeCourse("2026-1", "PL3002", "B");
    await app.sixAgain();
    expect(app.grades().map((n) => n.title)).toEqual([{ key: "alert.grade.new", vars: { course: "PL3002", grade: "B" } }]);
  });

  it("layout changed: nothing is announced from a page the app can't read, and the grade arrives once it can", async () => {
    const app = await start();
    app.world.six.changeLayout(TRANSCRIPT, "Masuk Transkrip", "Status");
    app.world.six.gradeCourse("2026-1", "II4091", "A");
    await app.sixAgain();
    expect(app.grades()).toEqual([]);
    expect(app.engine.snapshot().statuses.find((s) => s.source === "six")?.state).toBe("changed");
    app.world.six.changeLayout(TRANSCRIPT, ">Status<", ">Masuk Transkrip<");
    await app.sixAgain();
    expect(app.grades().map((n) => n.title.vars?.course)).toEqual(["II4091"]);
  });

  it("turned off in Settings: no notification, still in the history", async () => {
    const app = await start();
    await app.engine.updateSettings({ mutedAlerts: ["grade"] });
    app.world.six.gradeCourse("2026-1", "II4091", "A");
    await app.sixAgain();
    expect(app.grades()).toEqual([]);
    expect(app.history().map((a) => a.id)).toContain("grade:2026-1:II4091:A");
  });
});

describe("the questionnaire reminder", () => {
  it("at the start of ITB's questionnaire window and two days before it closes, while grades are missing", async () => {
    // Pengisian Kuesioner Evaluasi Perkuliahan Semester I-2026/2027: 30 Nov – 11 Dec 2026.
    const world = new PretendWorld({ now: "2026-11-29T20:00:00+07:00" });
    const app = await start({ world });
    await world.clock.advanceTo("2026-11-30T07:59:00+07:00");
    expect(app.grades()).toEqual([]);
    await world.clock.advanceTo("2026-11-30T08:01:00+07:00");
    expect(app.grades().map((n) => [n.text, n.source])).toEqual([["Kuesioner perkuliahan dibuka — SIX menyembunyikan nilai 5 mata kuliah sampai kuesionernya diisi.", "itb"]]);
    expect(app.grades()[0].shownAt).toBeLessThanOrEqual(wib("2026-11-30T08:00:30"));
    await world.clock.advanceTo("2026-12-09T08:01:00+07:00");
    expect(app.grades().map((n) => n.title.key)).toEqual(["alert.questionnaire.open", "alert.questionnaire.closing"]);
    expect(app.grades()[1].shownAt).toBeGreaterThanOrEqual(wib("2026-12-09T08:00:00"));
  }, 20_000);

  it("not once every course of the term has its grade", async () => {
    const world = new PretendWorld({ now: "2026-12-08T09:00:00+07:00" });
    for (const code of ["DK4073", "II4091", "KU5014", "PL3002", "PL3032"]) world.six.gradeCourse("2026-1", code, "A");
    const app = await start({ world });
    await world.clock.advanceTo("2026-12-10T00:00:00+07:00");
    expect(app.grades()).toEqual([]);
    expect(app.history().some((a) => a.id.startsWith("grade.questionnaire"))).toBe(false);
  }, 20_000);
});
