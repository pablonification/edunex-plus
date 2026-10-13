// @vitest-environment jsdom
// v2-11 (#79), seam 2: Rencana studi's planner and curriculum map as the
// Student uses them, the real window code on the real engine, with SIX's
// records (read from the recorded pages) and ITB's catalog as datasets.
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import type { StudyPlan } from "../../src/core/models";
import { records } from "../engine/grades-records";
import { PretendWorld } from "../pretend/world";
import { openApp } from "./harness";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

let hash = 0;
async function inject(name: string, value: unknown) {
  await screen!.apply({ type: "dataset", dataset: { name: name as never, value: value as never, fetchedAt: 0, hash: `p${++hash}` } });
}

async function openPlan(options: { saved?: StudyPlan; lang?: "en"; noRecords?: boolean } = {}) {
  screen = await openApp({ world: new PretendWorld({ now: "2026-10-11T09:00:00+07:00" }), signedIn: true });
  if (options.lang) await screen.engineDoes(() => screen!.engine.updateSettings({ lang: options.lang }));
  if (!options.noRecords) {
    const data = await records();
    for (const [name, value] of [
      ["six.transcript", data.transcript],
      ["six.progress", data.progress],
      ["six.curriculum", data.curriculum],
      ["itb.catalog", data.catalog],
      ["itb.calendar", data.calendar],
    ] as const)
      await inject(name, value);
  }
  if (options.saved) await screen.engineDoes(() => screen!.engine.setLocal("local.plan", options.saved));
  await screen.click(options.lang === "en" ? "Study plan" : "Rencana studi");
  return screen;
}

/** Radix tabs switch on mouse down, as a real click starts. */
async function tab(name: string) {
  const trigger = [...document.querySelectorAll<HTMLElement>("[role=tab]")].find((el) => el.textContent === name);
  if (!trigger) throw new Error(`No tab ${name}`);
  await act(async () => {
    trigger.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
  });
}

const block = (title: RegExp) =>
  [...document.querySelectorAll<HTMLElement>("section[aria-label]")].find((el) => title.test(el.getAttribute("aria-label") ?? ""));
/** The "Add course" button of a semester. */
const addIn = (title: RegExp) => [...block(title)!.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === "Tambah mata kuliah")!;
const rulesText = () => document.querySelector("ul[aria-label='Aturan, dicek langsung'], ul[aria-label='Rules, checked live']")?.textContent ?? "";
const rule = (id: string) =>
  [...document.querySelectorAll<HTMLElement>(`[data-rule=${id}]`)].map((el) => `${el.dataset.level}: ${el.textContent?.replace(/^!/, "")}`);
const saved = () => screen!.store.dataset("local.plan")?.value as StudyPlan | undefined;

async function search(query: string) {
  await act(async () => {
    const input = document.querySelector<HTMLInputElement>("[role=dialog] input")!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, query);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** The planner's toast ("… · Urungkan"), and pressing ⌘Z. */
const toastText = () => [...document.querySelectorAll("[role=status]")].map((el) => el.textContent).join(" | ");
async function commandZ() {
  await act(async () => {
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "z", metaKey: true, bubbles: true }));
  });
}
const summary = () => document.querySelector("main .shadow-raised")?.textContent ?? "";

describe("the study planner", () => {
  it("before SIX is read: what SIX unlocks, and the calendar that still works", async () => {
    const s = await openPlan({ noRecords: true });
    expect(s.text()).toContain("Rencana studi butuh SIX");
    await s.click("Buka Kalender akademik");
    expect(document.querySelector("[role=tab][data-state=active]")?.textContent).toBe("Kalender akademik");
  });

  it("starts from where the Student stands: SKS labelled, the semester, IPK and the predicate, rules", async () => {
    const s = await openPlan();
    expect(summary()).toContain("Sarjana Sistem dan Teknologi Informasi144 SKS terpenuhi+7 cadangan");
    expect(summary()).toContain("125 lulus14 semester ini12 direncanakan");
    expect(summary()).toContain("LulusSemester 81 hal perlu dicek");
    expect(summary()).toContain("IPK saat lulus3,30Sangat memuaskan");
    expect(s.text()).not.toContain("Tanpa predikat pujian");
    expect(block(/^Semester 7 · sekarang/)?.textContent).toContain("14 SKSIP 3,50IPK jadi 3,29");
    const next = block(/^Semester 8 · 2026\/2027 Genap/)!;
    expect(next.textContent).toContain("12 / 24 SKSIP 3,50IPK jadi 3,30");
    expect([...next.querySelectorAll("li")].map((li) => li.textContent?.replace(/AABBBCCDE$/, ""))).toEqual([
      // The Kerja Praktik risk sits on its own row, not only in the rules.
      "II4090Kerja PraktikBiasanya di semester ganjilWajib · smt 72",
      "II4092Tugas AkhirWajib · smt 84",
      "II4010Manajemen DataSpesialisasi3",
      "II4011Transformasi DigitalSpesialisasi3",
    ]);
    expect(rule("parity")).toEqual([
      "warn: Perlu dicekII4090 Kerja PraktikKurikulum menaruhnya di semester 7 (ganjil). Pastikan dibuka di semester genap, atau rencanakan di semester pendek.",
    ]);
    expect(rule("total")[0]).toContain("ok: Terpenuhi144 SKS terpenuhi (+7 cadangan)");
    expect(rule("required")[0]).toContain("Semua 45 sudah diambil, sedang diambil, atau direncanakan.");
    expect(rule("electives")[0]).toContain("27 dari 27 SKS terpenuhi (+10 lebih).");
    expect(rule("finish")[0]).toContain("Lulus di semester 8");
    // No source tags on rules.
    expect(rulesText()).not.toMatch(/SIX|Kalender ITB/);
  });

  it("adds any ITB course by searching the catalog, and checks the semester's load live", async () => {
    const s = await openPlan();
    for (const code of ["II4021", "II4022", "II4023"]) {
      await s.click(addIn(/^Semester 8/));
      expect(document.querySelector("[role=dialog]")?.textContent).toContain("Tambah ke Semester 8 · 2026/2027 Genap");
      await search(code === "II4021" ? "kriptografi" : code);
      await s.click(`Tambah ${code}`);
    }
    expect(block(/^Semester 8/)!.textContent).toContain("21 / 24 SKS");
    expect(rule("load")).toEqual(["warn: Perlu dicekSemester 8 · 2026/2027 Genap21 SKS: di atas 20 perlu persetujuan dosen wali."]);
    expect(saved()?.terms[0].courses.map((c) => c.code)).toEqual(["II4090", "II4092", "II4010", "II4011", "II4021", "II4022", "II4023"]);
    expect(s.calls.some((c) => c.name === "local.set")).toBe(true);
    // Never a KRS: the only thing written is the plan on this computer.
    expect(s.calls.filter((c) => c.name !== "local.set" && c.name !== "app.snapshot" && c.name !== "app.ready").map((c) => c.name)).toEqual([]);
  });

  it("removing a required course: the rule says what's missing, the header agrees, and it can be undone", async () => {
    const s = await openPlan();
    await s.click("Hapus II4092");
    expect(rule("required")).toEqual(["error: Belum terpenuhiMata kuliah wajibBelum direncanakan: II4092 Tugas Akhir."]);
    expect(rule("total")[0]).toContain("ok: Terpenuhi144 SKS terpenuhi (+3 cadangan)");
    expect(summary()).toContain("Belum bisa lulusKurang 1 mata kuliah wajib");
    expect(toastText()).toContain("II4092 dihapus dari rencanaUrungkan");
    await s.click("Urungkan");
    expect(saved()?.terms[0].courses.map((c) => c.code)).toContain("II4092");
    expect(rule("required")[0]).toContain("ok:");
  });

  it("removing a semester: one verdict (never 'graduate in 7' with rules unmet), and undo brings it back (bug)", async () => {
    const s = await openPlan();
    await s.click("Hapus Semester 8 · 2026/2027 Genap");
    expect(toastText()).toContain("Semester 8 · 2026/2027 Genap dihapus (4 mata kuliah)Urungkan");
    expect(summary()).toContain("Belum bisa lulusKurang 5 SKS dan 2 mata kuliah wajib");
    expect(summary()).not.toContain("Semester 7");
    expect(rule("finish")).toEqual(["error: Belum terpenuhiBelum bisa lulusMasih kurang 5 SKS dan 2 mata kuliah wajib."]);
    expect(rulesText()).not.toContain("Lulus di semester 7");
    await s.click("Urungkan");
    expect(block(/^Semester 8 · 2026\/2027 Genap/)!.querySelectorAll("li")).toHaveLength(4);
    // ⌘Z takes back the last removal too.
    await s.click("Hapus Semester 8 · 2026/2027 Genap");
    expect(block(/^Semester 8/)).toBeUndefined();
    await commandZ();
    expect(block(/^Semester 8/)).toBeDefined();
  });

  it("an empty plan: SKS short, required courses and the specialization missing", async () => {
    const s = await openPlan({ saved: { terms: [{ term: "2026-2", courses: [] }], expected: {}, target: null, minor: null } });
    expect(block(/^Semester 8/)!.textContent).toContain("Belum ada rencana.");
    expect(summary()).toContain("139 dari 144 SKSkurang 5");
    expect(rule("total")).toEqual(["error: Belum terpenuhi139 dari 144 SKSKurang 5 SKS. Tambah mata kuliah."]);
    expect(rule("required")[0]).toContain("Belum direncanakan: II4090 Kerja Praktik, II4092 Tugas Akhir.");
    expect(rule("specialization")[0]).toContain(
      "warn: Perlu dicekSistem Informasi CerdasBelum direncanakan: II4010 Manajemen Data, II4011 Transformasi Digital.",
    );
    expect(s.text()).toContain("Belum bisa lulus");
  });

  it("adds and removes semesters, short ones too, with their own limits", async () => {
    const s = await openPlan();
    await s.click("Tambah semester");
    await s.click("Tambah semester pendek");
    expect([...document.querySelectorAll("section[aria-label] h3")].map((h) => h.textContent)).toEqual([
      "Semester 7 · sekarang",
      "Semester 8 · 2026/2027 Genap",
      "Semester pendek · 2026/2027",
      "Semester 9 · 2027/2028 Ganjil",
    ]);
    expect(block(/^Semester pendek/)!.textContent).toContain("0 / 9 SKS");
    expect(s.has("Hapus Semester 8 · 2026/2027 Genap")).toBe(false);
    await s.click("Hapus Semester 9 · 2027/2028 Ganjil");
    await s.click("Hapus Semester pendek · 2026/2027");
    expect(saved()?.terms.map((t) => t.term)).toEqual(["2026-2"]);
  });

  it("finishing in semester 9 keeps honors possible; expected grades move every IPK", async () => {
    const s = await openPlan();
    await s.click("Tambah semester");
    await s.click(addIn(/^Semester 9/));
    await search("II4024");
    await s.click("Tambah II4024");
    expect(rule("finish")).toEqual(["warn: Perlu dicekLulus di semester 9Lewat 8 semester; predikat pujian masih mungkin (maks. 9)."]);
    await act(async () => {
      const select = document.querySelector<HTMLSelectElement>("select[aria-label='Perkiraan nilai II4092']")!;
      select.value = "A";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    // Semester 8: 2 AB + 4 A + 3 AB + 3 AB = 44 points over 12 SKS.
    expect(block(/^Semester 8/)!.textContent).toContain("IP 3,67");
  });

  it("plans a retake from the candidates, and summa cum laude closes", async () => {
    const s = await openPlan();
    await s.click(addIn(/^Semester 8/));
    const dialog = document.querySelector("[role=dialog]")!.textContent!;
    expect(dialog).toContain("Ulang untuk menaikkan IPK");
    expect(dialog).toContain("Internet of Things3 SKS · Sistem dan Teknologi Informasi · Nilaimu: C · IPK 3,26 → 3,31 dengan A");
    // Fisika Dasar IIA was 4 SKS (BC) in the old curriculum; taken again it is today's 3-SKS course: (408 − 10 + 12) / 124.
    expect(dialog).toContain("Fisika Dasar IIA3 SKS · Nilaimu: BC · IPK 3,26 → 3,31 dengan A");
    await s.click("Ulang II2260");
    expect(block(/^Semester 8/)!.textContent).toContain("II2260Internet of ThingsUlang · dulu C");
    expect(s.text()).toContain("Summa cum laude ≥ 3,85tertutup karena mengulang");
    expect(saved()?.terms[0].courses.at(-1)).toMatchObject({ code: "II2260", retake: true });
  });

  it("an IPK target: the average the rest needs, one setting with Nilai", async () => {
    const s = await openPlan();
    expect(s.text()).toContain("IPK 3,50 di luar jangkauan dengan mata kuliah tersisa, walau semua A.");
    // Every honors level out of reach: said once, kindly, not three "di luar jangkauan" rows.
    expect(s.text()).toContain("Cum laude (≥ 3,50) sudah di luar jangkauan. Tiap nilai bagus tetap menaikkan IPK-mu.");
    expect(s.text()).not.toContain("Summa cum laude ≥ 3,85di luar jangkauan");
    await s.click("Target IPK 3,00");
    expect(s.text()).toContain("Untuk IPK 3,00: rata-rata 1,74 (sekitar C) di 26 SKS tersisa.");
    expect(saved()?.target).toBe(3);
    await s.click("Nilai");
    expect(s.button("Target IPK 3,00").getAttribute("aria-checked")).toBe("true");
  });

  it("tracks a minor and checks its SKS", async () => {
    const s = await openPlan();
    await s.click("Pantau minor Branding Berbasis Digital");
    expect(rule("minor")).toEqual(["warn: Perlu dicekMinor Branding Berbasis Digital3 dari 12 SKS dari daftarnya."]);
    await s.click(addIn(/^Semester 8/));
    expect(document.querySelector("[role=dialog]")!.textContent).toContain("Minor Branding Berbasis Digital");
  });

  it("reset asks first, says what's lost, and can still be undone (bug: it used to wipe at once)", async () => {
    const s = await openPlan();
    expect(s.button("Atur ulang rencana").disabled).toBe(true);
    await s.click("Hapus II4010");
    await s.click("Atur ulang rencana");
    const dialog = document.querySelector("[role=alertdialog]")!;
    expect(dialog.textContent).toContain("Atur ulang rencana?Semua perubahanmu hilang: 1 mata kuliah yang kamu hapus (akan kembali).");
    await s.click("Batal");
    expect(saved()?.terms[0].courses.map((c) => c.code)).not.toContain("II4010");
    await s.click("Atur ulang rencana");
    await s.click("Atur ulang");
    expect(saved()?.terms[0].courses.map((c) => c.code)).toEqual(["II4090", "II4092", "II4010", "II4011"]);
    expect(toastText()).toContain("Rencana diatur ulangUrungkan");
    // Only the newest change can be undone: its toast replaces the removal's.
    expect(toastText()).not.toContain("II4010 dihapus");
    await s.click("Urungkan");
    expect(saved()?.terms[0].courses.map((c) => c.code)).not.toContain("II4010");
  });

  it("in English", async () => {
    const s = await openPlan({ lang: "en" });
    expect(summary()).toContain("144 SKS covered+7 to spare");
    expect(summary()).toContain("125 passed14 this semester12 planned");
    expect(s.text()).toContain("Semester 8 · 2026/2027 Even");
    expect(rulesText()).toContain("Check it also runs in the even semester");
    expect(rulesText()).toContain("27 of 27 SKS covered (+10 more).");
  });
});

describe("the curriculum map", () => {
  const row = (code: string) => [...document.querySelectorAll("main li")].find((li) => li.textContent?.startsWith(code))?.textContent;

  it("labelled totals from the planner's own count: no more '0 SKS' against '37 of 27'", async () => {
    const s = await openPlan();
    await tab("Kurikulum");
    expect(s.text()).toContain(
      "Total kurikulum144 SKSwajib 117 · pilihan 27Wajib tersisa2 mata kuliah · 6 SKSsemua sudah direncanakanPilihan27 dari 27 SKS+1019 lulus · 12 semester ini · 6 direncanakan",
    );
  });

  it("late in the studies it opens on what's left, with a summary; the switch shows everything", async () => {
    const s = await openPlan();
    await tab("Kurikulum");
    expect(s.text()).toContain("Sisa: 2 wajib (6 SKS) · pilihan terpenuhi · 4 perlu dicek ke prodi");
    expect(row("MA1101")).toBeUndefined();
    expect(row("WI2005")).toBe("WI2005Bahasa IndonesiaBelum ada nilai di SIX: cek ke prodi2");
    expect(row("II4090")).toBe("II4090Kerja PraktikDirencanakan2");
    await s.click("Sisa saja");
    expect(row("MA1101")).toBe("MA1101Matematika ILulus· AB4");
    expect(row("KI1101")).toBe("KI1101Kimia Dasar Ilewat KI1002 Kimia Dasar BLulus· A3");
    expect(row("WI2003")).toBe("WI2003Olah Ragalewat KU1001 Olah RagaLulus· BC1");
    expect(row("II4091")).toBe("II4091Proposal Tugas AkhirSemester ini2");
    expect(s.text()).toContain("Mata kuliah lain yang ikut dihitung");
  });

  it("opens a course's syllabus on SIX's public pages", async () => {
    const s = await openPlan();
    await tab("Kurikulum");
    await s.click("Sisa saja");
    await s.click("Silabus MA1101 di SIX");
    expect(s.calls.at(-1)).toEqual({ name: "shell.openExternal", input: { url: "https://six.itb.ac.id/pub/matakuliah/47455" } });
  });

  it("specializations and minors with progress, the registered one first; untaken courses stay quiet", async () => {
    const s = await openPlan();
    await tab("Kurikulum");
    expect(s.text()).toContain("SpesialisasiSistem Informasi CerdasTerdaftar6 dari 12 SKS");
    expect(s.text()).toContain("Keamanan dan Privasi Siber0 dari 12 SKS");
    expect(s.text()).toContain("MinorBranding Berbasis DigitalDesain Komunikasi Visual3 dari 12 SKS");
    expect(document.querySelectorAll("aside .bg-warning-bg")).toHaveLength(0);
  });
});
