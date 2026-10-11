// v2-12 (#80), seam 1: KRS, UKT and ITB calendar alerts, by the real engine
// against the pretend SIX and ITB calendar on a fake clock. Assertions are on
// the OS notifications the engine asks for and the history.
import { describe, expect, it } from "vitest";
import { PretendWorld } from "../pretend/world";
import { startAcademic } from "./academic-harness";

/** The plan as the Student just sent it: no advisor approval, not official, no change round. */
function sentOnly(world: PretendWorld): void {
  world.six.dropKrsChange();
  world.six.krsStep("plan", "Pengesahan KSM", null);
  world.six.krsStep("plan", "Persetujuan Dosen Wali", null);
}

describe("KRS alerts", () => {
  it("the plan sent, then approved by the advisor, then made official; nothing at the first sync", async () => {
    const world = new PretendWorld({ now: "2026-08-17T09:00:00+07:00" });
    sentOnly(world);
    const app = await startAcademic({ world });
    expect(app.of("krs")).toEqual([]);

    world.six.krsStep("plan", "Persetujuan Dosen Wali", "18 Agu 2026 14.39.32");
    await app.until("2026-08-18T15:00:00+07:00");
    await app.sixRefresh();
    expect(app.texts("krs")).toEqual(["KRS disetujui dosen wali — 5 mata kuliah · 14 SKS"]);
    expect(app.of("krs")[0]).toMatchObject({ source: "six", target: { screen: "plan", tab: "krs" } });

    world.six.krsStep("plan", "Pengesahan KSM", "20 Agu 2026 14.34.46");
    await app.sixRefresh();
    expect(app.texts("krs")).toEqual(["KRS disetujui dosen wali — 5 mata kuliah · 14 SKS", "KRS sudah sah — 5 mata kuliah · 14 SKS"]);

    // Read again unchanged: never twice.
    await app.sixRefresh();
    expect(app.of("krs")).toHaveLength(2);
  });

  it("the plan changed by the advisor: each course in the history, one notification", async () => {
    const world = new PretendWorld({ now: "2026-10-11T09:00:00+07:00" });
    const app = await startAcademic({ world });
    world.six.krsCourse("PL3032", "remove");
    world.six.krsCourse("KU5014", { approved: false });
    world.six.krsCourse("DK4073", { classNo: "02" });
    await app.sixRefresh();
    const [notice] = app.of("krs");
    expect(app.of("krs")).toHaveLength(1);
    expect(notice).toMatchObject({ count: 3, target: { screen: "plan", tab: "krs" } });
    expect(notice.text).toBe("3 notifikasi baru — DK4073, KU5014, PL3032");
    expect(app.history().filter((a) => a.kind === "krs")).toHaveLength(3);
  });

  it("turned off in Settings: no notification, still in the history", async () => {
    const world = new PretendWorld({ now: "2026-08-17T09:00:00+07:00" });
    sentOnly(world);
    const app = await startAcademic({ world });
    await app.engine.updateSettings({ mutedAlerts: ["krs"] });
    world.six.krsStep("plan", "Persetujuan Dosen Wali", "18 Agu 2026 14.39.32");
    await app.sixRefresh();
    expect(app.of("krs")).toEqual([]);
    expect(app.history().map((a) => a.title.key)).toContain("alert.krs.approved");
  });
});

describe("UKT alerts", () => {
  it("a new bill, reminders a week and a day before, none once paid", async () => {
    const world = new PretendWorld({ now: "2027-01-10T09:00:00+07:00" });
    const app = await startAcademic({ world });
    world.six.setBill("2026-2", { amount: "5.400.000", paid: "-", due: "31 Jan 2027" });
    await app.sixRefresh();
    expect(app.texts("bill")).toEqual(["Tagihan UKT baru · Semester 2 2026/2027 — Rp5.400.000 · bayar paling lambat 31 Jan"]);

    await app.until("2027-01-24T07:59:00+07:00");
    expect(app.of("bill")).toHaveLength(1);
    await app.until("2027-01-24T08:01:00+07:00");
    expect(app.texts("bill")[1]).toBe("UKT jatuh tempo seminggu lagi — Sisa Rp5.400.000 · batas 31 Jan");
    expect(app.of("bill")[1]).toMatchObject({ target: { screen: "plan", tab: "bills" } });

    world.six.setBill("2026-2", { amount: "5.400.000", paid: "5.400.000", due: "31 Jan 2027" });
    await app.sixRefresh();
    await app.until("2027-02-03T09:00:00+07:00");
    expect(app.of("bill")).toHaveLength(2);
  }, 20_000);

  it("left unpaid: the day before, then overdue once", async () => {
    const world = new PretendWorld({ now: "2027-01-28T09:00:00+07:00" });
    world.six.setBill("2026-2", { amount: "5.400.000", paid: "-", due: "31 Jan 2027" });
    const app = await startAcademic({ world });
    // Billed before the first sync: no "new bill", and the week reminder already passed.
    expect(app.of("bill")).toEqual([]);
    await app.until("2027-01-30T08:01:00+07:00");
    expect(app.texts("bill")).toEqual(["UKT jatuh tempo besok — Sisa Rp5.400.000 · batas 31 Jan"]);
    await app.until("2027-02-01T00:01:00+07:00");
    expect(app.texts("bill")[1]).toBe("UKT lewat batas bayar — Sisa Rp5.400.000 · batas 31 Jan");
    await app.until("2027-02-05T09:00:00+07:00");
    expect(app.of("bill")).toHaveLength(2);
  });
});

describe("ITB calendar alerts", () => {
  it("DRS opening and the day before it closes, the UKT deadline, while nothing is done", async () => {
    const world = new PretendWorld({ now: "2026-08-10T09:00:00+07:00" });
    sentOnly(world);
    world.six.krsStep("plan", "Pengiriman Rencana Studi", null);
    world.six.setBill("2026-1", { amount: "5.400.000", paid: "-", due: "24 Agu 2026" });
    const app = await startAcademic({ world });
    await app.until("2026-08-12T08:01:00+07:00");
    expect(app.texts("academic")).toEqual(["Pengisian KRS dibuka — Isi KRS di SIX sampai 20 Agu, lalu minta persetujuan dosen wali"]);
    expect(app.of("academic")[0]).toMatchObject({ source: "itb", target: { screen: "plan", tab: "deadlines" } });
    await app.until("2026-08-19T08:01:00+07:00");
    expect(app.texts("academic")[1]).toBe("Pengisian KRS ditutup besok — Isi KRS di SIX sampai 20 Agu, lalu minta persetujuan dosen wali");
    await app.until("2026-08-22T08:01:00+07:00");
    expect(app.texts("academic")[2]).toBe("Batas bayar UKT besok — Kalender ITB: bayar paling lambat 23 Agu");
  }, 20_000);

  it("nothing about a KRS already sent or a UKT already paid; the URS window", async () => {
    const world = new PretendWorld({ now: "2026-08-10T09:00:00+07:00" });
    sentOnly(world);
    world.six.krsStep("plan", "Pengiriman Rencana Studi", null);
    const app = await startAcademic({ world });
    await app.until("2026-08-12T08:01:00+07:00");
    expect(app.of("academic")).toHaveLength(1);
    world.six.krsStep("plan", "Pengiriman Rencana Studi", "16 Agu 2026 10.45.42");
    await app.until("2026-08-16T11:00:00+07:00");
    await app.sixRefresh();
    await app.until("2026-08-24T09:00:00+07:00");
    expect(app.of("academic")).toHaveLength(1);
    // URS 15–18 Sep: open, and the day before it closes.
    await app.until("2026-09-18T09:00:00+07:00");
    expect(app.texts("academic").slice(1)).toEqual(["Perubahan KRS dibuka — Ubah KRS di SIX sampai 18 Sep", "Perubahan KRS ditutup besok — Ubah KRS di SIX sampai 18 Sep"]);
  }, 30_000);

  it("the questionnaire opening", async () => {
    const app = await startAcademic({ world: new PretendWorld({ now: "2026-11-28T09:00:00+07:00" }) });
    await app.until("2026-11-30T08:01:00+07:00");
    expect(app.texts("academic")).toEqual(["Kuesioner evaluasi perkuliahan dibuka — Isi sampai 11 Des, atau SIX menyembunyikan nilaimu"]);
  });

  it("silent for a window already open at the first sync", async () => {
    const world = new PretendWorld({ now: "2026-08-15T09:00:00+07:00" });
    sentOnly(world);
    world.six.krsStep("plan", "Pengiriman Rencana Studi", null);
    const app = await startAcademic({ world });
    await app.until("2026-08-18T09:00:00+07:00");
    expect(app.of("academic")).toEqual([]);
    await app.until("2026-08-19T08:01:00+07:00");
    expect(app.texts("academic")).toEqual(["Pengisian KRS ditutup besok — Isi KRS di SIX sampai 20 Agu, lalu minta persetujuan dosen wali"]);
  });
});
