// @vitest-environment jsdom
// v2-12 (#80), seam 2: the KRS, UKT and Kalender akademik tabs of Rencana
// studi as the Student sees them, with the real engine, the pretend EduNex and
// ITB calendar behind the bridge, and SIX's records injected (read from the
// recorded pages by the real readers).
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import type { Bill, ClassSession, DatasetName, KrsPlan, Progress } from "../../src/core/models";
import { readBills } from "../../src/engine/sources/six/readers/bills";
import { readKrs } from "../../src/engine/sources/six/readers/krs";
import { PretendSix } from "../pretend/six";
import { PretendWorld } from "../pretend/world";
import { openApp } from "./harness";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

const HOUR = 3_600_000;
const wib = (iso: string) => Date.parse(`${iso}+07:00`);
const KRS = /\/registrasi\/rencanastudi\/\d+$/;
const BILLS = /\/keuangan$/;

/** The recorded KRS, as SIX staff (or the Student) left it. */
function krs(edit: (six: PretendSix) => void = () => undefined): KrsPlan {
  const six = new PretendSix(() => 0);
  edit(six);
  return readKrs(six.page(KRS));
}
function bills(edit: (six: PretendSix) => void = () => undefined): Bill[] {
  const six = new PretendSix(() => 0);
  edit(six);
  return readBills(six.page(BILLS));
}
const sentOnly = (six: PretendSix) => {
  six.dropKrsChange();
  six.krsStep("plan", "Pengesahan KSM", null);
  six.krsStep("plan", "Persetujuan Dosen Wali", null);
};

let hash = 0;
async function inject(name: string, value: unknown) {
  await screen!.apply({ type: "dataset", dataset: { name: name as DatasetName, value: value as never, fetchedAt: 0, hash: `h${++hash}` } });
}

async function openPlan(now: string) {
  screen = await openApp({ signedIn: true, world: new PretendWorld({ now }) });
  await screen.wait();
  return screen;
}

/** Radix tabs switch on mouse down. */
async function tab(name: string | RegExp) {
  const trigger = screen!.button(name);
  await act(async () => {
    trigger.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
  });
}

const panel = () => document.querySelector("[role=tabpanel][data-state=active]")?.textContent ?? "";

describe("the KRS tab", () => {
  it("sent, waiting for the advisor; then approved; courses with class, SKS and approval", async () => {
    const s = await openPlan("2026-08-17T09:00:00+07:00");
    await inject("six.krs", krs(sentOnly));
    await s.click(/^Rencana studi/);
    await tab("KRS");
    let text = panel();
    expect(text).toContain("Menunggu dosen wali");
    expect(text).toContain("Dosen wali: Prof. Dr. Ir. Wahyu Wijaya, M.T.");
    expect(text).toMatch(/DikirimMin, 16 Agu · 10:45/);
    expect(text).toContain("Disetujui dosen waliBelum");
    expect(text).toContain("Perubahan KRS (URS): 15 Sep – 18 Sep");
    expect(text).toContain("14 dari maks. 24 SKS");
    expect(text).toContain("PL3032Ekonomi Infrastruktur dan TransportasiKelas 013 SKSDisetujui");
    expect(text).not.toContain("Perubahan rencana studi (URS)");

    await inject(
      "six.krs",
      krs((six) => {
        sentOnly(six);
        six.krsStep("plan", "Persetujuan Dosen Wali", "18 Agu 2026 14.39.32");
        six.krsCourse("KU5014", { approved: false });
      }),
    );
    text = panel();
    expect(text).toContain("Disetujui dosen waliTinggal disahkan SIX");
    expect(text).toContain("Disetujui dosen waliSel, 18 Agu · 14:39");
    expect(text).toContain("KU5014Teknik Penyelesaian Masalah TerstrukturKelas 013 SKSBelum disetujui");
  });

  it("the official plan with its change round; nothing sent during DRS is a step to do", async () => {
    const s = await openPlan("2026-10-11T09:00:00+07:00");
    await inject("six.krs", krs());
    await s.click(/^Rencana studi/);
    await tab("KRS");
    expect(panel()).toContain("KRS sudah sah");
    expect(panel()).toContain("Perubahan rencana studi (URS)");
    expect(panel()).toContain("Disahkan (KSM)Rab, 16 Sep · 11:02");
    expect(s.button(/^Rencana studi/).textContent).toBe("Rencana studi");
    s.close();

    const early = await openPlan("2026-08-15T09:00:00+07:00");
    await inject(
      "six.krs",
      krs((six) => {
        sentOnly(six);
        six.krsStep("plan", "Pengiriman Rencana Studi", null);
      }),
    );
    await early.click(/^Rencana studi/);
    await tab("KRS");
    expect(panel()).toContain("KRS belum dikirim");
    expect(panel()).toContain("Pengisian KRS (DRS) dibuka sampai 20 Agu");
    expect(early.button(/^Rencana studi/).textContent).toBe("Rencana studi1");
  });

  it("overlapping classes on SIX's timetable are flagged", async () => {
    const s = await openPlan("2026-10-11T09:00:00+07:00");
    await inject("six.krs", krs());
    const meet = (id: string, code: string, iso: string): ClassSession => ({ id, courseCode: code, courseName: code, start: wib(iso), end: wib(iso) + 2 * HOUR, activity: "Kuliah", room: "9134" });
    await inject("six.schedule", [meet("1", "PL3002", "2026-10-15T08:00:00"), meet("2", "KU5014", "2026-10-15T09:00:00"), meet("3", "PL3002", "2026-10-22T08:00:00"), meet("4", "KU5014", "2026-10-22T09:00:00")]);
    await s.click(/^Rencana studi/);
    await tab("KRS");
    expect(panel()).toContain("KU5014 dan PL3002 bentrok Kam 15 Okt, 09:00–10:00, 2 pertemuan. SIX menerima KRS ini tanpa peringatan.");
    expect(s.button(/^Rencana studi/).textContent).toBe("Rencana studi1");
  });

  it("before SIX is read", async () => {
    const s = await openPlan("2026-10-11T09:00:00+07:00");
    await s.click(/^Rencana studi/);
    await tab("KRS");
    expect(panel()).toContain("Belum ada KRS dari SIX");
  });
});

describe("the UKT tab", () => {
  const unpaid = (six: PretendSix) => six.setBill("2026-2", { amount: "5.400.000", paid: "-", due: "31 Jan 2027" });

  it("a new bill: amount, status, SIX's last day next to ITB's deadline; then paid", async () => {
    const s = await openPlan("2027-01-20T09:00:00+07:00");
    await inject("six.krs", { ...krs(), term: "2026-2" });
    await inject("six.bills", bills(unpaid));
    await s.click(/^Rencana studi/);
    await tab("UKT");
    let text = panel();
    expect(text).toContain("Semester ini · Semester 2 2026/2027Rp5.400.000Belum dibayarBayar paling lambat 31 Jan");
    expect(text).toContain("SIX Batas bayar di SIX31 Jan");
    expect(text).toContain("Kalender ITB Batas di kalender ITB31 Jan");
    expect(text).toContain("Semester depan · Semester 1 2027/2028Belum ditagih");
    // History: newest first, instalments said.
    expect(text).toMatch(/Semester 2 2026\/2027Rp5\.400\.00031 Jan 2027Belum dibayarSemester 1 2026\/2027Rp5\.400\.00024 Agu 2026Lunas/);
    expect(text).toContain("Rp10.500.000dicicil 2x");
    expect(s.button(/^Rencana studi/).textContent).toBe("Rencana studi");

    await inject("six.bills", bills((six) => six.setBill("2026-2", { amount: "5.400.000", paid: "5.400.000", due: "31 Jan 2027" })));
    text = panel();
    expect(text).toContain("Rp5.400.000Lunas");
    expect(text).not.toContain("Bayar paling lambat");
  });

  it("due within a week is a warning; overdue is said plainly", async () => {
    const s = await openPlan("2027-01-28T09:00:00+07:00");
    await inject("six.krs", { ...krs(), term: "2026-2" });
    await inject("six.bills", bills(unpaid));
    await s.click(/^Rencana studi/);
    await tab("UKT");
    expect(s.button(/^Rencana studi/).textContent).toBe("Rencana studi1");
    s.close();

    const late = await openPlan("2027-02-02T09:00:00+07:00");
    await inject("six.krs", { ...krs(), term: "2026-2" });
    await inject("six.bills", bills(unpaid));
    await late.click(/^Rencana studi/);
    await tab("UKT");
    expect(panel()).toContain("UKT Semester 2 2026/2027 lewat batas bayar sejak 31 Jan. Sisa Rp5.400.000.");
    expect(panel()).toContain("Lewat batas bayar");
    expect(document.querySelector("[role=alert]")).not.toBeNull();
  });
});

describe("the Kalender akademik tab", () => {
  it("this term and the next, next ones first, each with what it means; past ones folded", async () => {
    const s = await openPlan("2026-10-11T09:00:00+07:00");
    await inject("six.krs", krs());
    await inject("six.bills", bills());
    await inject("six.progress", { entryTerm: "2023-1", ipk: 3.26, sksPassed: 125, sksIncomplete: 0, sksByKind: [], stages: [] } satisfies Progress);
    await s.click(/^Rencana studi/);
    await tab("Kalender akademik");
    const rows = [...document.querySelectorAll("[role=tabpanel][data-state=active] ol > li")].map((li) => li.textContent ?? "");
    expect(rows[0]).toBe("12 Okt – 16 OktSenUTS · Semester 1 2026/2027Minggu ujian tengah semester.besok");
    expect(rows[1]).toContain("Kuesioner evaluasi perkuliahan · Semester 1 2026/2027Isi kuesioner tiap mata kuliah, atau SIX menyembunyikan nilainya.");
    expect(rows.find((r) => r.includes("Evaluasi kemajuan studi"))).toContain("Target 72 SKS di akhir tahun ke-3; kamu sudah lulus 125 SKS.");
    expect(rows.find((r) => r.startsWith("20 Jan – 28 Jan"))).toContain("Pengisian KRS (DRS) · Semester 2 2026/2027Isi KRS di SIX, lalu minta persetujuan dosen wali.");
    // Past ones: folded, then opened.
    const past = document.querySelector("details")!;
    expect(past.open).toBe(false);
    expect(past.querySelector("summary")?.textContent).toBe("Sudah lewat4");
    expect(past.textContent).toContain("Pengisian KRS (DRS) · Semester 1 2026/2027KRS-mu sudah dikirim.");
    expect(past.textContent).toContain("Batas bayar UKT · Semester 1 2026/2027UKT-mu sudah lunas.");
  });

  it("in English", async () => {
    const s = await openPlan("2026-10-11T09:00:00+07:00");
    await s.engineDoes(() => s.engine.updateSettings({ lang: "en" }));
    await s.click(/^Study plan/);
    await tab("Academic calendar");
    expect(panel()).toContain("Midterms (UTS) · Semester 1, 2026/2027Midterm exam week.tomorrow");
  });
});
