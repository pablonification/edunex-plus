// @vitest-environment jsdom
// v2-16 (#85), seam 2: the Presensi screen as the Student sees it, with the
// real engine, the pretend EduNex and ITB calendar behind the bridge, and
// SIX's datasets injected (until #76 lands its source).
import { afterEach, describe, expect, it } from "vitest";
import type { ClassSession, SixCourse, Task } from "../../src/core/models";
import { aTask } from "../kit/tasks";
import { PretendWorld } from "../pretend/world";
import { openApp } from "./harness";

let screen: Awaited<ReturnType<typeof openApp>> | null = null;
afterEach(() => {
  screen?.close();
  screen = null;
});

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const wib = (iso: string) => Date.parse(`${iso}+07:00`);

function weekly(code: string, firstIso: string, weeks: number, room = "9134"): ClassSession[] {
  return Array.from({ length: weeks }, (_, i) => {
    const start = wib(firstIso) + i * 7 * DAY;
    return { id: `${code}-${i}`, courseCode: code, courseName: code, start, end: start + 2 * HOUR, activity: "Kuliah", room };
  });
}
const course = (code: string, attended: number, held: number): SixCourse => ({ code, name: code, classNo: "01", sks: 3, attendance: { attended, held } });
/** SIX puts the UTS in the course's slot in UTS week (12–16 Oct). */
const withUts = (sessions: ClassSession[]) => sessions.map((s) => (s.start >= wib("2026-10-12T00:00:00") && s.start < wib("2026-10-17T00:00:00") ? { ...s, activity: "UTS" } : s));

let hash = 0;
async function six(courses: SixCourse[], schedule: ClassSession[]) {
  await screen!.apply({ type: "dataset", dataset: { name: "six.courses", value: courses, fetchedAt: 0, hash: `c${++hash}` } });
  await screen!.apply({ type: "dataset", dataset: { name: "six.schedule", value: schedule, fetchedAt: 0, hash: `s${++hash}` } });
}

async function openPresence(now?: string) {
  screen = await openApp({ signedIn: true, world: new PretendWorld({ now }) });
  await screen.wait();
  await screen.click(/^Presensi/);
  return screen;
}

/** A course's card on the screen. */
const card = (code: string) => [...document.querySelectorAll("main ul > li")].find((li) => li.textContent?.startsWith(code))?.textContent ?? "";

describe("the Presensi screen", () => {
  it("a course counted in SIX: EduNex's unused windows are explained, never called absences", async () => {
    const s = await openPresence();
    await six([course("PL3002", 6, 7)], withUts(weekly("PL3002", "2026-08-27T08:00:00", 10)));
    const pl = card("PL3002");
    expect(pl).toContain("Dihitung di");
    expect(pl).toContain("SIX");
    expect(pl).toContain("86%");
    // 22, 29 Oct on SIX's timetable, then Thursdays to 3 Dec: one absence left.
    expect(pl).toContain("6 hadir · 1 absen · sekitar 7 lagi");
    expect(pl).toContain("Boleh absen 1x lagi");
    expect(pl).toContain("EduNex mencatat 1 dari 6 Presensi, tapi SIX, tempat kehadiranmu dihitung, mencatat 6 dari 7.");
    expect(s.text()).not.toMatch(/\bAbsent\b|Tidak hadir/);
  });

  it("the window open now: the action that counts and a button to that place in EduNex", async () => {
    const s = await openPresence();
    await six([course("PL3002", 6, 7)], weekly("PL3002", "2026-08-27T08:00:00", 10));
    const banner = document.querySelector("main ul > li")!.textContent!;
    expect(banner).toContain("Presensi EduNex dibuka");
    expect(banner).toContain("Buka mata kuliahnya di EduNex");
    expect(banner).toContain("Kehadiranmu dihitung di SIX; Presensi EduNex juga dibuka.");
    expect(banner).toContain("09:30");
    await s.click("Buka di EduNex");
    expect(s.calls.at(-1)).toEqual({ name: "shell.openExternal", input: { url: "https://edunex.itb.ac.id/courses/95001" } });
    // The app never records presence itself.
    expect(s.world.log.every((request) => request.method === "GET")).toBe(true);
  });

  it("Answer Assignment: hand in that Task inside the window", async () => {
    const s = await openPresence("2026-10-16T15:30:00+07:00");
    const task: Task = aTask({ id: 117003, courseCode: "II4091", courseId: 95326, moduleId: 450222, title: "Tugas 02 Bab II", status: "not_started" });
    await s.apply({ type: "dataset", dataset: { name: "edunex.tasks", value: [task], fetchedAt: 0, hash: "t1" } });
    const banner = document.querySelector("main ul > li")!.textContent!;
    expect(banner).toContain("Kumpulkan Tugas 02 Bab II");
    expect(banner).toContain("Presensi dengan submit Tugas 02 Bab II");
    await s.click("Buka di EduNex");
    expect(s.calls.at(-1)).toEqual({ name: "shell.openExternal", input: { url: "https://edunex.itb.ac.id/courses/95326/preview/450222" } });
    expect(card("II4091")).toContain("hanya terhitung jika tugasnya dikumpulkan di dalam jendela waktunya");
  });

  it("no absences left and target out of reach, worst first, counted in the sidebar", async () => {
    const s = await openPresence();
    await six(
      [course("KU5014", 2, 6), course("DK4073", 4, 6), course("PL3002", 6, 7)],
      [
        ...withUts(weekly("KU5014", "2026-08-27T16:00:00", 10)),
        ...withUts(weekly("DK4073", "2026-08-24T11:00:00", 10)),
        ...withUts(weekly("PL3002", "2026-08-27T08:00:00", 10)),
      ],
    );
    const cards = [...document.querySelectorAll("main ul > li")].map((li) => li.textContent ?? "").filter((text) => /^[A-Z]{2}\d{4}/.test(text));
    expect(cards.map((text) => text.slice(0, 6)).slice(0, 3)).toEqual(["KU5014", "DK4073", "PL3002"]);
    expect(card("KU5014")).toContain("80% tak tercapai · maks. 71%");
    expect(card("KU5014")).toContain("minta dosen memperbaikinya sekarang");
    expect(card("DK4073")).toContain("Tidak boleh absen lagi");
    expect(card("DK4073")).toContain("Paling tinggi 85%");
    expect(card("DK4073")).toContain("Kembali ke 80% setelah 4x hadir berturut-turut");
    expect(card("DK4073")).toContain("UTS Sen 12 Okt memakai slot kuliah, bukan pertemuan.");
    // The sidebar counts the three courses at risk.
    expect(s.button(/^Presensi/).textContent).toBe("Presensi3");
  });

  it("follows a mid-semester schedule change", async () => {
    const s = await openPresence();
    const regular = weekly("KU5014", "2026-08-27T16:00:00", 10);
    await six([course("KU5014", 5, 6)], regular);
    expect(card("KU5014")).toContain("16:00 · 9134");
    // SIX moves today's class to tomorrow 13:00 in another room.
    const moved = regular.map((x) => (x.start === wib("2026-10-08T16:00:00") ? { ...x, start: wib("2026-10-09T13:00:00"), end: wib("2026-10-09T15:00:00"), room: "7602" } : x));
    await six([course("KU5014", 5, 6)], moved);
    expect(card("KU5014")).toContain("13:00 · 7602");
    expect(s.text()).not.toContain("16:00 · 9134");
  });

  it("the target is the Student's: raising it changes every course", async () => {
    const s = await openPresence();
    await six([course("PL3002", 6, 7)], withUts(weekly("PL3002", "2026-08-27T08:00:00", 10)));
    expect(card("PL3002")).toContain("Boleh absen 1x lagi");
    await s.click("Naikkan target");
    expect(s.calls.at(-1)).toEqual({ name: "settings.update", input: { attendanceTarget: 85 } });
    expect(card("PL3002")).toContain("Boleh absen 1x lagi");
    await s.click("Naikkan target");
    expect(s.text()).toContain("Target 90%");
    expect(card("PL3002")).toContain("Tidak boleh absen lagi");
  });

  it("in English", async () => {
    const s = await openPresence();
    await s.engineDoes(() => s.engine.updateSettings({ lang: "en" }));
    await six([course("PL3002", 6, 7)], withUts(weekly("PL3002", "2026-08-27T08:00:00", 10)));
    expect(card("PL3002")).toContain("Counted in");
    expect(card("PL3002")).toContain("1 more absence allowed");
    expect(card("PL3002")).toContain("6 attended · 1 missed · about 7 to go");
  });

  it("before SIX is connected, says so instead of guessing", async () => {
    const s = await openPresence();
    expect(card("PL3002")).toContain("Belum ada hitungan SIX");
    expect(card("KU5014")).toContain("Belum ada catatan kehadiran");
    expect(s.text()).not.toMatch(/\bAbsent\b|Tidak hadir/);
  });
});

describe("attendance in Settings", () => {
  it("the Presence and attendance alerts switch off, and the target is set there too", async () => {
    screen = await openApp({ signedIn: true });
    await screen.apply({ type: "command", command: "settings" });
    await screen.click("Presensi dibuka");
    await screen.click("Kehadiran");
    expect(screen.engine.snapshot().settings.mutedAlerts).toEqual(["presence", "attendanceRisk"]);
    expect(screen.text()).toContain("Target kehadiran");
    await screen.click("Turunkan target");
    expect(screen.engine.snapshot().settings.attendanceTarget).toBe(75);
  });
});
