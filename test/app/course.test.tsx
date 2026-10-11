// @vitest-environment jsdom
// v2-06 (#74), seam 2: the course page as the Student sees it, with the real
// engine and the pretend EduNex behind the bridge.
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
    expect(toc).toContain("Kelas induk");
    expect(toc.indexOf("Tugas")).toBeLessThan(toc.indexOf("Penawaran Topik TA Dosen"));
    expect(toc).not.toContain("Module 06");
  });

  it("Open in EduNex stays on Home's cards", async () => {
    screen = await openApp({ signedIn: true });
    await screen.click("Buka di EduNex: PL3002");
    expect(screen.calls.at(-1)).toEqual({ name: "shell.openExternal", input: { url: "https://edunex.itb.ac.id/courses/95001" } });
  });

  it("an empty course says so", async () => {
    // KU5014 has no materials; take its two Tasks away too.
    const world = new PretendWorld();
    world.edunex.tasks.set(92948, []);
    const s = await openCourse("KU5014", { world });
    expect(s.text()).toContain("Belum ada materi di EduNex");
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
    // EduNex's inline styles never reach the page.
    expect(document.querySelector("main strong")!.closest("li")!.querySelector("[style]")).toBeNull();
    // A note that is only a picture opens on EduNex instead.
    expect(s.has("Buka di EduNex: Course Tokens : FIXTUR")).toBe(true);
  });

  it("each material type gets its own action; unknown types open in EduNex", async () => {
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
    for (const name of ["Situs luar", "Kuis interaktif", "CloudX", "Baru"]) expect(screen.has(`Buka di EduNex: ${name}`)).toBe(true);
    expect(screen.text()).toContain("Kelas online · Google Meet");
    await screen.click("Unduh: Data");
    expect(screen.calls.at(-1)).toMatchObject({ name: "files.download", input: { name: "Data.xlsx" } });
    await screen.click("Buka di EduNex: Baru");
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
    await s.click("Simpan untuk offline");
    expect(s.calls.at(-1)).toEqual({ name: "course.saveOffline", input: { code: "PL3032", pick: false } });
    expect(s.text()).toContain("1 berkas baru tersimpan, 0 sudah ada");
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
    // The module with an open Task is marked in the table of contents.
    expect(document.querySelector("[aria-label='Ada tugas terbuka']")).not.toBeNull();
    await entry(module.title);
    expect(s.text()).toContain("Tugas Mandiri Inovasi");
    expect(s.text()).toContain("Belum dikerjakan");
    await s.click(/^Tugas Mandiri Inovasi/);
    expect(document.querySelector("h1")?.textContent).toContain("Tugas Mandiri Inovasi");
  });
});

describe("meetings", () => {
  it("every Presence session of the class, across pages, never labelled absent", async () => {
    const s = await openCourse("PL3002");
    await tab(/^Pertemuan/);
    const meetings = rows("main ol li");
    expect(meetings).toHaveLength(15);
    expect(meetings[0]).toContain("Hadir");
    expect(meetings[1]).toContain("Tidak tercatat di EduNex");
    expect(meetings.at(-1)).toContain("Akan datang");
    expect(s.text()).not.toMatch(/Absen|Tidak hadir|Absent/);
  });

  it("pins the meeting going on now with its open Presence window and the button to act on EduNex", async () => {
    const s = await openCourse("PL3002");
    expect(s.text()).toContain("Sedang berlangsung");
    expect(s.text()).toContain("Presensi EduNex dibuka");
    expect(s.text()).toContain("tutup dalam 1 jam 18 mnt");
    const record = [...document.querySelectorAll("button")].find((b) => b.textContent === "Catat di EduNex")!;
    await s.click(record);
    expect(s.calls.at(-1)).toEqual({ name: "shell.openExternal", input: { url: "https://edunex.itb.ac.id/courses/95001" } });
  });

  it("a class without EduNex Presence says so", async () => {
    const s = await openCourse("KU5014");
    await tab(/^Pertemuan/);
    expect(s.text()).toContain("Kelas ini tidak memakai Presensi EduNex");
    expect(s.text()).toContain("Belum ada pertemuan");
  });

  it("SIX gives the room; a meeting announced only in EduNex text is marked not in SIX", async () => {
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
  it("hides EduNex's placeholder gradebook and works out what's needed on what's left", async () => {
    const s = await openCourse("PL3002");
    await tab(/^Nilai/);
    expect(s.text()).toContain("Buku nilai EduNex belum dirilis dosen");
    expect(s.text()).not.toMatch(/0[.,]0+\s*·?\s*E\b/);
    expect(s.text()).toContain("Contoh bobot (kontrak kuliah ITB)");
    const score = document.querySelector<HTMLInputElement>("input[aria-label='Nilai UTS']")!;
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(score, "80");
      score.dispatchEvent(new Event("input", { bubbles: true }));
    });
    // UTS 80 secures 24 of the 75 an A needs; the other 70% must average 73.
    expect(s.text()).toContain("A ≥ 73");
    expect(s.text()).toContain("Bobot dari kontrak kuliahmu");
    expect(s.calls.at(-1)).toMatchObject({ name: "local.set", input: { name: "local.courseWeights" } });
    expect(data("local.courseWeights").PL3002.parts[0]).toMatchObject({ id: "uts", score: 80 });
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
    expect(s.text()).toContain("Kelas induk");
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

  it("Tasks & Exams says when EduNex has no exams", async () => {
    const s = await openCourse("PL3002");
    await tab(/^Tugas & Ujian/);
    expect(s.text()).toContain("Tidak ada ujian di EduNex");
  });
});

describe("in English", () => {
  it("speaks English throughout", async () => {
    screen = await openApp({ signedIn: true });
    await screen.engineDoes(() => screen!.engine.updateSettings({ lang: "en" }));
    const card = [...document.querySelectorAll<HTMLButtonElement>("main ul li button")].find((b) => b.textContent?.startsWith("II4091"));
    await screen.click(card!);
    expect(screen.text()).toContain("Table of contents");
    expect(screen.text()).toContain("Parent class");
    await tab(/^Meetings/);
    expect(screen.text()).toMatch(/Upcoming|Not marked in EduNex|Present/);
    await tab(/^Grades/);
    expect(screen.text()).toContain("Where your grade stands");
  });
});
