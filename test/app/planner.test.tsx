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

/** `emptyTerm`: SIX already on this term, its KRS without courses yet (DRS not done). */
async function openPlan(options: { saved?: StudyPlan; lang?: "en"; noRecords?: boolean; emptyTerm?: boolean } = {}) {
  screen = await openApp({ world: new PretendWorld({ now: "2026-10-11T09:00:00+07:00" }), signedIn: true });
  if (options.lang) await screen.engineDoes(() => screen!.engine.updateSettings({ lang: options.lang }));
  if (!options.noRecords) {
    const data = await records();
    if (options.emptyTerm) {
      data.transcript.terms = data.transcript.terms.filter((t) => t.term !== "2026-1");
      await inject("six.student", { nim: "18223901", name: "Mahasiswa Contoh", studentId: "2021000001", term: "2026-1", program: null, programCode: null });
      await inject("six.courses", []);
    }
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
/** The whole rules card, its hidden list included. */
const rulesCard = () => document.querySelector("ul[aria-label='Aturan, dicek langsung']")?.parentElement?.textContent ?? "";
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
    // Semesters 1–6 fold under one line, and open into the panel the button names.
    const past = s.button(/^Semester 1–6/);
    expect(past.getAttribute("aria-expanded")).toBe("false");
    await s.click(past);
    expect(past.getAttribute("aria-expanded")).toBe("true");
    expect(document.getElementById(past.getAttribute("aria-controls")!)?.textContent).toContain("Semester 6 · 2025/2026 GenapIP 3,27 · 22 SKS");
    expect(block(/^Semester 7 · sekarang/)?.textContent).toContain("14 SKSIP 3,50IPK jadi 3,29");
    const next = block(/^Semester 8 · 2026\/2027 Genap/)!;
    expect(next.textContent).toContain("12 / 24 SKSIP 3,50IPK jadi 3,30");
    expect([...next.querySelectorAll("li")].map((li) => li.textContent?.replace(/AABBBCCDE$/, ""))).toEqual([
      // The Kerja Praktik risk sits on its own row, not only in the rules.
      "II4090Kerja PraktikBiasanya di semester ganjilWajib · smt 72",
      "II4092Tugas AkhirWajib · smt 84",
      // Only "Wajib" is tagged: electives and specialization courses are most rows, and the rules count them.
      "II4010Manajemen Data3",
      "II4011Transformasi Digital3",
    ]);
    // A warning that can be hidden says "Sembunyikan" in words, not with a bare crossed-out eye.
    expect(rule("parity")).toEqual([
      "warn: Perlu dicekII4090 Kerja PraktikKurikulum menaruhnya di semester 7 (ganjil). Pastikan dibuka di semester genap, atau rencanakan di semester pendek.Sembunyikan",
    ]);
    expect(rule("total")[0]).toContain("ok: Terpenuhi144 SKS terpenuhi (+7 cadangan)");
    // The 45 required courses less the 3 SIX doesn't ask of this Student: the same count Kurikulum shows.
    expect(rule("required")[0]).toContain("Semua 42 sudah diambil, sedang diambil, atau direncanakan.");
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
    expect(rule("load")).toEqual(["warn: Perlu dicekSemester 8 · 2026/2027 Genap21 SKS: di atas 20 perlu persetujuan dosen wali.Sembunyikan"]);
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
    expect(rule("finish")).toEqual(["warn: Perlu dicekLulus di semester 9Lewat 8 semester; predikat pujian masih mungkin (maks. 9).Sembunyikan"]);
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
    expect(dialog).toContain("Internet of Things3 SKS · Nilaimu: C · IPK 3,26 → 3,31 dengan A");
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

  it("'Plan this minor': its courses and where each stands, what planning it changes, and stopping again", async () => {
    const s = await openPlan();
    await s.click(/^Branding Berbasis Digital/);
    const dialog = () => document.querySelector("[role=dialog]")!.textContent!;
    expect(dialog()).toContain("Minor Branding Berbasis Digital");
    expect(dialog()).toContain("3 dari 12 SKS0 lulus · 3 semester ini · 0 direncanakan");
    expect(dialog()).toContain("DK4073Komunikasi Pemasaran3 SKSSemester ini");
    expect(dialog()).toContain("Daftar minornya tetap di SIX");
    await s.click("Rencanakan minor ini");
    expect(rule("minor")).toEqual(["warn: Perlu dicekMinor Branding Berbasis Digital3 dari 12 SKS dari daftarnya.Sembunyikan"]);
    expect(saved()?.minor).toBe("Desain Komunikasi Visual · Branding Berbasis Digital");
    expect(toastText()).toContain("Minor Branding Berbasis Digital direncanakanUrungkan");
    // A course from the panel goes to the first semester it fits in.
    await s.click("Tambah DK3072 ke Semester 8 · 2026/2027 Genap");
    expect(dialog()).toContain("DK3072Fotografi Fashion dan Produk3 SKSDirencanakan");
    expect(rule("minor")[0]).toContain("6 dari 12 SKS");
    await s.click("Berhenti merencanakan");
    expect(rule("minor")).toEqual([]);
    expect(saved()?.minor).toBeNull();
    await s.click("Urungkan");
    expect(saved()?.minor).toBe("Desain Komunikasi Visual · Branding Berbasis Digital");
    await s.key("Escape");
    // The card says it's planned; the Add dialog offers its courses.
    expect(s.button(/^Branding Berbasis Digital/).textContent).toContain("Direncanakan");
    await s.click(addIn(/^Semester 8/));
    expect(document.querySelector("[role=dialog]")!.textContent).toContain("Minor Branding Berbasis Digital");
  });

  it("this semester takes what-ifs: leave a KRS course out, try one in; only in the plan, and Nilai keeps SIX's KRS", async () => {
    const s = await openPlan();
    const now = () => block(/^Semester 7 · sekarang/)!;
    expect(now().textContent).toContain("Berlangsung · nilai perkiraanmu");
    await s.click("Coba tanpa PL3032");
    expect(now().textContent).toContain("Hanya di rencanamu · KRS-mu di SIX tidak berubah");
    expect(now().textContent).toContain("PL3032Ekonomi Infrastruktur dan TransportasiTidak diambil di rencana3Kembalikan");
    expect(now().textContent).toContain("11 / 24 SKS");
    expect(summary()).toContain("125 lulus11 semester ini12 direncanakan");
    expect(toastText()).toContain("PL3032 tidak diambil di rencanamuUrungkan");
    expect(saved()?.now).toEqual({ term: "2026-1", added: [], dropped: ["PL3032"] });

    // Kerja Praktik tried this semester: it moves out of semester 8, and its odd/even warning goes.
    await s.click("Coba tambah mata kuliah");
    expect(document.querySelector("[role=dialog]")!.textContent).toContain("Coba tambah ke Semester 7 · sekarang");
    await s.click("Tambah II4090");
    expect(now().textContent).toContain("II4090Kerja PraktikHanya di rencana2");
    expect(block(/^Semester 8/)!.textContent).not.toContain("II4090");
    expect(rule("parity")).toEqual([]);
    expect(saved()?.now?.added.map((c) => c.code)).toEqual(["II4090"]);

    // Nilai keeps to SIX's KRS, and says why its numbers differ.
    await s.click("Nilai");
    expect(s.text()).toContain("PL3032");
    expect(s.text()).toContain("Dengan KRS-mu di SIX, tanpa perubahan semester ini yang hanya ada di rencanamu.");
    // Kerja Praktik still counts in semester 8 there (it isn't in SIX's KRS): the same 26 SKS left as before any what-if.
    expect(s.text()).toContain("jika semua A di 26 SKS tersisa");
    await s.click("Rencana studi");

    // A reset would end them, and says so (Kerja Praktik isn't counted as removed from semester 8 too).
    await s.click("Atur ulang rencana");
    expect(document.querySelector("[role=alertdialog]")!.textContent).toContain("Semua perubahanmu hilang: 2 perubahan di semester ini.");
    await s.click("Batal");

    // Taking the what-ifs back: Kerja Praktik returns to semester 8.
    await s.click("Hapus II4090");
    expect(block(/^Semester 8/)!.textContent).toContain("II4090");
    await s.click("Kembalikan PL3032");
    expect(now().textContent).toContain("14 SKS");
    expect(now().textContent).toContain("Berlangsung · nilai perkiraanmu");
  });

  it("hides a warning with a reason: the summary, the row and the rules agree; shown again from the quiet list", async () => {
    const s = await openPlan();
    expect(summary()).toContain("1 hal perlu dicek");
    await s.click("Sembunyikan peringatan: II4090 Kerja Praktik");
    await s.click(/^Prodiku akan menambahkannya/);
    expect(rule("parity")).toEqual([]);
    expect(summary()).toContain("LulusSemester 8Tepat waktu");
    expect(block(/^Semester 8/)!.textContent).not.toContain("Biasanya di semester ganjil");
    expect(toastText()).toContain("Disembunyikan: II4090 Kerja PraktikUrungkan");
    expect(saved()?.hidden).toMatchObject({ "parity|II4090": { reason: "program-adds" } });
    // Errors decide graduating: they can't be hidden.
    await s.click("Hapus II4092");
    expect(s.has(/^Sembunyikan peringatan: Mata kuliah wajib/)).toBe(false);
    await s.click("Urungkan");

    // Kept through "Reset plan".
    await s.click("Hapus II4010");
    await s.click("Atur ulang rencana");
    await s.click("Atur ulang");
    expect(saved()?.hidden).toMatchObject({ "parity|II4090": { reason: "program-adds" } });

    await s.click("Disembunyikan (1) · Tampilkan");
    expect(rulesCard()).toContain("II4090 Kerja PraktikProdi akan menambahkannya");
    await s.click("Tampilkan lagi: II4090 Kerja Praktik");
    expect(rule("parity")[0]).toContain("warn: Perlu dicekII4090 Kerja Praktik");
    expect(summary()).toContain("1 hal perlu dicek");
  });

  it("not continuing the registered specialization: hidden, its courses no longer offered, and a reset leaves them out", async () => {
    const s = await openPlan();
    await s.click("Hapus II4011");
    await s.click("Sembunyikan peringatan: Sistem Informasi Cerdas");
    await s.click(/^Aku tidak melanjutkan spesialisasi ini/);
    expect(rule("specialization")).toEqual([]);
    // II4010 stays planned, untagged; it's no longer asked for as the specialization's.
    expect(block(/^Semester 8/)!.textContent).toContain("II4010Manajemen Data3");
    await s.click(addIn(/^Semester 8/));
    expect(document.querySelector("[role=dialog]")!.textContent).not.toContain("Menuntaskan Sistem Informasi Cerdas");
    // Planned anyway: the warning goes, the choice stays, and can still be taken back.
    await search("II4011");
    await s.click("Tambah II4011");
    expect(rule("specialization")[0]).toContain("ok: Terpenuhi");
    await s.click("Disembunyikan (1) · Tampilkan");
    expect(rulesCard()).toContain("Sistem Informasi CerdasTidak dilanjutkan");
    await s.click("Hapus II4011");
    await s.click("Atur ulang rencana");
    await s.click("Atur ulang");
    expect(saved()?.terms[0].courses.map((c) => c.code)).toEqual(["II4090", "II4092"]);
    await tab("Kurikulum");
    expect(s.text()).toContain("Sistem Informasi CerdasTerdaftar · tidak dilanjutkan");
    // Said under the name, not as a tag beside the SKS that squeezed the name to a few letters per line.
    const card = [...document.querySelectorAll("aside p")].find((p) => p.textContent?.startsWith("Sistem Informasi Cerdas"))!;
    expect([...card.children].map((c) => c.textContent)).toEqual(["Sistem Informasi CerdasTerdaftar · tidak dilanjutkan", "6 dari 12 SKS"]);
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

  it("a course left out stays where it was in the KRS, crossed out, in the same columns", async () => {
    const s = await openPlan();
    const rows = () => [...block(/^Semester 7 · sekarang/)!.querySelectorAll("li")];
    const first = rows()[0].textContent;
    expect(first).toMatch(/^DK4073/);
    await s.click("Coba tanpa DK4073");
    expect(rows()[0].textContent).toBe("DK4073Komunikasi PemasaranTidak diambil di rencana3Kembalikan");
    expect(rows()[0].className).toBe(rows()[1].className.replace(" text-body", " text-body text-muted"));
  });

  it("this semester's block is there while its KRS is still empty: a course can be tried, and its SKS count", async () => {
    const s = await openPlan({ emptyTerm: true });
    const now = () => block(/^Semester 7 · sekarang/)!;
    expect(now().textContent).toContain("KRS-mu di SIX belum berisi mata kuliah.");
    await s.click("Coba tambah mata kuliah");
    await search("II4021");
    await s.click("Tambah II4021");
    expect(now().textContent).toContain("II4021");
    expect(now().textContent).toContain("Hanya di rencanamu · KRS-mu di SIX tidak berubah");
    expect(now().textContent).toContain("3 / 24 SKS");
    expect(summary()).toContain("3 semester ini");
  });

  it("removing the semester a course tried now was planned in: the toast counts what goes, and the course isn't lost (bug)", async () => {
    const s = await openPlan();
    await s.click("Coba tambah mata kuliah");
    await s.click("Tambah II4010");
    await s.click("Hapus Semester 8 · 2026/2027 Genap");
    expect(toastText()).toContain("Semester 8 · 2026/2027 Genap dihapus (3 mata kuliah)");
    await s.click("Hapus II4010");
    expect(block(/^Semester 8 · 2026\/2027 Genap/)!.textContent).toContain("II4010Manajemen Data");
    expect(saved()?.terms.map((t) => [t.term, t.courses.map((c) => c.code)])).toEqual([["2026-2", ["II4010"]]]);
  });

  it("removing a semester counts only the courses it shows, not copies of ones taken already (bug)", async () => {
    const planned = (code: string, name: string, sks: number) => ({ code, name, sks, grade: "AB" as const, retake: false });
    // PL3032 is in this semester's KRS and II2100 is passed: both copies are hidden.
    const s = await openPlan({
      saved: {
        terms: [
          {
            term: "2026-2",
            courses: [planned("II4092", "Tugas Akhir", 4), planned("PL3032", "Mata Kuliah Contoh", 3), planned("II2100", "Mata Kuliah Lulus", 3)],
          },
        ],
        expected: {},
        target: null,
        minor: null,
      },
    });
    expect(block(/^Semester 8 · 2026\/2027 Genap/)!.querySelectorAll("li")).toHaveLength(1);
    await s.click("Hapus Semester 8 · 2026/2027 Genap");
    expect(toastText()).toContain("Semester 8 · 2026/2027 Genap dihapus (1 mata kuliah)");
  });

  it("in English", async () => {
    const s = await openPlan({ lang: "en" });
    expect(summary()).toContain("144 SKS covered+7 to spare");
    expect(summary()).toContain("125 passed14 this semester12 planned");
    expect(s.text()).toContain("Semester 8 · 2026/2027 Even");
    expect(rulesText()).toContain("Check it also runs in the even semester");
    expect(rulesText()).toContain("27 of 27 SKS covered (+10 more).");
    expect(s.has("Hide the warning: II4090 Kerja Praktik")).toBe(true);
    await s.click("Try without PL3032");
    expect(block(/^Semester 7 · now/)!.textContent).toContain("Only in your plan · your KRS on SIX doesn't change");
    expect(s.has("Put PL3032 back")).toBe(true);
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
    // Three side by side are narrow: a hint wraps between its facts, never between "6" and "direncanakan".
    const facts = (label: string) =>
      [...([...document.querySelectorAll("main dt")].find((dt) => dt.textContent === label)?.parentElement?.querySelectorAll("[data-fact]") ?? [])].map(
        (fact) => fact.textContent?.replace(" · ", "").trim(),
      );
    expect(facts("Total kurikulum")).toEqual(["wajib 117", "pilihan 27"]);
    expect(facts("Pilihan")).toEqual(["19 lulus", "12 semester ini", "6 direncanakan"]);
  });

  it("opens on everything; 'What's left only' hides what's done and keeps a summary in view", async () => {
    const s = await openPlan();
    await tab("Kurikulum");
    expect(s.text()).toContain("Sisa: 2 wajib (6 SKS) · pilihan terpenuhi");
    expect(row("MA1101")).toBe("MA1101Matematika ILulus AB4");
    expect(row("KI1101")).toBe("KI1101Kimia Dasar Ilewat KI1002 Kimia Dasar BLulus A3");
    expect(row("WI2003")).toBe("WI2003Olah Ragalewat KU1001 Olah RagaLulus BC1");
    expect(row("II4091")).toBe("II4091Proposal Tugas AkhirSemester ini2");
    expect(row("II4090")).toBe("II4090Kerja PraktikDirencanakan2");
    expect(s.text()).toContain("Mata kuliah lain yang ikut dihitung");
    await s.click("Sisa saja");
    expect(row("MA1101")).toBeUndefined();
    expect(row("II4090")).toBe("II4090Kerja PraktikDirencanakan2");
  });

  it("Tata Tulis Karya Ilmiah counts as Bahasa Indonesia; courses SIX doesn't ask of the Student are said quietly, not counted as left", async () => {
    const s = await openPlan();
    await tab("Kurikulum");
    expect(row("WI2005")).toBe("WI2005Bahasa Indonesialewat KU1011 Tata Tulis Karya IlmiahLulus AB2");
    expect(row("KU1011")).toBeUndefined();
    expect(row("WI1111")).toBe("WI1111Laboratorium Fisika DasarTidak ada di catatan SIX-mu1");
    expect(s.text()).toContain(
      "Kamu mulai dengan Kurikulum 2019; SIX menaruh mata kuliahmu di Kurikulum 2024. 3 mata kuliah tidak ada di catatan SIX-mu, jadi tidak dihitung sebagai sisa.",
    );
    // Never "check with your program", and never counted as left: the planner's "All 42" and this tab agree.
    expect(s.text()).not.toMatch(/cek ke prodi|perlu dicek ke prodi/);
    await s.click("Sisa saja");
    expect(row("WI1111")).toBeUndefined();
  });

  it("corrects a course from its ⋯ menu: marked, saved apart from the plan, undoable, and the rules agree", async () => {
    const s = await openPlan();
    const fixes = () => s.store.dataset("local.curriculum")?.value as { slots: Record<string, { kind: string; code?: string }> } | undefined;
    await tab("Kurikulum");

    await s.click("Koreksi WI1111");
    await s.click(/^Tidak ada di kurikulumku/);
    expect(row("WI1111")).toBe("WI1111Laboratorium Fisika DasarDikoreksi olehmuTidak ada di kurikulummu1");
    expect(fixes()?.slots.WI1111).toMatchObject({ kind: "not-mine" });
    expect(toastText()).toContain("WI1111 ditandai tidak ada di kurikulummuUrungkan");
    await s.click("Urungkan");
    expect(fixes()?.slots).toEqual({});
    expect(row("WI1111")).toBe("WI1111Laboratorium Fisika DasarTidak ada di catatan SIX-mu1");

    // "Counted as…": SIX's own suggestion first, then any passed course.
    await s.click("Koreksi WI1111");
    await s.click(/^Dihitung sebagai…/);
    const dialog = document.querySelector("[role=dialog]")!.textContent!;
    expect(dialog).toContain("Yang dihitung sebagai WI1111 Laboratorium Fisika Dasar");
    expect(dialog).toMatch(/SIX menaruhnya di semester 1II1101Komputasi dan MasyarakatA · 2 SKS/);
    await s.click(/^FI1201Fisika Dasar IIA/);
    expect(row("WI1111")).toBe("WI1111Laboratorium Fisika Dasarlewat FI1201 Fisika Dasar IIA · Dikoreksi olehmuLulus BC1");
    expect(row("FI1201")).toBeUndefined();
    expect(toastText()).toContain("FI1201 sekarang dihitung sebagai WI1111");

    // A correction to a course SIX still lists as to take: the planner says so, and doesn't ask for it.
    await s.click("Koreksi II4090");
    await s.click(/^Sudah selesai/);
    expect(row("II4090")).toBe("II4090Kerja PraktikDikoreksi olehmu · SIX masih mencatatnya belum diambilSudah selesai2");
    await tab("Rencana");
    expect(rule("required")[0]).toContain("Kamu mengoreksi II4090 Kerja Praktik; SIX masih mencatatnya belum diambil.");
    expect(rule("parity")).toEqual([]);

    // "Reset plan" leaves corrections alone; "Restore" takes one back.
    await s.click("Hapus II4010");
    await s.click("Atur ulang rencana");
    await s.click("Atur ulang");
    expect(fixes()?.slots.II4090).toMatchObject({ kind: "done" });
    await tab("Kurikulum");
    await s.click("Koreksi II4090");
    await s.click(/^Kembalikan/);
    expect(fixes()?.slots.II4090).toBeUndefined();
    // Left again, and not in the plan that was reset while it was marked done: the rules will say so.
    expect(row("II4090")).toBe("II4090Kerja PraktikBelum diambil2");
    expect(toastText()).toContain("Koreksi II4090 dihapus");
  });

  it("this semester's what-ifs count here too, each marked as only in the plan, never as if SIX had it", async () => {
    const s = await openPlan();
    await s.click("Coba tambah mata kuliah");
    await s.click("Tambah II4090");
    await s.click("Coba tanpa II4091");
    await tab("Kurikulum");
    expect(s.text()).toContain("Termasuk perubahan semester ini yang hanya ada di rencanamu.");
    expect(row("II4090")).toBe("II4090Kerja PraktikHanya di rencana2");
    expect(row("II4091")).toBe("II4091Proposal Tugas AkhirTidak diambil di rencana2");
    expect(s.text()).not.toContain("Semester ini2");
  });

  it("corrections are kept on this computer: there again after a restart", async () => {
    const s = await openPlan();
    await s.engineDoes(() => s.engine.setLocal("local.curriculum", { slots: { WI2002: { kind: "counted-as", code: "KU1102", at: 1 } } }));
    await tab("Kurikulum");
    expect(row("WI2002")).toBe("WI2002Literasi Data dan Inteligensi Artifisiallewat KU1102 Pengenalan Komputasi · Dikoreksi olehmuLulus AB2");
  });

  it("opens a course's syllabus on SIX's public pages", async () => {
    const s = await openPlan();
    await tab("Kurikulum");
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

describe("the keyboard: focus stays where the Student is", () => {
  const tick = () => act(() => new Promise<void>((resolve) => setTimeout(resolve, 10)));
  const focused = () => document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.textContent ?? document.activeElement?.tagName;
  const press = async (name: string | RegExp) => {
    const button = screen!.button(name);
    button.focus();
    await screen!.click(button);
    await tick();
  };
  /** Opens a menu from the keyboard and picks an item, as Enter on the focused item does. */
  async function choose(menu: string, item: RegExp) {
    const trigger = screen!.button(menu);
    trigger.focus();
    await screen!.click(trigger);
    const option = screen!.button(item);
    option.focus();
    await screen!.click(option);
    await tick();
  }

  it("'Counted as…' gives focus back to the row's ⋯, closed or used", async () => {
    const s = await openPlan();
    await tab("Kurikulum");
    await choose("Koreksi WI1111", /^Dihitung sebagai…/);
    expect(document.querySelector("[role=dialog]")).not.toBeNull();
    await s.key("Escape");
    await tick();
    expect(focused()).toBe("Koreksi WI1111");
    await choose("Koreksi WI1111", /^Dihitung sebagai…/);
    // Read as what it is, not as codes only.
    expect(s.button(/^FI1201/).textContent).toContain("Fisika Dasar IIA");
    await s.click(/^FI1201/);
    await tick();
    expect(focused()).toBe("Koreksi WI1111");
  });

  it("with 'What's left only' on, a corrected row goes and focus moves to the next row's ⋯, then to the switch", async () => {
    const s = await openPlan();
    await tab("Kurikulum");
    await s.click("Sisa saja");
    const menus = () => [...document.querySelectorAll("main [aria-haspopup=menu]")].map((el) => el.getAttribute("aria-label"));
    expect(menus()).toEqual(["Koreksi II4091", "Koreksi II4090", "Koreksi II4092"]);
    await choose("Koreksi II4090", /^Sudah selesai/);
    await tick();
    expect(menus()).toEqual(["Koreksi II4091", "Koreksi II4092"]);
    expect(focused()).toBe("Koreksi II4092");
    await choose("Koreksi II4092", /^Tidak ada di kurikulumku/);
    await tick();
    expect(focused()).toBe("Sisa saja");
  });

  it("'Try without', 'Put back' and removing a tried course: focus moves to what took the control's place", async () => {
    const s = await openPlan();
    await press("Coba tanpa PL3032");
    expect(focused()).toBe("Kembalikan PL3032");
    await press("Kembalikan PL3032");
    expect(focused()).toBe("Coba tanpa PL3032");
    await s.click("Coba tambah mata kuliah");
    await s.click("Tambah II4090");
    await press("Hapus II4090");
    expect(focused()).toBe("Coba tambah mata kuliah");
  });

  it("hiding a warning moves focus to the hidden list; showing it again, back to the warning", async () => {
    const s = await openPlan();
    await choose("Sembunyikan peringatan: II4090 Kerja Praktik", /^Prodiku akan menambahkannya/);
    expect(focused()).toBe("Disembunyikan (1) · Tampilkan");
    await s.click("Disembunyikan (1) · Tampilkan");
    await press("Tampilkan lagi: II4090 Kerja Praktik");
    expect(focused()).toBe("Sembunyikan peringatan: II4090 Kerja Praktik");
  });

  it("adding a minor's course from its panel moves focus to the next course to add", async () => {
    const s = await openPlan();
    await s.click(/^Branding Berbasis Digital/);
    const adds = () =>
      [...document.querySelectorAll("[role=dialog] button")].map((b) => b.getAttribute("aria-label") ?? "").filter((l) => l.startsWith("Tambah"));
    const [first, second] = adds();
    await press(first);
    expect(focused()).toBe(second);
    for (const label of adds()) await press(label);
    expect(focused()).toBe("Rencanakan minor ini");
  });
});
