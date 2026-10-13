// @vitest-environment jsdom
// v2-06 (#74), seam 2: the course page as the Student sees it, with the real
// engine and the pretend Edunex behind the bridge.
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import type { ClassSession, Task } from "../../src/core/models";
import { aTask } from "../kit/tasks";
import { PretendWorld } from "../pretend/world";
import { openApp } from "./harness";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

const BLOB = "https://edunexfixture.blob.core.windows.net/edunex/fixture-1";

/** Opens a course from its card on Home. */
async function openCourse(code: string, options: Parameters<typeof openApp>[0] = {}) {
  screen = await openApp({ signedIn: true, ...options });
  const card = [...document.querySelectorAll<HTMLButtonElement>("main ul li button")].find((b) => b.textContent?.startsWith(code));
  await screen.click(card!);
  return screen;
}

/** Radix tabs switch on mouse down, as a real click starts. */
async function tab(name: RegExp) {
  const trigger = [...document.querySelectorAll<HTMLElement>("[role=tab]")].find((el) => name.test(el.textContent ?? ""));
  if (!trigger) throw new Error(`No tab ${String(name)}`);
  await act(async () => {
    trigger.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
  });
}

/** The table-of-contents entry with this title. */
async function entry(title: string) {
  const nav = document.querySelector("nav[aria-label='Daftar isi'], nav[aria-label='Table of contents']")!;
  const button = [...nav.querySelectorAll("button")].find((b) => b.textContent?.includes(title));
  if (!button) throw new Error(`No entry ${title} in ${nav.textContent}`);
  await screen!.click(button);
}

/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- a dataset as the engine holds it */
const data = (name: string): any => screen!.engine.snapshot().datasets.find((d) => d.name === name)?.value;

/** Types into the input with this name, as the Student does. */
async function type(label: string, text: string) {
  const input = document.querySelector<HTMLInputElement>(`input[aria-label='${label}']`);
  if (!input) throw new Error(`No input ${label}`);
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, text);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

const rows = (selector = "main li") => [...document.querySelectorAll(selector)].map((el) => el.textContent ?? "");

describe("the course page", () => {
  it("opens from Home with the course's code, class, SKS and lecturer, parent class merged", async () => {
    const s = await openCourse("II4091");
    expect(document.querySelector("h1")?.textContent).toBe("Final Project Proposal");
    expect(s.text()).toContain("Kelas 01");
    expect(s.text()).toContain("2 SKS");
    expect(s.text()).toContain("Dr. Hadi Halim, S.T., M.T.");
    expect(s.text()).not.toContain("[Parent Class]");
    // The class's modules, then its parent class's.
    const toc = document.querySelector("nav[aria-label='Daftar isi']")!.textContent!;
    expect(toc).toContain("List Penawaran Topik TA");
    expect(toc).toContain("Kelas gabungan");
    expect(toc.indexOf("Tugas")).toBeLessThan(toc.indexOf("Penawaran Topik TA Dosen"));
    expect(toc).not.toContain("Module 06");
  });

  it("Open in Edunex stays on Home's cards", async () => {
    screen = await openApp({ signedIn: true });
    await screen.click("Buka di Edunex: PL3002");
    expect(screen.calls.at(-1)).toEqual({ name: "shell.openExternal", input: { url: "https://edunex.itb.ac.id/courses/95001" } });
  });

  it("an empty course says so", async () => {
    // KU5014 has no materials; take its two Tasks away too.
    const world = new PretendWorld();
    world.edunex.tasks.set(92948, []);
    const s = await openCourse("KU5014", { world });
    expect(s.text()).toContain("Belum ada materi di Edunex");
  });
});

describe("materials", () => {
  it("a PDF downloads through the browser's download manager", async () => {
    const s = await openCourse("PL3032");
    expect(s.text()).toContain("PDF · 1,9 MB");
    await s.click("Unduh: K1. SAP Ekonomi Infrastruktur dan Transportasi");
    expect(s.calls.at(-1)).toEqual({ name: "files.download", input: { url: BLOB, name: "K1. SAP Ekonomi Infrastruktur dan Transportasi.pdf" } });
    expect(s.text()).toContain("Tersimpan di Unduhan");
  });

  it("the parent class's online-class link opens in the browser, and a text note reads safely in the app", async () => {
    const s = await openCourse("II4091");
    await entry("Pengantar");
    expect(s.text()).toContain("Kelas online · Microsoft Teams");
    await s.click("Gabung: Link Teams Pertemuan 03: Jumat, 9 Oktober 2026");
    expect(s.calls.at(-1)).toEqual({ name: "shell.openExternal", input: { url: "https://teams.microsoft.com/meet/000000000000?p=fixture" } });
    await s.click("Baca: Jadwal Kuliah TA & Mekanisme Pelaksanaan");
    expect(s.button("Tutup: Jadwal Kuliah TA & Mekanisme Pelaksanaan").getAttribute("aria-expanded")).toBe("true");
    expect(document.querySelector("main strong")?.textContent).toBe("Pertemuan 02:");
    // Edunex's inline styles never reach the page.
    expect(document.querySelector("main strong")!.closest("li")!.querySelector("[style]")).toBeNull();
    // A note that is only a picture opens on Edunex instead.
    expect(s.has("Buka di Edunex: Course Tokens : FIXTUR")).toBe(true);
  });

  it("each material type gets its own action; unknown types open in Edunex", async () => {
    screen = await openApp({ signedIn: true });
    const e = screen.world.edunex;
    e.postMaterial(95001, { name: "Rekaman kuliah", type: "video", content: BLOB });
    e.postMaterial(95001, { name: "Podcast", type: "audio", content: BLOB });
    e.postMaterial(95001, { name: "Data", type: "file", content: `${BLOB}.xlsx` });
    e.postMaterial(95001, { name: "Berita ITB", type: "url", content: "https://www.itb.ac.id/berita" });
    e.postMaterial(95001, { name: "Situs luar", type: "url", content: "https://example.org/" });
    e.postMaterial(95001, { name: "Kuis interaktif", type: "h5p", content: "https://example.org/h5p" });
    e.postMaterial(95001, { name: "Zoom", type: "zoom", content: "https://itb.zoom.us/j/123" });
    e.postMaterial(95001, { name: "Meet", type: "google-meet", content: "https://meet.google.com/abc-defg-hij" });
    e.postMaterial(95001, { name: "Webex", type: "webex", content: "https://itb.webex.com/meet/abc" });
    e.postMaterial(95001, { name: "CloudX", type: "cloudx", content: "https://cloudx.example/room" });
    e.postMaterial(95001, { name: "Baru", type: "quiz-of-the-future", content: BLOB });
    await screen.engineDoes(() => screen!.engine.refresh("edunex"));
    const card = [...document.querySelectorAll<HTMLButtonElement>("main ul li button")].find((b) => b.textContent?.startsWith("PL3002"));
    await screen.click(card!);
    await entry("Pengantar");
    for (const name of ["Unduh: Rekaman kuliah", "Unduh: Podcast", "Unduh: Data", "Buka: Berita ITB", "Gabung: Zoom", "Gabung: Meet", "Gabung: Webex"]) expect(screen.has(name)).toBe(true);
    for (const name of ["Situs luar", "Kuis interaktif", "CloudX", "Baru"]) expect(screen.has(`Buka di Edunex: ${name}`)).toBe(true);
    expect(screen.text()).toContain("Kelas online · Google Meet");
    // Every action looks alike and takes the same width, so the dates beside them line up.
    const actions = [...document.querySelectorAll<HTMLButtonElement>("main section li button[aria-label]")].filter((b) => /^(Unduh|Buka|Gabung|Baca)/.test(b.getAttribute("aria-label")!));
    expect(actions.length).toBeGreaterThan(8);
    expect(new Set(actions.map((b) => b.className)).size).toBe(1);
    expect(new Set(actions.map((b) => b.parentElement!.className)).size).toBe(1);
    await screen.click("Unduh: Data");
    expect(screen.calls.at(-1)).toMatchObject({ name: "files.download", input: { name: "Data.xlsx" } });
    await screen.click("Buka di Edunex: Baru");
    expect(screen.calls.at(-1)).toEqual({ name: "shell.openExternal", input: { url: "https://edunex.itb.ac.id/courses/95001" } });
  });

  it("a material the lecturer adds appears, and goes when removed", async () => {
    const s = await openCourse("PL3032");
    const id = s.world.edunex.postMaterial(95059, { name: "K2. Slide baru", type: "pdf", content: BLOB });
    await s.wait(61 * 60_000);
    expect(s.text()).toContain("K2. Slide baru");
    s.world.edunex.deleteMaterial(id);
    await s.engineDoes(() => s.engine.refresh("edunex"));
    expect(s.text()).not.toContain("K2. Slide baru");
  });

  it("saves the course's files for offline reading only when asked", async () => {
    const s = await openCourse("PL3032");
    expect(s.calls.some((c) => c.name === "course.saveOffline")).toBe(false);
    // A rare action: in the "⋯" menu, saying what it will save before you click.
    await s.click("Lainnya");
    expect(s.button(/^Simpan untuk offline/).textContent).toMatch(/^Simpan untuk offline1 berkas/);
    await s.click(/^Simpan untuk offline/);
    expect(s.calls.at(-1)).toEqual({ name: "course.saveOffline", input: { code: "PL3032", pick: false } });
    expect(s.text()).toContain("1 berkas baru tersimpan, 0 sudah ada");
    await s.click("Lainnya");
    await s.click("Simpan ke folder lain…");
    expect(s.calls.at(-1)).toEqual({ name: "course.saveOffline", input: { code: "PL3032", pick: true } });
  });
});

describe("Tasks in modules", () => {
  it("shows a module's Tasks and opens one", async () => {
    const s = await openCourse("PL3002");
    const module = data("edunex.outline").PL3002.modules[3];
    const task: Task = aTask({ id: 117500, courseCode: "PL3002", courseId: 95001, moduleId: module.id, title: "Tugas Mandiri Inovasi", status: "not_started", dueAt: Date.parse("2026-10-20T23:59:00+07:00") });
    await s.apply({ type: "dataset", dataset: { name: "edunex.tasks", value: [task], fetchedAt: 0, hash: "t1" } });
    // The module with an open Task says so in words in the table of contents.
    const toc = document.querySelector("nav[aria-label='Daftar isi']")!;
    const tocEntry = () => [...toc.querySelectorAll("button")].find((b) => b.textContent?.includes(module.title))?.textContent;
    expect(tocEntry()).toContain("1 tugas");
    expect(tocEntry()).toContain("1 terbuka");
    // With one handed in beside it, the count is all of them and the chip only the open one: never "1 tugas" next to "1 tugas".
    const handedIn: Task = aTask({ id: 117501, courseCode: "PL3002", courseId: 95001, moduleId: module.id, title: "Tugas Lama", status: "submitted", dueAt: Date.parse("2026-09-20T23:59:00+07:00") });
    await s.apply({ type: "dataset", dataset: { name: "edunex.tasks", value: [task, handedIn], fetchedAt: 0, hash: "t2" } });
    expect(tocEntry()).toContain("2 tugas");
    expect(tocEntry()).toContain("1 terbuka");
    await entry(module.title);
    expect(s.text()).toContain("Tugas Mandiri Inovasi");
    expect(s.text()).toContain("Belum dikerjakan");
    await s.click(/^Tugas Mandiri Inovasi/);
    expect(document.querySelector("h1")?.textContent).toContain("Tugas Mandiri Inovasi");
  });
});

describe("meetings", () => {
  it("every Presence session of the class, across pages, never labelled absent", async () => {
    const s = await openCourse("PL3002", { six: true });
    await tab(/^Pertemuan/);
    const meetings = rows("main ol li");
    expect(meetings).toHaveLength(15);
    expect(meetings[0]).toContain("Hadir");
    // SIX is the official record; the intro says once that Edunex's gaps can still count, and the rows stay quiet.
    expect(s.text()).toContain("Kehadiran resmi di SIX: hadir 6 dari 7");
    expect(s.text()).toContain("yang tidak dicatat Edunex tetap bisa terhitung di SIX");
    expect(meetings[1]).toMatch(/Selesai$/);
    expect(s.text()).not.toContain("Tidak tercatat di Edunex");
    expect(meetings.find((m) => m.includes("Berikutnya"))).toContain("15 Okt");
    expect(meetings.at(-1)).not.toMatch(/Akan datang|Tidak/);
    expect(s.text()).not.toMatch(/Absen|Tidak hadir|Absent/);
  });

  it("where SIX counts, the open window's row is no louder than the strip that calls it optional", async () => {
    await openCourse("PL3002", { six: true });
    await tab(/^Pertemuan/);
    const open = [...document.querySelectorAll("main ol li")].find((li) => li.textContent?.includes("Presensi dibuka"))!;
    const chip = [...open.querySelectorAll("span")].find((el) => el.textContent?.startsWith("Presensi dibuka"))!;
    expect(chip.className).not.toContain("warning");
    expect([...open.querySelectorAll("button")].find((b) => b.textContent === "Catat di Edunex")!.className).not.toContain("bg-accent ");
  });

  it("without SIX, the open window is worth recording just in case, said calmly", async () => {
    const s = await openCourse("PL3002");
    expect(s.text()).toContain("Tanpa SIX, belum pasti Presensi ini dihitung: catat saja untuk berjaga-jaga.");
    const buttons = [...document.querySelectorAll("main button")].filter((b) => b.textContent === "Catat di Edunex");
    expect(buttons.length).toBeGreaterThan(0);
    expect(buttons.every((b) => !b.className.includes("bg-accent "))).toBe(true);
  });

  it("pins the meeting going on now with its open Presence window and the button to act on Edunex", async () => {
    const s = await openCourse("PL3002", { six: true });
    expect(s.text()).toContain("Sedang berlangsung");
    expect(s.text()).toContain("Presensi Edunex dibuka");
    expect(s.text()).toMatch(/tutup 09:30 \(1 jam 1\d mnt lagi\)/);
    // PL3002 counts in SIX: recording on Edunex is offered, but quietly, and the page says why.
    expect(s.text()).toContain("Kehadiranmu dihitung di SIX; Presensi Edunex juga dibuka.");
    // The meeting is named as on the Pertemuan tab: by the module posted for it, not "Kuliah".
    expect(s.text()).toContain("Modul 7 · Inovasi Pelayanan Publik");
    const record = [...document.querySelectorAll("button")].find((b) => b.textContent === "Catat di Edunex")!;
    await s.click(record);
    expect(s.calls.at(-1)).toEqual({ name: "shell.openExternal", input: { url: "https://edunex.itb.ac.id/courses/95001" } });
  });

  it("a course past saving says it once, with what's still possible, the shared minutes of a clash and no second copy of the next meeting", async () => {
    screen = await openApp({ signedIn: true, six: true });
    const s = screen;
    await s.click([...document.querySelectorAll<HTMLButtonElement>("aside button")].find((b) => b.textContent?.startsWith("KU5014"))!);
    expect(document.querySelector("h1")?.textContent).toContain("Teknik Penyelesaian Masalah Terstruktur");
    const text = s.text();
    expect(text).toContain("80% tak terkejar");
    expect(text).toContain("Paling tinggi 73% kalau kamu hadir di semua sisa pertemuan.");
    // Beranda and Jadwal name the overlap (16:00–16:30), not the other class's whole slot.
    expect(text).toContain("Bentrok dengan PL3032 16:00–16:30.");
    expect(text).not.toContain("Bentrok dengan PL3032 15:00–16:30");
    // The next meeting is in the strip under the notice; the notice doesn't repeat it.
    expect(s.text()).not.toContain("Pertemuan berikutnya Hari ini");
  });

  it("without SIX, Edunex's tally is a fact: it doesn't claim to count, nothing is amber, and SIX is a click away", async () => {
    const s = await openCourse("PL3002");
    await tab(/^Pertemuan/);
    expect(s.text()).toContain("Edunex: hadir 1 dari 6 Presensi");
    expect(s.text()).toContain("Hitungan resmi ada di SIX. Hubungkan SIX untuk tahu kehadiran mana yang dihitung.");
    expect(s.text()).not.toContain("dicatat lewat Presensi Edunex");
    const unrecorded = [...document.querySelectorAll("main ol li span")].filter((el) => el.textContent === "Tidak tercatat di Edunex");
    expect(unrecorded.length).toBeGreaterThan(0);
    expect(unrecorded.every((el) => !el.className.includes("warning"))).toBe(true);
    await s.click("Masuk ke SIX");
    await s.wait();
    expect(s.store.status("six").state).toBe("live");
    expect(s.text()).toContain("Kehadiran resmi di SIX: hadir 6 dari 7");
  });

  it("a meeting has one number: Edunex's, never a second count of the app's", async () => {
    await openCourse("II4091");
    await tab(/^Pertemuan/);
    const meetings = rows("main ol li");
    const oct9 = meetings.find((m) => m.includes("9 Okt"))!;
    expect(oct9).toMatch(/^Jum, 9 Okt/);
    expect(oct9).toContain("Pertemuan 3");
    expect(meetings.filter((m) => /Pertemuan \d/.test(m)).every((m) => !/^\d\d/.test(m))).toBe(true);
    // A meeting nothing names is a class, not a number of the app's own.
    expect(meetings.find((m) => m.includes("18 Nov"))).toContain("Kuliah");
  });

  it("a meeting known only as a class takes the module Edunex posted for that week", async () => {
    await openCourse("PL3002", { six: true });
    await tab(/^Pertemuan/);
    const meetings = rows("main ol li");
    expect(meetings.find((m) => m.includes("17 Sep"))).toContain("Modul 4 · Production Process Innovation");
    // Two modules posted the week before 1 Oct: no guess.
    expect(meetings.find((m) => m.includes("1 Okt"))).toContain("Kuliah");
    // Edunex's own name for a meeting stays.
    expect(meetings.find((m) => m.includes("27 Agu"))).toContain("Pendahuluan");
  });

  it("a class without Edunex Presence says so; its meetings come from SIX", async () => {
    const s = await openCourse("KU5014");
    await tab(/^Pertemuan/);
    expect(s.text()).toContain("Kelas ini tidak memakai Presensi Edunex");
    expect(s.text()).toContain("Jadwal pertemuan dan ruangnya datang dari SIX");
    await s.click("Masuk ke SIX");
    await s.wait();
    expect(s.store.status("six").state).toBe("live");
    expect(s.text()).not.toContain("datang dari SIX");
    expect(s.text()).toContain("Kelas ini tidak memakai Presensi Edunex");
  });

  it("SIX gives the room; a meeting announced only in Edunex text is marked not in SIX", async () => {
    const s = await openCourse("II4091");
    const session: ClassSession = {
      id: "s1",
      courseCode: "II4091",
      courseName: "Proposal Tugas Akhir",
      start: Date.parse("2026-10-16T15:00:00+07:00"),
      end: Date.parse("2026-10-16T17:00:00+07:00"),
      activity: "Kuliah",
      room: "Ruang 7602",
    };
    await s.apply({ type: "dataset", dataset: { name: "six.schedule", value: [session], fetchedAt: 0, hash: "six1" } });
    await s.apply({ type: "dataset", dataset: { name: "six.scheduleMonths", value: ["2026-10"], fetchedAt: 0, hash: "six2" } });
    await tab(/^Pertemuan/);
    const meetings = rows("main ol li");
    const oct9 = meetings.find((m) => m.includes("9 Okt"))!;
    expect(oct9).toContain("Tidak ada di SIX");
    expect(oct9).toContain("Online - Link meeting teams");
    const oct16 = meetings.find((m) => m.includes("16 Okt"))!;
    expect(oct16).toContain("Ruang 7602");
    expect(oct16).toContain("15:00–17:00");
    expect(oct16).not.toContain("Tidak ada di SIX");
  });
});

describe("grades", () => {
  it("hides Edunex's placeholder gradebook and works out what's needed on what's left", async () => {
    const s = await openCourse("PL3002");
    await tab(/^Nilai/);
    expect(s.text()).toContain("Buku nilai Edunex belum dirilis dosen");
    expect(s.text()).not.toMatch(/0[.,]0+\s*·?\s*E\b/);
    // Example weights say so, loudly, with the way to the real ones.
    expect(s.text()).toContain("Ini contoh bobot, bukan bobot PL3002.");
    await type("Nilai UTS", "80");
    // UTS 80 secures 24 of the 75 an A needs; the other 70% must average 73. The answer comes as a sentence.
    expect(s.text()).toContain("Untuk A kamu butuh rata-rata 73 di UAS, Tugas, Kuis dan Kehadiran.");
    expect(s.text()).not.toContain("Ini contoh bobot");
    expect(s.calls.at(-1)).toMatchObject({ name: "local.set", input: { name: "local.courseWeights" } });
    expect(data("local.courseWeights").PL3002.parts[0]).toMatchObject({ id: "uts", score: 80 });
  });

  it("never answers when the weights don't add up to 100, and says what to fix", async () => {
    const s = await openCourse("PL3002");
    await tab(/^Nilai/);
    await type("Bobot UTS", "70");
    await type("Bobot Tugas", "75");
    expect(s.text()).toContain("Lengkapi bobot dulu (sekarang 195%). Totalnya harus 100%.");
    expect(s.text()).not.toMatch(/butuh rata-rata|Huruf lain/);
    expect(document.querySelector<HTMLInputElement>("input[aria-label='Bobot UTS']")!.className).toContain("border-warning-fg");
    await type("Bobot UTS", "30");
    await type("Bobot Tugas", "20");
    expect(s.text()).toContain("Untuk A kamu butuh rata-rata");
  });

  it("a score outside 0–100 is explained, not quietly changed", async () => {
    const s = await openCourse("PL3002");
    await tab(/^Nilai/);
    await type("Nilai UTS", "120");
    expect(s.text()).toContain("Isi 0–100");
    expect(document.querySelector<HTMLInputElement>("input[aria-label='Nilai UTS']")!.value).toBe("120");
    // Nothing was saved from it.
    expect(s.calls.some((c) => c.name === "local.set")).toBe(false);
  });

  it("gives no answer while a box holds a number it can't use, and says to fix it", async () => {
    const s = await openCourse("PL3002");
    await tab(/^Nilai/);
    await type("Bobot UTS", "130");
    expect(s.text()).toContain("Isi 0–100");
    expect(s.text()).toContain("Perbaiki angka yang bertanda merah dulu.");
    expect(s.text()).not.toMatch(/butuh rata-rata|Huruf lain/);
    // An emptied weight is a problem too, not a silent "keep the old one".
    await type("Bobot UTS", "");
    expect(s.text()).toContain("Isi angka");
    expect(s.text()).not.toMatch(/butuh rata-rata/);
    await type("Bobot UTS", "30");
    expect(s.text()).toContain("Untuk A kamu butuh rata-rata");
    expect(s.text()).not.toContain("Perbaiki angka");
  });

  it("answers for the letter the Student aims for", async () => {
    const s = await openCourse("PL3002");
    await tab(/^Nilai/);
    await type("Nilai UTS", "80");
    await s.click("AB");
    expect(s.text()).toContain("Untuk AB kamu butuh rata-rata 63 di UAS, Tugas, Kuis dan Kehadiran.");
    expect(s.text()).toContain("A ≥ 73");
  });

  it("shows the grade once the lecturer publishes it", async () => {
    screen = await openApp({ signedIn: true });
    screen.world.edunex.publishGradebook(95001, 82.5, "A");
    await screen.engineDoes(() => screen!.engine.refresh("edunex"));
    const card = [...document.querySelectorAll<HTMLButtonElement>("main ul li button")].find((b) => b.textContent?.startsWith("PL3002"));
    await screen.click(card!);
    await tab(/^Nilai/);
    expect(screen.text()).toContain("82,5A");
    expect(screen.text()).not.toContain("belum dirilis");
  });
});

describe("announcements and exams", () => {
  it("shows the parent class's announcement with its link clickable", async () => {
    const s = await openCourse("II4091");
    await tab(/^Pengumuman/);
    expect(s.text()).toContain("Link teams untuk kuliah online Proposal TA");
    expect(s.text()).toContain("dari kelas gabungan (semua kelas II4091)");
    // A meeting link is a button, not only a raw address.
    await s.click("Gabung rapat");
    expect(s.calls.at(-1)).toEqual({ name: "shell.openExternal", input: { url: "https://teams.microsoft.com/meet/000000000000?p=fixture" } });
    const link = document.querySelector<HTMLAnchorElement>("main a[href^='https://teams.microsoft.com']")!;
    await s.click(link);
    expect(s.calls.at(-1)).toEqual({ name: "shell.openExternal", input: { url: "https://teams.microsoft.com/meet/000000000000?p=fixture" } });
  });

  it("an announcement the lecturer posts appears", async () => {
    const s = await openCourse("PL3002");
    s.world.edunex.postAnnouncement(95001, { announcement: "Kuliah minggu depan daring", created_at: "2026-10-08 09:00:00" });
    await s.wait(70 * 60_000);
    await tab(/^Pengumuman/);
    expect(s.text()).toContain("Kuliah minggu depan daring");
  });

  it("Tasks & Exams says when neither SIX nor Edunex has an exam", async () => {
    await openCourse("PL3002", { six: true });
    await tab(/^Tugas & Ujian/);
    const exams = [...document.querySelectorAll<HTMLElement>("main section")].find((section) => section.querySelector("h2")?.textContent?.startsWith("Ujian"));
    // Said under the exams' own heading, not floating between the Task lists.
    expect(exams?.textContent).toContain("Belum ada ujian di SIX maupun Edunex");
  });

  it("without SIX, Tasks & Exams doesn't claim SIX has no exam, and offers SIX", async () => {
    const s = await openCourse("PL3002");
    await tab(/^Tugas & Ujian/);
    const exams = [...document.querySelectorAll<HTMLElement>("main section")].find((section) => section.querySelector("h2")?.textContent?.startsWith("Ujian"));
    expect(exams?.textContent).toContain("Belum ada ujian di Edunex. Jadwal ujian dari SIX muncul setelah SIX terhubung.");
    expect(exams?.textContent).not.toContain("SIX maupun");
    await s.click([...exams!.querySelectorAll("button")].find((b) => b.textContent === "Masuk ke SIX")!);
    await s.wait();
    expect(s.store.status("six").state).toBe("live");
  });

  it("Tasks & Exams lists the same exams as Tugas & Ujian, each opening its page", async () => {
    const s = await openCourse("DK4073");
    await tab(/^Tugas & Ujian/);
    const exams = [...document.querySelectorAll<HTMLElement>("main section")].find((section) => section.querySelector("h2")?.textContent?.startsWith("Ujian"))!;
    expect(exams.textContent).toContain("Take-home");
    await s.click(exams.querySelector<HTMLButtonElement>("li button")!);
    expect(document.querySelector("main h1")?.textContent).toBe("Marketing Communication");
    expect(document.querySelector("main")?.textContent).toContain("Kapan dan di mana");
  });
});

describe("in English", () => {
  it("speaks English throughout", async () => {
    screen = await openApp({ signedIn: true });
    await screen.engineDoes(() => screen!.engine.updateSettings({ lang: "en" }));
    const card = [...document.querySelectorAll<HTMLButtonElement>("main ul li button")].find((b) => b.textContent?.startsWith("II4091"));
    await screen.click(card!);
    expect(screen.text()).toContain("Table of contents");
    expect(screen.text()).toContain("Joint class");
    await tab(/^Meetings/);
    expect(screen.text()).toMatch(/Next|Not recorded in Edunex|Present/);
    await tab(/^Grades/);
    expect(screen.text()).toContain("Where your grade stands");
  });
});
