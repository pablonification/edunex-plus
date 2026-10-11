// v2-16 (#85), seam 1: the attendance alerts, by the real engine against the
// pretend EduNex and ITB calendar and a stand-in SIX, on a fake clock.
// Assertions are on the OS notifications the engine asks for and the history.
import { describe, expect, it } from "vitest";
import type { ClassSession, SixCourse } from "../../src/core/models";
import { PretendWorld } from "../pretend/world";
import { type PretendSixState, STUDENT, startAttendance } from "./attendance-harness";

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const wib = (iso: string) => Date.parse(`${iso}+07:00`);

function weekly(code: string, firstIso: string, weeks: number): ClassSession[] {
  return Array.from({ length: weeks }, (_, i) => {
    const start = wib(firstIso) + i * 7 * DAY;
    return { id: `${code}-${i}`, courseCode: code, courseName: code, start, end: start + 2 * HOUR, activity: "Kuliah", room: "9134" };
  });
}

const course = (code: string, attended: number, held: number): SixCourse => ({ code, name: code, classNo: "01", sks: 3, attendance: { attended, held } });

/** PL3002 meets Thursdays 08:00 in SIX (counted 6 of 7); its EduNex windows use the View Course default. */
function sixState(): PretendSixState {
  return { student: STUDENT, courses: [course("PL3002", 6, 7), course("II4091", 2, 2)], schedule: weekly("PL3002", "2026-08-27T08:00:00", 10) };
}

describe("Presence opening", () => {
  it("not for a window already open at the first sync", async () => {
    const world = new PretendWorld({ now: "2026-10-08T08:12:00+07:00" });
    const app = await startAttendance({ world, six: sixState() });
    await app.until("2026-10-08T10:00:00+07:00");
    expect(app.of("presenceOpen")).toEqual([]);
  });

  it("fires at the window's start, alone, naming the action that counts, and never twice", async () => {
    const world = new PretendWorld({ now: "2026-10-14T20:00:00+07:00" });
    const app = await startAttendance({ world, six: sixState() });

    // PL3002, View Course (EduNex's default), 08:00–09:30.
    await app.until("2026-10-15T07:59:00+07:00");
    expect(app.of("presenceOpen")).toEqual([]);
    await app.until("2026-10-15T08:01:00+07:00");
    const [pl] = app.of("presenceOpen");
    expect(pl).toMatchObject({ count: 1, source: "edunex", target: { screen: "course", code: "PL3002", tab: "meetings" } });
    expect(pl.text).toBe("Presensi dibuka · PL3002 — Buka mata kuliahnya di EduNex · tutup 09:30");
    expect(pl.shownAt).toBe(wib("2026-10-15T08:00:00"));

    // II4091, Answer Assignment: hand in Tugas 02 inside the window (Friday 15:00–23:59).
    await app.until("2026-10-16T15:01:00+07:00");
    const ii = app.of("presenceOpen").filter((n) => n.title.vars?.course === "II4091");
    expect(ii.map((n) => n.text)).toEqual(["Presensi dibuka · II4091 — Kumpulkan Tugas 02 Bab II · tutup 23:59"]);
    expect(ii[0].shownAt).toBe(wib("2026-10-16T15:00:00"));

    // Never twice, not even after a restart.
    await app.until("2026-10-16T23:30:00+07:00");
    expect(app.of("presenceOpen")).toHaveLength(2);
    app.engine.stop();
    const again = await startAttendance({ world, six: sixState(), storage: app.storage, vault: app.vault, signIn: false });
    await again.until("2026-10-16T23:50:00+07:00");
    expect(again.of("presenceOpen")).toEqual([]);
  });

  it("names Read Module, and skips a window the Student was already recorded in", async () => {
    const world = new PretendWorld({ now: "2026-10-14T20:00:00+07:00" });
    const module = world.edunex.schedulePresence(95001, 86778, {
      start: "2026-10-15T13:00:00+07:00",
      end: "2026-10-15T15:00:00+07:00",
      patch: { presentable: [{ presentable: "module", presentable_id: "473251" }] },
    });
    const done = world.edunex.schedulePresence(95001, 86778, { start: "2026-10-15T16:00:00+07:00", end: "2026-10-15T17:00:00+07:00" });
    world.edunex.markPresent(done);
    const app = await startAttendance({ world, six: sixState() });
    await app.until("2026-10-15T18:00:00+07:00");
    const texts = app.of("presenceOpen").map((n) => n.text);
    expect(texts).toEqual(["Presensi dibuka · PL3002 — Buka mata kuliahnya di EduNex · tutup 09:30", "Presensi dibuka · PL3002 — Buka modulnya di EduNex · tutup 15:00"]);
    expect(app.of("presenceOpen")[1].id).toBe(`presence.open:${module}:${wib("2026-10-15T13:00:00")}`);
  });

  it("turned off in Settings: no notification, still in the history", async () => {
    const world = new PretendWorld({ now: "2026-10-14T20:00:00+07:00" });
    const app = await startAttendance({ world, six: sixState() });
    await app.engine.updateSettings({ mutedAlerts: ["presence"] });
    await app.until("2026-10-15T08:30:00+07:00");
    expect(app.of("presenceOpen")).toEqual([]);
    const history = app.engine.snapshot().datasets.find((d) => d.name === "app.alerts")?.value as { items: { kind: string }[] };
    expect(history.items.map((item) => item.kind)).toContain("presenceOpen");
  });
});

describe("SIX not counting a class", () => {
  /** A Thursday class 22 Oct, 08:00–10:00, after the app has been running since the evening before. */
  async function classDay() {
    const world = new PretendWorld({ now: "2026-10-21T20:00:00+07:00" });
    const six = sixState();
    const app = await startAttendance({ world, six });
    await app.until("2026-10-22T07:00:00+07:00");
    return { app, six };
  }
  const notCounted = (app: Awaited<ReturnType<typeof startAttendance>>) => app.of("attendanceRisk").filter((n) => n.id.startsWith("six.notCounted:"));

  it("nothing changed: SIX hasn't recorded the class, said the same day, once", async () => {
    const { app } = await classDay();
    await app.until("2026-10-22T12:59:00+07:00");
    expect(notCounted(app)).toEqual([]);
    await app.until("2026-10-22T13:01:00+07:00");
    expect(notCounted(app).map((n) => n.text)).toEqual([
      "SIX belum mencatat kuliah hari ini · PL3002 — Hadir 6 dari 7 di SIX. Jika kamu hadir, minta dosen memperbaikinya hari ini.",
    ]);
    expect(notCounted(app)[0]).toMatchObject({ source: "six", target: { screen: "presence" } });
    await app.until("2026-10-23T09:00:00+07:00");
    expect(notCounted(app)).toHaveLength(1);
  });

  it("held went up but attended didn't: SIX marked the Student absent", async () => {
    const { app, six } = await classDay();
    await app.until("2026-10-22T11:00:00+07:00");
    six.courses[0] = course("PL3002", 6, 8);
    await app.sixRefresh();
    await app.until("2026-10-22T13:01:00+07:00");
    expect(notCounted(app).map((n) => n.title.key)).toEqual(["alert.six.absent"]);
    expect(notCounted(app)[0].text).toMatch(/^SIX mencatatmu tidak hadir · PL3002 — Hadir 6 dari 8 di SIX/);
  });

  it("SIX unreachable since the class: nothing said until SIX is read again", async () => {
    const { app, six } = await classDay();
    six.offline = true;
    await app.until("2026-10-22T15:00:00+07:00");
    // A quiet SIX isn't one that didn't count.
    expect(notCounted(app)).toEqual([]);
    six.offline = false;
    await app.sixRefresh();
    await app.until("2026-10-22T15:10:00+07:00");
    expect(notCounted(app).map((n) => n.title.key)).toEqual(["alert.six.missing"]);
  });

  it("counted: nothing to say", async () => {
    const { app, six } = await classDay();
    await app.until("2026-10-22T11:00:00+07:00");
    six.courses[0] = course("PL3002", 7, 8);
    await app.sixRefresh();
    await app.until("2026-10-22T23:00:00+07:00");
    expect(notCounted(app)).toEqual([]);
  });

  it("a class from before the app started isn't judged", async () => {
    const world = new PretendWorld({ now: "2026-10-22T11:00:00+07:00" });
    const app = await startAttendance({ world, six: sixState() });
    await app.until("2026-10-22T23:00:00+07:00");
    expect(notCounted(app)).toEqual([]);
  });
});

describe("no absences left, target out of reach", () => {
  it("each said once, when SIX's count moves the course there", async () => {
    // DK4073 meets Mondays 11:00; SIX's timetable covers through October, ITB's calendar ends lectures on 4 Dec.
    const world = new PretendWorld({ now: "2026-10-21T20:00:00+07:00" });
    const six: PretendSixState = {
      student: STUDENT,
      courses: [course("DK4073", 7, 8)],
      schedule: weekly("DK4073", "2026-08-24T11:00:00", 10).map((s) => (s.start === wib("2026-10-12T11:00:00") ? { ...s, activity: "UTS" } : s)),
    };
    const app = await startAttendance({ world, six });
    await app.until("2026-10-21T21:00:00+07:00");
    // 7 of 8 with 6 to go (26 Oct, then 2 Nov – 30 Nov): one absence left, nothing said yet.
    expect(app.of("attendanceRisk")).toEqual([]);

    // The lecturer enters two meetings at once, both absent: 7 of 10, every one of the 6 left needed.
    six.courses = [course("DK4073", 7, 10)];
    await app.sixRefresh();
    await app.until("2026-10-21T21:30:00+07:00");
    expect(app.of("attendanceRisk").map((n) => n.text)).toEqual([
      "Tidak boleh absen lagi · DK4073 — Hadir 7 dari 10 di SIX: hadiri setiap pertemuan tersisa untuk tetap 80%.",
    ]);

    six.courses = [course("DK4073", 7, 11)];
    await app.sixRefresh();
    await app.until("2026-10-21T22:00:00+07:00");
    expect(app.of("attendanceRisk").map((n) => n.title.key)).toEqual(["alert.attendance.none", "alert.attendance.out"]);
    expect(app.of("attendanceRisk")[1].text).toMatch(/^Target 80% tak tercapai lagi · DK4073 — Paling tinggi 76%/);

    // Nothing new while it stays there.
    await app.sixRefresh();
    await app.until("2026-10-22T08:00:00+07:00");
    expect(app.of("attendanceRisk")).toHaveLength(2);
  });

  it("already there at the first sync: silent", async () => {
    const world = new PretendWorld({ now: "2026-10-21T20:00:00+07:00" });
    const six: PretendSixState = { student: STUDENT, courses: [course("DK4073", 2, 8)], schedule: weekly("DK4073", "2026-08-24T11:00:00", 10) };
    const app = await startAttendance({ world, six });
    await app.until("2026-10-22T08:00:00+07:00");
    expect(app.of("attendanceRisk")).toEqual([]);
  });
});
