// Each home-screen widget's model (mobile/src/widget/model.ts, qa/superapp-widgets.md): exactly what it says and where
// each tap goes, from the real engine's snapshot against the pretend Edunex and SIX on the recorded Thursday 8 October
// (08:12: PL3002 on now, DK4073 at 11:00). Every state: its data, nothing to show, signed out, offline, a holiday. The
// output is plain data, the same an iPhone widget would be given.
import { beforeAll, describe, expect, it } from "vitest";
import {
  attendanceWidget,
  courseWidget,
  dueWidget,
  examWidget,
  nextWidget,
  servicesWidget,
  type WidgetFacts,
  widgetFacts,
} from "../../mobile/src/widget/model";
import type { Snapshot } from "../../src/core/snapshot";
import { startEngine } from "../engine/harness";
import { startHome } from "../engine/needs-harness";

type Home = Awaited<ReturnType<typeof startHome>>;
type Shot = Pick<Snapshot, "datasets" | "statuses" | "settings">;

const factsOf = (h: Pick<Home, "engine" | "world">, change: (shot: Shot) => Shot = (shot) => shot) =>
  widgetFacts(change(h.engine.snapshot()), h.world.clock.now());
const at = (iso: string) => Date.parse(iso);
/** As if every source went offline after its last read: the data stays. */
const offline = (shot: Shot): Shot => ({ ...shot, statuses: shot.statuses.map((status) => ({ ...status, state: "offline" as const })) });
/** As if `source` were never signed in: its state and its datasets gone. */
const without =
  (source: "six" | "edunex") =>
  (shot: Shot): Shot => ({
    ...shot,
    statuses: shot.statuses.map((status) => (status.source === source ? { ...status, state: "signed-out" as const, updatedAt: null } : status)),
    datasets: shot.datasets.filter((dataset) => !dataset.name.startsWith(`${source}.`)),
  });
/** Every model is plain data: what JSON keeps is all there is. */
const plain = (model: unknown) => expect(JSON.parse(JSON.stringify(model))).toEqual(model);

let h: Home;
let facts: WidgetFacts;
beforeAll(async () => {
  h = await startHome();
  facts = factsOf(h);
}, 120_000);

describe("Tenggat", () => {
  it("every open Task ahead, soonest first, each opening its Task; the heading opens Tugas", () => {
    const model = dueWidget(facts);
    plain(model);
    expect(model.state).toBe("ready");
    expect(model.heading).toBe("Tenggat");
    expect(model.rows.slice(0, 2)).toEqual([
      {
        title: "Tugas 02 Bab II",
        code: "II4091",
        tone: expect.stringMatching(/^var\(--course-/),
        when: "Jum, 16 Okt, 23:59",
        // The day leads the row; today and tomorrow are marked.
        name: "Proposal Tugas Akhir",
        day: "Jum, 16 Okt",
        time: "23:59",
        // How close, in a word, up to two weeks out.
        near: "8 hari",
        mark: null,
        soon: false,
        open: { kind: "route", route: { screen: "task", taskId: 117003 } },
      },
      expect.objectContaining({ title: "UTS Markom", code: "DK4073", when: "Kam, 22 Okt, 23:50" }),
    ]);
    const due = model.rows.map((row) => row.when);
    expect(due.length).toBeGreaterThan(2);
    expect(model.all).toEqual({ kind: "route", route: { screen: "tasks" } });
    expect(model.status).toEqual({ text: "Diperbarui 08:12", problem: false, at: expect.any(Number) });
    // Midnight turns "Besok" into "Hari ini" before any deadline passes.
    expect(model.changesAt).toBe(at("2026-10-09T00:00:00+07:00"));
  });

  it("a deadline within a day is marked, and drawn again when it passes", async () => {
    const own = await startHome();
    own.world.edunex.postTask(95059, { name: "Ringkasan K5", end_at: "2026-10-08T23:59:00+07:00" });
    await own.refresh();
    const model = dueWidget(factsOf(own));
    expect(model.rows[0]).toMatchObject({ title: "Ringkasan K5", when: "Hari ini, 23:59", soon: true });
    expect(model.changesAt).toBe(at("2026-10-08T23:59:00+07:00"));
  }, 120_000);

  it("signed out of Edunex: says where to sign in, and opens the app", () => {
    const model = dueWidget(factsOf(h, without("edunex")));
    expect(model).toMatchObject({
      state: "signedOut",
      rows: [],
      empty: { label: "Kamu belum masuk.", open: { kind: "route", route: { screen: "home" } } },
    });
    // The one layout every widget's quiet states share: its own name, one sentence, one thing to tap.
    expect(model.quiet).toEqual({
      state: "signedOut",
      name: "Tenggat",
      label: "Kamu belum masuk.",
      short: "Belum masuk",
      action: "Masuk",
      open: { kind: "route", route: { screen: "home" } },
    });
  });

  it("offline: the deadlines stay, the foot says since when", () => {
    const model = dueWidget(factsOf(h, offline));
    expect(model.rows.length).toBe(dueWidget(facts).rows.length);
    expect(model.status).toMatchObject({ problem: true, text: "Tidak terhubung · data 08:12", offline: true });
  });

  it("nothing due: one plain line opening Tugas, never a 0", () => {
    const model = dueWidget(factsOf(h, (shot) => ({ ...shot, datasets: shot.datasets.map((d) => (d.name === "edunex.tasks" ? { ...d, value: [] } : d)) })));
    expect(model).toMatchObject({
      state: "empty",
      rows: [],
      empty: { label: "Tidak ada tenggat", open: { kind: "route", route: { screen: "tasks" } } },
      quiet: { state: "empty", name: "Tenggat", label: "Tidak ada tenggat", action: "Buka Tugas", open: { kind: "route", route: { screen: "tasks" } } },
    });
  });
});

describe("Kehadiran", () => {
  it("every course, the nearest its limit first, in a word or two; TalkBack hears it whole; a row opens its course", () => {
    const model = attendanceWidget(facts);
    plain(model);
    expect(model.heading).toBe("Jatah absen");
    expect(model.rows.map(({ code, state, short, label }) => [code, state, short, label])).toEqual([
      ["KU5014", "out", "lewat 1", "Lewat jatah absen 1×"],
      ["DK4073", "none", "habis", "Jatah absen habis"],
      ["PL3032", "none", "habis", "Jatah absen habis"],
      ["PL3002", "risk", "sisa 1", "Sisa jatah absen 1×"],
      ["II4091", "safe", "sisa 2", "Sisa jatah absen 2×"],
    ]);
    expect(model.rows[0]?.open).toEqual({ kind: "route", route: { screen: "course", code: "KU5014" } });
    // The marks a row draws: every absence the term allows, the ones used, and the ones past the limit.
    for (const row of model.rows) {
      if (row.allowed === null || row.used === null) continue;
      expect(row.used).toBeLessThanOrEqual(row.allowed);
      expect(row.allowed - row.used).toBe(row.state === "out" ? 0 : Math.max(0, row.left ?? 0));
      expect(row.over > 0).toBe(row.state === "out");
    }
    expect(model.rows.some((row) => row.allowed !== null)).toBe(true);
    expect(model.all).toEqual({ kind: "route", route: { screen: "presence" } });
    // Changes only with SIX's count: never on a timer.
    expect(model.changesAt).toBeNull();
  });

  it("signed out of SIX: where to sign in", () => {
    const model = attendanceWidget(factsOf(h, without("six")));
    expect(model).toMatchObject({
      state: "signedOut",
      rows: [],
      empty: { label: "Kamu belum masuk." },
      quiet: { state: "signedOut", name: "Jatah absen", label: "Kamu belum masuk.", action: "Masuk" },
    });
  });

  it("in English", async () => {
    const own = await startHome();
    await own.engine.updateSettings({ lang: "en" });
    const model = attendanceWidget(factsOf(own));
    expect(model.heading).toBe("Absences");
    expect(model.rows.slice(0, 2).map((row) => row.short)).toEqual(["1 over", "none left"]);
  }, 120_000);
});

describe("Ujian", () => {
  it("days to the next exam as the big number, the exam and its sitting, opening the exam", () => {
    const model = examWidget(facts);
    plain(model);
    expect(model.next).toEqual({
      title: "UTS DK4073",
      kind: "UTS",
      code: "DK4073",
      name: "Komunikasi Pemasaran",
      tone: expect.stringMatching(/^var\(--course-/),
      days: 7,
      big: "7",
      unit: "hari lagi",
      when: "Kam, 15 Okt, 11:00 · TVST C",
      // What the widget leads with: true all day, where "7" is wrong after midnight. The count is the quiet second.
      day: "Kam, 15 Okt",
      time: "11:00",
      room: "TVST C",
      left: "7 hari lagi",
      open: { kind: "route", route: { screen: "exam", examId: "DK4073-UTS" } },
    });
    expect(model.changesAt).toBe(at("2026-10-09T00:00:00+07:00"));
  });

  it("the day before and the day of: the word, no number", async () => {
    const own = await startHome();
    await own.until("2026-10-14T20:00:00+07:00");
    expect(examWidget(factsOf(own)).next).toMatchObject({ days: 1, big: "Besok", unit: null, day: "Besok", time: "11:00", left: null });
    // Midnight turns "Besok" into "Hari ini": drawn again then.
    expect(examWidget(factsOf(own)).changesAt).toBe(at("2026-10-15T00:00:00+07:00"));
    await own.until("2026-10-15T07:00:00+07:00");
    expect(examWidget(factsOf(own)).next).toMatchObject({ days: 0, big: "Hari ini", unit: null, day: "Hari ini", left: null });
    // The exam starting: the next one takes over.
    expect(examWidget(factsOf(own)).changesAt).toBe(at("2026-10-15T11:00:00+07:00"));
  }, 180_000);

  it("never opened: where to start", async () => {
    const empty = await startEngine();
    expect(examWidget(widgetFacts(empty.engine.snapshot(), empty.world.clock.now()))).toMatchObject({
      state: "signedOut",
      next: null,
      quiet: { state: "signedOut", name: "Ujian", label: "Kamu belum masuk.", action: "Masuk" },
    });
  });

  it("no exam dated: says so, opening Tugas", () => {
    const model = examWidget(
      factsOf(h, (shot) => ({
        ...shot,
        datasets: shot.datasets.map((d) => (["edunex.exams", "six.schedule", "edunex.tasks"].includes(d.name) ? { ...d, value: [] } : d)),
      })),
    );
    expect(model).toMatchObject({
      state: "empty",
      next: null,
      more: [],
      quiet: { state: "empty", name: "Ujian", label: "Belum ada ujian terjadwal", action: "Buka Ujian" },
    });
  });
});

describe("Kelas berikutnya", () => {
  it("the next class to start: its time, code and room, opening its sheet on Jadwal", () => {
    const model = nextWidget(facts);
    plain(model);
    expect(model.next).toEqual({
      time: "11:00",
      big: "11:00",
      code: "DK4073",
      name: "Komunikasi Pemasaran",
      room: "TVST C",
      tone: expect.stringMatching(/^var\(--course-/),
      day: null,
      // The day is always said above the time: a bare "11:00" could be any day's.
      dayShort: "Hari ini",
      checkIn: false,
      open: { kind: "class", sessionId: "2153983" },
      a11y: "Hari ini, 11:00–12:59, DK4073, TVST C",
    });
    expect(model.changesAt).toBe(at("2026-10-08T11:00:00+07:00"));
  });

  it("Tandai Hadir open in SIX: the class on now, green, opening SIX's page", async () => {
    const own = await startHome();
    own.world.six.openCheckIn("2194342");
    await own.until("2026-10-08T08:40:00+07:00");
    const model = nextWidget(factsOf(own));
    expect(model.next).toMatchObject({
      code: "PL3002",
      big: "Tandai Hadir",
      checkIn: true,
      open: { kind: "checkIn", meetingId: "2194342" },
      a11y: "Buka di SIX untuk Tandai Hadir di PL3002",
    });
  }, 120_000);

  it("a holiday (no class in the week ahead) says so; signed out of SIX says where to sign in", () => {
    const quiet = nextWidget(factsOf(h, (shot) => ({ ...shot, datasets: shot.datasets.map((d) => (d.name === "six.schedule" ? { ...d, value: [] } : d)) })));
    // One cell holds two words: the short form says the same.
    expect(quiet).toMatchObject({ state: "holiday", next: null, empty: { label: "Tidak ada kuliah dalam seminggu ke depan.", short: "Tidak ada kuliah" } });
    expect(quiet.quiet).toMatchObject({
      state: "holiday",
      name: "Kelas berikutnya",
      short: "Tidak ada kuliah",
      action: "Buka Jadwal",
      open: { kind: "route", route: { screen: "schedule" } },
    });
    // Midnight may bring a class within the week.
    expect(quiet.changesAt).toBe(at("2026-10-09T00:00:00+07:00"));
    expect(nextWidget(factsOf(h, without("six")))).toMatchObject({ state: "signedOut", quiet: { label: "Kamu belum masuk.", action: "Masuk" } });
    // Offline: the class stays, the foot says from when, the same words as on every widget.
    expect(nextWidget(factsOf(h, offline))).toMatchObject({ state: "ready", status: { text: "Tidak terhubung · data 08:12", problem: true, offline: true } });
  });

  it("a class on another day says the day", async () => {
    const own = await startHome();
    await own.until("2026-10-08T18:00:00+07:00");
    // Friday's online meeting only Edunex announced, as "Sekarang" says it, opening the course's Pertemuan.
    expect(nextWidget(factsOf(own)).next).toMatchObject({
      day: "Besok",
      time: "15:00",
      code: "II4091",
      room: "Pertemuan 3 · daring",
      open: { kind: "route", route: { screen: "course", code: "II4091", tab: "meetings" } },
    });
  }, 120_000);
});

describe("Pintasan", () => {
  it("four places, each its own icon, opening its tab", () => {
    const model = servicesWidget(facts);
    plain(model);
    expect(model.items.map(({ label, icon, open }) => [label, icon, open])).toEqual([
      ["Jadwal", "calendar", { kind: "route", route: { screen: "schedule" } }],
      ["Tugas", "tasks", { kind: "route", route: { screen: "tasks" } }],
      ["Kuliah", "courses", { kind: "route", route: { screen: "presence" } }],
      ["Nilai", "grades", { kind: "route", route: { screen: "grades" } }],
    ]);
  });

  it("each tile's figure with its noun, said whole to TalkBack; never a grade; a class ending redraws it", () => {
    const model = servicesWidget(facts);
    // 08:12 on Thursday: four classes still to end, nothing due within a week (no figure, never "0"), three courses at
    // or past their absence limit. Nilai is its icon and word: a grade average isn't for a home screen.
    expect(model.items.map(({ figure, a11y }) => [figure, a11y])).toEqual([
      ["4 kelas", "Jadwal, 4 kuliah lagi hari ini"],
      [null, "Tugas"],
      ["3 di batas", "Kuliah, 3 mata kuliah di batas absen"],
      [null, "Nilai"],
    ]);
    expect(model.quiet).toBeNull();
    expect(model.changesAt).toBe(at("2026-10-08T10:00:00+07:00"));
    for (const item of model.items) expect(item.figure).not.toBe("0");
  });

  it("signed out: the shared card with Masuk, and no figure on any tile", () => {
    const model = servicesWidget(factsOf(h, (shot) => without("six")(without("edunex")(shot))));
    expect(model.items.map((item) => [item.figure, item.a11y])).toEqual([
      [null, "Jadwal"],
      [null, "Tugas"],
      [null, "Kuliah"],
      [null, "Nilai"],
    ]);
    expect(model).toMatchObject({ state: "signedOut", quiet: { name: "Pintasan", label: "Kamu belum masuk.", action: "Masuk" } });
  });
});

describe("Satu mata kuliah", () => {
  it("before a choice: the course on now or next, its absences, its next class and Task", () => {
    const model = courseWidget(facts, null);
    plain(model);
    expect(model.course).toMatchObject({
      code: "PL3002",
      name: "Ekonomi dan Inovasi dalam Perencanaan",
      open: { kind: "route", route: { screen: "course", code: "PL3002" } },
    });
    expect(model.absences).toEqual({ state: "risk", label: "Sisa jatah absen 1×", short: "sisa 1" });
    // The same as marks: one of the two absences the term allows is used.
    expect(model.marks).toEqual({ allowed: 2, used: 1, over: 0 });
    expect(model.next).toEqual({
      label: "Sedang berlangsung · selesai 10:00 · R.SG PWK LT.6",
      short: "Sedang berlangsung · selesai 10:00",
      // The time and the room apart, for a widget that gives each its own line.
      when: "Sedang berlangsung · selesai 10:00",
      room: "R.SG PWK LT.6",
      open: { kind: "class", sessionId: "2194342" },
    });
    expect(model.task).toMatchObject({ detail: "Tenggat Kam, 26 Nov, 23:59", open: { kind: "route", route: { screen: "task" } } });
    // The class on now ends at 10:00.
    expect(model.changesAt).toBe(at("2026-10-08T10:00:00+07:00"));
  });

  it("the course chosen, and a code no longer in the term falls back", () => {
    expect(courseWidget(facts, "II4091").course?.code).toBe("II4091");
    expect(courseWidget(facts, "XX0000").course?.code).toBe("PL3002");
  });

  it("never opened: where to start", async () => {
    const empty = await startEngine();
    expect(courseWidget(widgetFacts(empty.engine.snapshot(), empty.world.clock.now()), null)).toMatchObject({
      state: "signedOut",
      course: null,
      quiet: { state: "signedOut", name: "Mata kuliah", label: "Kamu belum masuk.", action: "Masuk" },
    });
  });
});
