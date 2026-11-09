// Beranda's "Perlu kamu urus" and Notifikasi on the real phone (round 3): the courses at or past their absence limit and
// the clashes come before any Task (mobile/src/screens/home/problems.ts, firstRows); a saved "class moved"
// about SIX's roomless copy of a Task's hand-in window never shows (src/core/schedule.ts isHandInMove), so no screen
// says a time the Task page contradicts; and a notification's time is when the thing happened, never the read's
// (mobile/src/parts/change-meta.ts eventTime).
import { describe, expect, it } from "vitest";
import { eventTime } from "../../mobile/src/parts/change-meta";
import { firstRows, problems } from "../../mobile/src/screens/home/problems";
import type { Alert } from "../../src/core/models";
import { alertFeed, homeContext, recentChanges } from "../../src/core/needs";
import { startHome } from "../engine/needs-harness";

const wib = (iso: string) => Date.parse(`${iso}+07:00`);

describe("Perlu kamu urus", () => {
  it("leads with the demo's three courses at or past the limit, worst first, then Thursday's clash", async () => {
    const { home } = await startHome();
    const found = problems(homeContext(home()));
    expect(found.absences.map((a) => `${a.code} ${a.health.state}`)).toEqual(["KU5014 out", "DK4073 none", "PL3032 none"]);
    expect(found.clashes.map((c) => c.key)).toEqual(["KU5014+PL3032"]);
  });

  it("keeps room for the first thing to do, however many problems there are", () => {
    const row = (kind: "absence" | "clash" | "todo", key: string) => ({ kind, key });
    const all = [
      row("absence", "a1"),
      row("absence", "a2"),
      row("absence", "a3"),
      row("absence", "a4"),
      row("clash", "c1"),
      row("todo", "t1"),
      row("todo", "t2"),
    ];
    expect(firstRows(all, 5).map((r) => r.key)).toEqual(["a1", "a2", "a3", "a4", "t1"]);
    expect(firstRows(all.slice(0, 5), 5).map((r) => r.key)).toEqual(["a1", "a2", "a3", "a4", "c1"]);
    expect(firstRows([row("clash", "c1"), row("todo", "t1"), row("todo", "t2")], 5).map((r) => r.key)).toEqual(["c1", "t1", "t2"]);
  });
});

describe("Notifikasi", () => {
  const moved = (course: string, start: number, end: number, room: string): Alert => ({
    id: `schedule.moved:2299013:${start}:${end}:${room}`,
    kind: "scheduleChanged",
    source: "six",
    at: wib("2026-11-10T00:45:00"),
    title: { key: "alert.moved", vars: { course } },
    body: { key: "alert.moved.body", vars: { oldId: "", oldEn: "", newId: "15:00–17:00", newEn: "15:00–17:00" } },
    target: { screen: "schedule" },
  });

  it("never shows a saved 'class moved' for SIX's copy of a Task's hand-in window: the Task page keeps Edunex's 15:00–23:59", async () => {
    const { home } = await startHome({ now: "2026-11-10T09:00:00+07:00" });
    const world = home();
    const window = world.presence.II4091?.find((p) => p.id === 2243746);
    expect(window?.closesAt).toBe(wib("2026-11-13T23:59:00"));
    // Saved before the engine stopped raising it: II4091's Friday 13 November, 15:00–17:00, no room.
    const stale = moved("II4091", wib("2026-11-13T15:00:00"), wib("2026-11-13T17:00:00"), "");
    // A real class moved, with its room, stays.
    const real = moved("PL3002", wib("2026-11-13T08:00:00"), wib("2026-11-13T10:00:00"), "R.SG PWK LT.6");
    const ids = (items: readonly Alert[]) => items.map((a) => a.id);
    expect(ids(alertFeed(world, [stale, real]))).not.toContain(stale.id);
    expect(ids(alertFeed(world, [stale, real]))).toContain(real.id);
    expect(ids(recentChanges(world, [stale, real]))).not.toContain(stale.id);
  });

  it("dates a row by when the thing happened, and leaves a moved class undated rather than say the read's time", async () => {
    const { home } = await startHome();
    const world = home();
    const task = world.tasks.find((one) => one.postedAt !== null)!;
    const raisedAt = wib("2026-10-08T00:45:00");
    const newTask: Alert = { ...moved("PL3002", 0, 0, ""), id: `task.new:${task.id}`, kind: "newTask", at: raisedAt };
    expect(eventTime(newTask, true, world)).toBe(task.postedAt);
    expect(eventTime({ ...newTask, id: `task.edited:${task.id}:1791400000000`, kind: "taskEdited" }, true, world)).toBe(1791400000000);
    expect(eventTime({ ...newTask, id: "presence.open:2194342:1791421200000", kind: "presenceOpen" }, true, world)).toBe(1791421200000);
    expect(eventTime({ ...newTask, id: "material.new:CONTENT:42:2026-09-15T03:54:44.000Z", kind: "newMaterial" }, true, world)).toBe(
      Date.parse("2026-09-15T03:54:44.000Z"),
    );
    // SIX never says when a class moved: no time at all, raised or read off the data.
    expect(eventTime(moved("PL3002", 0, 0, "x"), true, world)).toBeNull();
    expect(eventTime(moved("PL3002", 0, 0, "x"), false, world)).toBeNull();
    expect(eventTime({ ...newTask, id: "grade:2026-1:PL3002:A", kind: "grade" }, true, world)).toBeNull();
  });
});
