// v2-09 (#77), seam 1: the change alerts Edunex never sends, by the real
// engine against the pretend Edunex and a stand-in SIX on a fake clock: a
// Task edited (loud when edited after the Student handed it in) and material
// posted for a class that meets today.
import { describe, expect, it } from "vitest";
import type { Alert, ClassSession, SixCourse } from "../../src/core/models";
import { translate } from "../../src/core/strings";
import { PretendWorld } from "../pretend/world";
import { type PretendSixState, STUDENT, startAttendance } from "./attendance-harness";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const wib = (iso: string) => Date.parse(`${iso}+07:00`);

const course = (code: string, attended: number, held: number): SixCourse => ({ code, name: code, classNo: "01", sks: 3, attendance: { attended, held } });
const session = (id: string, code: string, startIso: string): ClassSession => ({
  id,
  courseCode: code,
  courseName: code,
  start: wib(startIso),
  end: wib(startIso) + 2 * HOUR,
  activity: "Kuliah",
  room: "9134",
});

/** PL3002 meets today (Thursday 8 Oct) at 13:00; PL3032 doesn't meet today. */
function sixState(): PretendSixState {
  return {
    student: STUDENT,
    courses: [course("PL3002", 6, 7), course("PL3032", 4, 7)],
    schedule: [session("s1", "PL3002", "2026-10-01T13:00:00"), session("s2", "PL3002", "2026-10-08T13:00:00")],
  };
}

async function start() {
  const world = new PretendWorld({ now: "2026-10-08T08:12:00+07:00" });
  const app = await startAttendance({ world, six: sixState() });
  await app.until("2026-10-08T08:40:00+07:00");
  return app;
}

describe("a Task edited", () => {
  it("first sync silent: edits Edunex already had aren't announced", async () => {
    const app = await start();
    expect(app.of("taskEdited")).toEqual([]);
  });

  it("before the Student handed it in: one alert, grouped like other news, opening the Task", async () => {
    const app = await start();
    app.world.edunex.editTask(117003, { description: "<p>Tambahan: lampirkan diagram.</p>" });
    const editedAt = app.world.clock.now();
    await app.until("2026-10-08T09:10:00+07:00");
    const [edit] = app.of("taskEdited");
    expect(app.of("taskEdited")).toHaveLength(1);
    // How many things changed, not which: the Task page's History says which.
    expect(edit.text).toBe("Tugas diubah · II4091 — Tugas 02 Bab II · 1 perubahan");
    expect(edit).toMatchObject({ source: "edunex", count: 1, target: { screen: "task", taskId: 117003 } });
    // Never twice: the same edit stays one alert.
    await app.until("2026-10-08T12:00:00+07:00");
    expect(app.of("taskEdited")).toHaveLength(1);
    const history = app.engine.snapshot().datasets.find((d) => d.name === "app.alerts")?.value as { items: { id: string }[] };
    expect(history.items.map((i) => i.id)).toContain(`task.edited:117003:${Math.floor(editedAt / 1000) * 1000}`);
  });

  it("after the Student handed it in: at once and on its own, saying to check whether to hand it in again", async () => {
    const app = await start();
    app.world.edunex.submitOnWebsite(117003);
    await app.until("2026-10-08T09:30:00+07:00");
    app.world.edunex.editTask(117003, { description: "<p>Format berubah.</p>" });
    // A burst of news at the same time doesn't hold it back.
    app.world.edunex.editTask(117010, { description: "<p>Revisi.</p>" });
    await app.until("2026-10-08T10:00:00+07:00");
    const edits = app.of("taskEdited");
    expect(edits.map((n) => n.text)).toEqual([
      "Diubah setelah kamu kumpulkan · II4091 — Tugas 02 Bab II · 1 perubahan · cek apakah perlu dikumpulkan ulang",
      "Tugas diubah · II4091 — Tugas 03 Bab III · 1 perubahan",
    ]);
    expect(edits[0].shownAt).toBeLessThan(edits[1].shownAt);
  });

  it("one date moving is said by name, with its day and time; a deadline pulled in close comes at once", async () => {
    const app = await start();
    app.world.edunex.moveDeadline(117010, "2026-11-02T23:59:00+07:00");
    app.world.edunex.moveDeadline(117003, "2026-10-09T20:00:00+07:00");
    await app.until("2026-10-08T09:10:00+07:00");
    const texts = app.of("taskEdited").map((n) => n.text);
    expect(texts).toContain("Tenggat dimajukan ke Jum, 9 Okt, 20:00 · II4091 — Tugas 02 Bab II");
    expect(texts).toContain("Tenggat diundur ke Sen, 2 Nov, 23:59 · II4091 — Tugas 03 Bab III");
    // Pulled in to tomorrow: urgent, not held for a grouped notification.
    expect(app.of("taskEdited").find((n) => n.text.startsWith("Tenggat dimajukan"))).toMatchObject({ count: 1 });
  });

  it("several changes in one edit: how many", async () => {
    const app = await start();
    app.world.edunex.editTask(117003, { description: "<p>Revisi.</p>", is_lateable: false, name: "Tugas 02 Bab II (revisi)" });
    await app.until("2026-10-08T09:10:00+07:00");
    expect(app.of("taskEdited").map((n) => n.text)).toEqual(["Tugas diubah · II4091 — Tugas 02 Bab II (revisi) · 3 perubahan"]);
  });

  it("nothing compared changed: no notification, and the bell lists it quietly", async () => {
    const app = await start();
    app.world.edunex.editTask(117003, {});
    await app.until("2026-10-08T09:10:00+07:00");
    expect(app.of("taskEdited")).toEqual([]);
    const history = app.engine.snapshot().datasets.find((d) => d.name === "app.alerts")?.value as { items: { kind: string }[] } | undefined;
    expect((history?.items ?? []).map((i) => i.kind)).not.toContain("taskEdited");
  });

  it("speaks English", async () => {
    const app = await start();
    await app.engine.updateSettings({ lang: "en" });
    app.world.edunex.moveDeadline(117010, "2026-11-02T23:59:00+07:00");
    app.world.edunex.editTask(117003, { description: "<p>Revisi.</p>", is_lateable: false });
    await app.until("2026-10-08T09:10:00+07:00");
    const history = app.engine.snapshot().datasets.find((d) => d.name === "app.alerts")?.value as { items: Alert[] };
    const alerts = history.items.filter((a) => a.kind === "taskEdited");
    expect(alerts.map((a) => `${translate("en", a.title.key, a.title.vars)} — ${a.body ? translate("en", a.body.key, a.body.vars) : ""}`).sort()).toEqual([
      "Deadline moved to Mon, 2 Nov, 23:59 · II4091 — Tugas 03 Bab III",
      "Task edited · II4091 — Tugas 02 Bab II · 2 changes",
    ]);
  });

  it("turned off in Settings (Changes): no notification, still in the history", async () => {
    const app = await start();
    await app.engine.updateSettings({ mutedAlerts: ["changes"] });
    app.world.edunex.editTask(117003, { description: "<p>Revisi.</p>" });
    await app.until("2026-10-08T09:30:00+07:00");
    expect(app.of("taskEdited")).toEqual([]);
    const history = app.engine.snapshot().datasets.find((d) => d.name === "app.alerts")?.value as { items: { kind: string }[] };
    expect(history.items.map((i) => i.kind)).toContain("taskEdited");
  });
});

describe("material posted for today's class", () => {
  it("a course meeting later today: at once, with the material's title and the class time, once", async () => {
    const app = await start();
    app.world.edunex.postMaterial(95001, { name: "Slide pertemuan 7" });
    await app.until("2026-10-08T08:50:00+07:00");
    const shown = app.of("newMaterial");
    expect(shown.map((n) => n.text)).toEqual(["Materi untuk kuliah hari ini · PL3002 — Slide pertemuan 7 · kuliah 13:00"]);
    expect(shown[0]).toMatchObject({ source: "edunex", count: 1, target: { screen: "course", code: "PL3002", tab: "modules" } });
    // Well before the materials' hourly rhythm: Edunex's feed signalled it.
    expect(shown[0].shownAt - wib("2026-10-08T08:40:00")).toBeLessThan(5 * MINUTE);
    await app.until("2026-10-08T11:00:00+07:00");
    expect(app.of("newMaterial")).toHaveLength(1);
  });

  it("a course that doesn't meet today: Edunex's own feed announces it, as before", async () => {
    const app = await start();
    app.world.edunex.postMaterial(95059, { name: "K6. Pembiayaan" });
    await app.until("2026-10-08T09:00:00+07:00");
    expect(app.of("newMaterial").map((n) => n.text)).toEqual(["Materi baru · PL3032 — K6. Pembiayaan"]);
  });
});
