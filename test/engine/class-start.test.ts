// The phone's reminder at the start of every class SIX counts (sixClassStart in
// src/engine/alerts/check-in.ts): with the app closed nothing reads SIX for
// Tandai Hadir, so the phone's engine plans one at each such class's start, to
// be booked with Android. The desktop reads SIX all class while it runs: its
// plan has none, exactly as before. Then a new Task's alert carries its
// deadline, which the desktop's words leave out. The real engine against the
// pretend Edunex and SIX, on the recorded Thursday: PL3002 08:00–10:00 (SIX
// meeting 2194342), then DK4073 at 11:00; every course counts in SIX.
import { describe, expect, it } from "vitest";
import type { Task } from "../../src/core/models";
import { translate } from "../../src/core/strings";
import type { PlannedAlert } from "../../src/engine/alerts/detector";
import { newTaskAlert } from "../../src/engine/alerts/tasks";
import { edunex } from "../../src/engine/sources/edunex";
import { six } from "../../src/engine/sources/six";
import { PRETEND_SIX_COOKIE } from "../pretend/six";
import { PretendWorld } from "../pretend/world";
import { startAlerts } from "./alerts-harness";

const MINUTE = 60_000;
const PL3002 = "2194342";
const DK4073 = "2153983";
const wib = (iso: string) => Date.parse(`${iso}+07:00`);
const TIMETABLE = "https://six.itb.ac.id/app/mahasiswa:18223901+2026-1/kelas/jadwal/mahasiswa/2021000001?bulan=202610";
const startOf = (meetingId: string, start: string) => `six.classStart:${meetingId}:${wib(start)}`;

/** Signed in to Edunex and SIX at `now`, past the first sync; `phone`: as the phone app's engine. */
async function signedIn(now: string, phone: boolean, before?: (world: PretendWorld) => void) {
  const world = new PretendWorld({ now: `${now}+07:00` });
  before?.(world);
  const app = await startAlerts({ world, sources: [edunex, six], checkInReminders: phone });
  const signingIn = app.engine.signIn("six", { cookie: PRETEND_SIX_COOKIE });
  await app.wait(MINUTE);
  await signingIn;
  await app.wait(MINUTE);
  const starts = () => app.upcoming().filter((planned) => planned.id.startsWith("six.classStart:"));
  const shownStarts = () => app.shown.filter((notice) => notice.id.startsWith("six.classStart:"));
  return { ...app, starts, shownStarts };
}

describe("the phone's reminder at the start of a class SIX counts", () => {
  it("is planned at every such class's start, urgent on Presensi, opening SIX on the class like Tandai Hadir's", async () => {
    const app = await signedIn("2026-10-07T20:00:00", true);
    const reminder = app.starts().find((planned) => planned.id === startOf(PL3002, "2026-10-08T08:00:00"));
    expect(reminder).toMatchObject({
      kind: "presenceOpen",
      source: "six",
      urgent: true,
      at: wib("2026-10-08T08:00:00"),
      until: wib("2026-10-08T10:00:00"),
      target: { screen: "home" },
      checkIn: { meetingId: PL3002, url: TIMETABLE },
    } satisfies Partial<PlannedAlert>);
    const words = (lang: "id" | "en") => [reminder!.title, reminder!.body!].map((part) => translate(lang, part.key, part.vars));
    expect(words("id")).toEqual(["Kuliah sudah mulai · PL3002", "Tekan Tandai Hadir di SIX saat tombolnya muncul · kuliah sampai 10:00"]);
    expect(words("en")).toEqual(["Class has started · PL3002", "Press Tandai Hadir in SIX when it shows · class until 10:00"]);
    // Every class of the day, each once.
    expect(app.starts().map((planned) => planned.id)).toContain(startOf(DK4073, "2026-10-08T11:00:00"));
    expect(new Set(app.starts().map((planned) => planned.id)).size).toBe(app.starts().length);

    // The app running at 08:00 raises it itself, once (Android's booking shares the id: ../mobile/booking.test.ts).
    await app.until("2026-10-08T09:00:00+07:00");
    expect(app.shownStarts().map((notice) => [notice.id, notice.shownAt])).toEqual([[startOf(PL3002, "2026-10-08T08:00:00"), wib("2026-10-08T08:00:00")]]);
  });

  it("isn't planned for a course whose attendance SIX doesn't count", async () => {
    const app = await signedIn("2026-10-07T20:00:00", true, (world) => world.six.setAttendance("PL3002", 0, 0));
    const ids = app.starts().map((planned) => planned.id);
    expect(ids.some((id) => id.startsWith(`six.classStart:${PL3002}:`))).toBe(false);
    expect(app.starts().some((planned) => planned.title.vars?.course === "PL3002")).toBe(false);
    expect(ids).toContain(startOf(DK4073, "2026-10-08T11:00:00"));
  });

  it("is muted with Presensi in Settings: not booked, not shown, still in the history", async () => {
    const app = await signedIn("2026-10-07T20:00:00", true);
    await app.engine.updateSettings({ mutedAlerts: ["presence"] });
    app.engine.planAlerts();
    expect(app.starts()).toEqual([]);
    await app.until("2026-10-08T08:05:00+07:00");
    expect(app.shownStarts()).toEqual([]);
    expect(app.history()?.items.map((item) => item.id)).toContain(startOf(PL3002, "2026-10-08T08:00:00"));
  });

  it("isn't said once SIX showed the button (its own alert said so) or the Student pressed it", async () => {
    // Read from 07:55: the button shows already.
    const open = await signedIn("2026-10-08T07:30:00", true, (world) => world.six.openCheckIn(PL3002));
    await open.until("2026-10-08T08:30:00+07:00");
    expect(open.shown.filter((notice) => notice.id === `six.checkIn:${PL3002}`)).toHaveLength(1);
    expect(open.shownStarts()).toEqual([]);

    // Shown before class (read from 07:55), then pressed before 08:00.
    const pressed = await signedIn("2026-10-08T07:30:00", true, (world) => world.six.openCheckIn(PL3002));
    while (!pressed.shown.some((notice) => notice.id === `six.checkIn:${PL3002}`)) await pressed.wait(MINUTE / 2);
    expect(pressed.world.clock.now()).toBeLessThan(wib("2026-10-08T07:58:00"));
    pressed.world.six.closeCheckIn(PL3002);
    await pressed.until("2026-10-08T08:30:00+07:00");
    expect(pressed.engine.snapshot().datasets.find((d) => d.name === "six.checkIn")?.value).toMatchObject({ [PL3002]: { state: "gone" } });
    expect(pressed.shownStarts()).toEqual([]);
  });

  it("follows a class SIX moved: at its new time, and not at the old one", async () => {
    const app = await signedIn("2026-10-07T20:00:00", true, (world) => world.six.moveMeeting(PL3002, "13:00", "14:40"));
    const ids = app.starts().map((planned) => planned.id);
    expect(ids).toContain(startOf(PL3002, "2026-10-08T13:00:00"));
    expect(ids).not.toContain(startOf(PL3002, "2026-10-08T08:00:00"));
  });

  it("isn't on the desktop: its plan is exactly what it was", async () => {
    const desktop = await signedIn("2026-10-07T20:00:00", false);
    const phone = await signedIn("2026-10-07T20:00:00", true);
    expect(desktop.starts()).toEqual([]);
    expect(phone.starts().length).toBeGreaterThan(0);
    const others = (planned: readonly PlannedAlert[]) => planned.filter((p) => !p.id.startsWith("six.classStart:"));
    expect(desktop.upcoming()).toEqual(others(phone.upcoming()));
    await desktop.until("2026-10-08T09:00:00+07:00");
    expect(desktop.shownStarts()).toEqual([]);
  });
});

describe("a new Task's alert", () => {
  const now = wib("2026-10-08T08:00:00");
  const task: Task = {
    id: 117003,
    courseCode: "PL3002",
    courseId: 1,
    moduleId: null,
    title: "Kuis Kilat Bab 5",
    status: "not_started",
    opensAt: null,
    dueAt: wib("2026-10-16T23:59:00"),
    score: null,
    module: null,
    kind: "task",
    instructions: "",
    files: [],
    fileRequired: false,
    lateAllowed: false,
    closed: false,
    answer: null,
    postedAt: null,
    editedAt: null,
  };

  it("carries its deadline for the phone, and the desktop's words stay the Task's title alone", () => {
    const alert = newTaskAlert(task, now);
    expect(alert.body).toEqual({
      key: "alert.newTask.body",
      vars: { title: "Kuis Kilat Bab 5", dateId: "Jum, 16 Okt", dateEn: "Fri, 16 Oct", time: "23:59" },
    });
    expect(translate("id", alert.title.key, alert.title.vars)).toBe("Tugas baru · PL3002");
    expect(translate("id", alert.body!.key, alert.body!.vars)).toBe("Kuis Kilat Bab 5");
    expect(translate("en", alert.body!.key, alert.body!.vars)).toBe("Kuis Kilat Bab 5");
  });

  it("without a deadline, just the title, as before", () => {
    expect(newTaskAlert({ ...task, dueAt: null }, now).body).toEqual({ key: "alert.plain", vars: { title: "Kuis Kilat Bab 5" } });
  });

  it("from a short window, still the short Task's words", () => {
    const short = newTaskAlert({ ...task, dueAt: now + 2 * 60 * MINUTE }, now);
    expect(short.body?.key).toBe("alert.shortTask.body");
  });
});
