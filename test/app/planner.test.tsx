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

const block = (title: RegExp) => [...document.querySelectorAll<HTMLElement>("section[aria-label]")].find((el) => title.test(el.getAttribute("aria-label") ?? ""));
/** The "Add course" button of a semester. */
const addIn = (title: RegExp) => [...block(title)!.querySelectorAll<HTMLButtonElement>("button")].find((b) => b.textContent === "Tambah mata kuliah")!;
const rulesText = () => document.querySelector("ul[aria-label='Aturan, dicek langsung'], ul[aria-label='Rules, checked live']")?.textContent ?? "";
const rule = (id: string) => [...document.querySelectorAll<HTMLElement>(`[data-rule=${id}]`)].map((el) => `${el.dataset.level}: ${el.textContent?.replace(/^!/, "")}`);
const saved = () => screen!.store.dataset("local.plan")?.value as StudyPlan | undefined;

async function search(query: string) {
  await act(async () => {
    const input = document.querySelector<HTMLInputElement>("[role=dialog] input")!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, query);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("the study planner", () => {
  it("before SIX is read: one plain line", async () => {
    const s = await openPlan({ noRecords: true });
    expect(s.text()).toContain("Perencana terisi setelah transkrip dan kurikulummu terbaca dari SIX.");
  });

  it("starts from where the Student stands: SKS to graduation, the semester, IPK and honors, rules", async () => {
    const s = await openPlan();
    expect(s.text()).toContain("Sarjana Sistem dan Teknologi Informasi151 / 144 SKS125 lulus · 14 semester ini · 12 direncanakan");
    expect(s.text()).toContain("LulusSemester 81 hal perlu dicek");
    expect(s.text()).toContain("IPK saat lulus3,30Tanpa predikat pujian");
    expect(block(/^Semester 7 · sekarang/)?.textContent).toContain("14 SKSIP 3,50IPK jadi 3,29");
    const next = block(/^Semester 8 · 2026\/2027 Genap/)!;
    expect(next.textContent).toContain("12 / 24 SKSIP 3,50IPK jadi 3,30");
    expect([...next.querySelectorAll("li")].map((li) => li.textContent?.replace(/AABBBCCDE$/, ""))).toEqual([
      "II4090Kerja PraktikWajib · smt 72",
      "II4092Tugas AkhirWajib · smt 84",
      "II4010Manajemen DataSpesialisasi3",
      "II4011Transformasi DigitalSpesialisasi3",
    ]);
    expect(rule("parity")).toEqual([
      "warn: Perlu dicekII4090 Kerja PraktikSIXKurikulum menaruhnya di semester 7 (ganjil). Pastikan dibuka di semester genap, atau rencanakan di semester pendek.",
    ]);
    expect(rule("total")[0]).toContain("ok: Terpenuhi151 dari 144 SKS");
    expect(rule("required")[0]).toContain("Ke-45 sudah diambil, sedang diambil, atau direncanakan.");
    expect(rule("finish")[0]).toContain("Lulus di semester 8");
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
    expect(rule("load")).toEqual(["warn: Perlu dicekSemester 8 · 2026/2027 GenapKalender ITB21 SKS: di atas 20 perlu persetujuan dosen wali."]);
    expect(saved()?.terms[0].courses.map((c) => c.code)).toEqual(["II4090", "II4092", "II4010", "II4011", "II4021", "II4022", "II4023"]);
    expect(s.calls.some((c) => c.name === "local.set")).toBe(true);
    // Never a KRS: the only thing written is the plan on this computer.
    expect(s.calls.filter((c) => c.name !== "local.set" && c.name !== "app.snapshot" && c.name !== "app.ready").map((c) => c.name)).toEqual([]);
  });

  it("removing a required course: the rule says what's missing", async () => {
    const s = await openPlan();
    await s.click("Hapus II4092");
    expect(rule("required")).toEqual(["error: Belum terpenuhiMata kuliah wajibSIXBelum direncanakan: II4092 Tugas Akhir."]);
    expect(rule("total")[0]).toContain("ok: Terpenuhi147 dari 144 SKS");
    expect(s.text()).toContain("1 aturan belum terpenuhi");
  });

  it("an empty plan: SKS short, required courses and the specialization missing", async () => {
    const s = await openPlan({ saved: { terms: [{ term: "2026-2", courses: [] }], expected: {}, target: null, minor: null } });
    expect(block(/^Semester 8/)!.textContent).toContain("Belum ada rencana.");
    expect(rule("total")).toEqual(["error: Belum terpenuhi139 dari 144 SKSSIXKurang 5 SKS. Tambah mata kuliah."]);
    expect(rule("required")[0]).toContain("Belum direncanakan: II4090 Kerja Praktik, II4092 Tugas Akhir.");
    expect(rule("specialization")[0]).toContain("warn: Perlu dicekSistem Informasi CerdasSIXBelum direncanakan: II4010 Manajemen Data, II4011 Transformasi Digital.");
    expect(s.text()).toContain("LulusSemester 7");
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
    expect(rule("finish")).toEqual(["warn: Perlu dicekLulus di semester 9Kalender ITBLewat 8 semester; predikat pujian masih mungkin (maks. 9)."]);
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

  it("an IPK target: the average the rest needs", async () => {
    const s = await openPlan();
    expect(s.text()).toContain("Tidak tercapai dengan mata kuliah tersisa, walau semua A.");
    await s.click("Target IPK 3,00");
    expect(s.text()).toContain("Rata-rata 1,74 (sekitar C) di 26 SKS terakhirmu.");
    expect(saved()?.target).toBe(3);
  });

  it("tracks a minor and checks its SKS", async () => {
    const s = await openPlan();
    await s.click("Pantau minor Branding Berbasis Digital");
    expect(rule("minor")).toEqual(["warn: Perlu dicekMinor Branding Berbasis DigitalSIX3 dari 12 SKS dari daftarnya."]);
    await s.click(addIn(/^Semester 8/));
    expect(document.querySelector("[role=dialog]")!.textContent).toContain("Minor Branding Berbasis Digital");
  });

  it("reset puts the starting plan back", async () => {
    const s = await openPlan();
    await s.click("Hapus II4010");
    await s.click("Atur ulang rencana");
    expect(saved()?.terms[0].courses.map((c) => c.code)).toEqual(["II4090", "II4092", "II4010", "II4011"]);
  });

  it("in English", async () => {
    const s = await openPlan({ lang: "en" });
    expect(s.text()).toContain("125 passed · 14 this semester · 12 planned");
    expect(s.text()).toContain("Semester 8 · 2026/2027 Even");
    expect(rulesText()).toContain("Check it also runs in the even semester");
  });
});

describe("the curriculum map", () => {
  it("the program by semester, passed courses marked, courses passed under another code matched", async () => {
    const s = await openPlan();
    await tab("Kurikulum");
    expect(s.text()).toContain("Kurikulum 2024 - Sarjana Sistem dan Teknologi Informasi SIX117 SKSWajib tersisa6 SKSPilihan0 SKS19 lulus · 12 semester ini · butuh 27");
    const row = (code: string) => [...document.querySelectorAll("main li")].find((li) => li.textContent?.startsWith(code))?.textContent;
    expect(row("MA1101")).toBe("MA1101Matematika ILulus· AB4");
    expect(row("KI1101")).toBe("KI1101Kimia Dasar Ilewat KI1002 Kimia Dasar BLulus· A3");
    expect(row("WI2003")).toBe("WI2003Olah Ragalewat KU1001 Olah RagaLulus· BC1");
    expect(row("WI2005")).toBe("WI2005Bahasa IndonesiaTidak tercantum di SIX2");
    expect(row("II4091")).toBe("II4091Proposal Tugas AkhirSemester ini2");
    expect(row("II4090")).toBe("II4090Kerja PraktikDirencanakan2");
  });

  it("opens a course's syllabus on SIX's public pages", async () => {
    const s = await openPlan();
    await tab("Kurikulum");
    await s.click("Silabus MA1101 di SIX");
    expect(s.calls.at(-1)).toEqual({ name: "shell.openExternal", input: { url: "https://six.itb.ac.id/pub/matakuliah/47455" } });
  });

  it("specializations and minors with progress, the registered one first", async () => {
    const s = await openPlan();
    await tab("Kurikulum");
    expect(s.text()).toContain("SpesialisasiSistem Informasi CerdasTerdaftar6/12 SKS");
    expect(s.text()).toContain("Keamanan dan Privasi Siber0/12 SKS");
    expect(s.text()).toContain("MinorBranding Berbasis DigitalDesain Komunikasi Visual3/12 SKS");
  });
});
