// v2-07 (#75), seam 1: what the Student is alerted about, by the real engine
// against the pretend Edunex on a fake clock. Assertions are on the OS
// notifications the engine asks for and the in-app history.
import { describe, expect, it } from "vitest";
import type { Detector } from "../../src/engine/alerts/detector";
import { DETECTORS } from "../../src/engine/alerts/detectors";
import { wib } from "../pretend/edunex";
import { PretendWorld } from "../pretend/world";
import { startAlerts } from "./alerts-harness";

const HOUR = 3_600_000;
const MINUTE = 60_000;

describe("a full simulated day", () => {
  it("first sync silent, offline Task once, moved and submitted deadlines, a grouped burst, nothing again after a restart", async () => {
    const world = new PretendWorld({ now: "2026-10-08T08:12:00+07:00" });
    const app = await startAlerts({ world });
    const { edunex } = world;

    // The first sync after sign-in is silent: 14 notifications and 10 Tasks already there, none announced.
    await app.wait(10 * MINUTE);
    expect(app.shown).toEqual([]);
    expect(app.history()?.items ?? []).toEqual([]);

    // A Task posted while the computer is offline: exactly one alert once it's back.
    world.setOffline(true);
    await app.until("2026-10-08T08:30:00+07:00");
    const essay = edunex.postTask(95001, { name: "Esai kebijakan inovasi", end_at: wib(world.clock.now() + 3 * 24 * HOUR) });
    await app.until("2026-10-08T08:50:00+07:00");
    expect(app.shown).toEqual([]);
    world.setOffline(false);
    await app.until("2026-10-08T09:30:00+07:00");
    expect(app.shown.map((n) => n.text)).toEqual(["Tugas baru · PL3002 — Esai kebijakan inovasi"]);
    expect(app.shown[0]).toMatchObject({ kind: "newTask", source: "edunex", count: 1, target: { screen: "task", taskId: essay } });

    // A Task due tomorrow at noon; its deadline then moves to 18:00, so the 24-hour reminder moves too.
    await app.until("2026-10-08T09:40:00+07:00");
    const report = edunex.postTask(95326, { name: "Laporan kemajuan", end_at: "2026-10-09T12:00:00+07:00" });
    await app.until("2026-10-08T10:00:00+07:00");
    expect(app.shown.at(-1)?.text).toBe("Tugas baru · II4091 — Laporan kemajuan");
    edunex.moveDeadline(report, "2026-10-09T18:00:00+07:00");
    await app.until("2026-10-08T12:30:00+07:00");
    expect(app.shown.filter((n) => n.kind === "deadline")).toEqual([]);

    // A burst of eight new Tasks across courses: one notification.
    const before = app.shown.length;
    for (const courseId of [95001, 95059, 93409, 92948, 95326, 95001, 95059, 93409]) edunex.postTask(courseId, { end_at: wib(world.clock.now() + 5 * 24 * HOUR) });
    await app.until("2026-10-08T13:30:00+07:00");
    const burst = app.shown.slice(before);
    expect(burst).toHaveLength(1);
    expect(burst[0]).toMatchObject({ kind: "newTask", count: 8, target: { screen: "tasks" } });
    expect(burst[0].text).toMatch(/^8 tugas baru — Tugas \d+, Tugas \d+, Tugas \d+ dan 5 lainnya$/);

    // The moved reminder comes at its new time, 24 hours before 18:00 tomorrow.
    await app.until("2026-10-08T17:59:00+07:00");
    expect(app.shown.filter((n) => n.kind === "deadline")).toEqual([]);
    await app.until("2026-10-08T18:01:00+07:00");
    const reminders = app.shown.filter((n) => n.kind === "deadline");
    expect(reminders.map((n) => n.text)).toEqual(["Tenggat 24 jam lagi · II4091 — Laporan kemajuan · belum dikumpulkan"]);
    expect(reminders[0].target).toEqual({ screen: "task", taskId: report });

    // Quit and start again: nothing already shown comes back.
    app.engine.stop();
    const shownBeforeRestart = app.shown.length;
    const again = await startAlerts({ world, storage: app.storage, vault: app.vault, signIn: false });
    await again.until("2026-10-09T09:00:00+07:00");
    expect(again.shown).toEqual([]);
    expect(app.shown).toHaveLength(shownBeforeRestart);

    // Handed in on the website: the 3-hour reminder (15:00) never comes.
    edunex.submitOnWebsite(report);
    await again.until("2026-10-09T16:00:00+07:00");
    expect(again.shown.filter((n) => n.kind === "deadline")).toEqual([]);

    // The history kept every alert, newest first, and the app never marked anything in Edunex.
    const ids = again.history()!.items.map((item) => item.id);
    expect(ids.at(-1)).toBe(`task.new:${essay}`);
    expect(ids).toContain(`task.due24:${report}:${Date.parse("2026-10-09T18:00:00+07:00")}`);
    expect(ids.filter((id) => id.startsWith("task.new:"))).toHaveLength(10);
    expect(world.log.every((request) => request.method === "GET")).toBe(true);
    expect(world.edunex.writes).toEqual([]);
    expect(world.edunex.notifications.data.notifications.every((n: { isRead: number }) => n.isRead === 0)).toBe(true);
  });
});

describe("new Tasks and materials", () => {
  it("announces a material from Edunex's feed with its course, opening the course page", async () => {
    const app = await startAlerts();
    await app.wait(5 * MINUTE);
    app.world.edunex.postMaterial(95059, { name: "K5. Pembiayaan infrastruktur" });
    await app.wait(5 * MINUTE);
    expect(app.shown).toHaveLength(1);
    expect(app.shown[0].text).toBe("Materi baru · PL3032 — K5. Pembiayaan infrastruktur");
    expect(app.shown[0].target).toEqual({ screen: "course", code: "PL3032", tab: "modules" });
  });

  it("runs the Tasks feed as soon as Edunex signals a new Task", async () => {
    const app = await startAlerts();
    await app.wait(5 * MINUTE);
    const tasksCalls = () => app.world.log.filter((r) => r.url.includes("/course/tasks?")).length;
    const calls = tasksCalls();
    app.world.edunex.postTask(93409);
    await app.wait(3 * MINUTE);
    // Well before its 15-minute rhythm, the Task lists were read again.
    expect(tasksCalls()).toBeGreaterThan(calls);
  });

  it("announces a short-window Task at once and on its own, even inside a burst", async () => {
    const app = await startAlerts();
    await app.wait(5 * MINUTE);
    const now = app.world.clock.now();
    app.world.edunex.postTask(95001, { name: "Kuis kelas", end_at: wib(now + 2 * HOUR) });
    app.world.edunex.postTask(95059, { name: "Tugas biasa A", end_at: wib(now + 5 * 24 * HOUR) });
    app.world.edunex.postTask(95059, { name: "Tugas biasa B", end_at: wib(now + 5 * 24 * HOUR) });
    await app.wait(3 * MINUTE + 1_000);
    const quiz = app.shown.find((n) => n.text.startsWith("Tugas singkat"));
    expect(quiz?.text).toMatch(/^Tugas singkat · PL3002 — Kuis kelas · tutup \d\d:\d\d$/);
    expect(quiz?.count).toBe(1);
    await app.wait(MINUTE);
    expect(app.shown.map((n) => n.count)).toEqual([1, 2]);
    // Delivered before the others' grouping window ended.
    expect(quiz!.shownAt).toBeLessThan(app.shown[1].shownAt);
  });

  it("a group turned off in Settings shows no notification but stays in the history", async () => {
    const app = await startAlerts();
    await app.engine.updateSettings({ mutedAlerts: ["newMaterial"] });
    await app.wait(5 * MINUTE);
    app.world.edunex.postMaterial(95001, { name: "Slide minggu 7" });
    await app.wait(5 * MINUTE);
    expect(app.shown).toEqual([]);
    expect(app.history()!.items.map((item) => item.kind)).toEqual(["newMaterial"]);
  });
});

describe("the history and signing out", () => {
  it("opening the history marks it read in the app only", async () => {
    const app = await startAlerts();
    await app.wait(5 * MINUTE);
    app.world.edunex.postMaterial(95001, { name: "Slide minggu 7" });
    await app.wait(5 * MINUTE);
    expect(app.history()!.readAt).toBe(0);
    await app.engine.markAlertsRead();
    expect(app.history()!.readAt).toBe(app.world.clock.now());
    expect(app.world.log.every((request) => request.method === "GET")).toBe(true);
  });

  it("signing out of everything forgets the alerts and what was seen", async () => {
    const app = await startAlerts();
    await app.wait(5 * MINUTE);
    app.world.edunex.postMaterial(95001, { name: "Slide minggu 7" });
    await app.wait(5 * MINUTE);
    expect(app.history()!.items).toHaveLength(1);
    await app.engine.signOut();
    expect(app.history()).toBeUndefined();
    expect([...app.storage.files.keys()].filter((key) => key.startsWith("alerts/") || key.includes("app."))).toEqual([]);
  });

  it("a failing notification feed doesn't sign the Student out or stop the Tasks alerts", async () => {
    const app = await startAlerts();
    await app.wait(5 * MINUTE);
    app.world.edunex.fail(/^\/notifications\//, 500);
    app.world.edunex.postTask(95001, { name: "Tugas saat feed rusak", end_at: wib(app.world.clock.now() + 4 * 24 * HOUR) });
    await app.wait(20 * MINUTE);
    expect(app.shown.map((n) => n.text)).toEqual(["Tugas baru · PL3002 — Tugas saat feed rusak"]);
    expect(app.engine.snapshot().statuses.find((s) => s.source === "edunex")?.state).toBe("offline");
  });
});

describe("Edunex's notification feed", () => {
  it("is read every two to three minutes, and only read", async () => {
    const app = await startAlerts();
    const start = app.world.clock.now();
    await app.wait(60 * MINUTE);
    const reads = app.world.log.filter((r) => r.url.includes("/notifications/") && r.at > start);
    expect(reads.length).toBeGreaterThanOrEqual(20);
    expect(reads.length).toBeLessThanOrEqual(30);
    expect(reads.every((r) => r.method === "GET" && r.url.endsWith(`/notifications/${app.world.edunex.userId}`))).toBe(true);
  });

  it("a shape the app doesn't know shows as 'Edunex changed something', not as silence", async () => {
    const app = await startAlerts();
    await app.wait(5 * MINUTE);
    app.world.edunex.mangle(/^\/notifications\//, { kind: "missing-field", field: "notifications" });
    await app.wait(3 * MINUTE);
    const status = app.engine.snapshot().statuses.find((s) => s.source === "edunex");
    expect(status?.state).toBe("changed");
    expect(status?.detail).toContain("/notifications");
  });
});

describe("time-based alerts", () => {
  // Presence windows arrive with the course page (#74); this stand-in detector plans one the same way.
  const presence = (start: string, end: string): Detector => ({
    name: "presence.test",
    watches: ["edunex.courses"],
    // A real detector plans from its data; before sign-in there is none.
    plan: ({ get }) =>
      get("edunex.courses") === undefined
        ? []
        : [
      {
        id: `presence.open:test:${start}`,
        kind: "presenceOpen",
        source: "edunex",
        urgent: true,
        at: Date.parse(start),
        until: Date.parse(end),
        title: { key: "alert.plain", vars: { title: "Presensi dibuka" } },
        body: null,
        target: { screen: "presence" },
      },
          ],
  });

  it("raises a Presence-open alert at the window's start, never delayed or grouped", async () => {
    const app = await startAlerts({ detectors: [...DETECTORS, presence("2026-10-08T10:00:00+07:00", "2026-10-08T10:30:00+07:00")] });
    await app.until("2026-10-08T09:59:59+07:00");
    expect(app.shown).toEqual([]);
    await app.until("2026-10-08T10:00:00+07:00");
    expect(app.shown).toHaveLength(1);
    expect(app.shown[0]).toMatchObject({ kind: "presenceOpen", count: 1, shownAt: Date.parse("2026-10-08T10:00:00+07:00"), target: { screen: "presence" } });
  });

  it("a window already open at the first sync is part of the silent baseline", async () => {
    const app = await startAlerts({ detectors: [...DETECTORS, presence("2026-10-08T08:00:00+07:00", "2026-10-08T09:00:00+07:00")] });
    await app.wait(10 * MINUTE);
    expect(app.shown).toEqual([]);
  });
});
