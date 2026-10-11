// v2-09 (#77), seam 1: "Needs you" from the real engine's datasets against the
// pretend EduNex, SIX and ITB calendar on a fake clock: what each provider
// raises, in which band, with which action and sources, and the ranking.
import { describe, expect, it } from "vitest";
import { type HomeWorld, type Need, type NeedProvider, needsYou, PROVIDERS } from "../../src/core/needs";
import { wib } from "../pretend/edunex";
import { startHome } from "./needs-harness";

const at = (iso: string) => Date.parse(`${iso}+07:00`);
const summary = (needs: Need[]) => needs.map((n) => `${n.band} ${n.id}`);
const find = (needs: Need[], id: string) => needs.find((n) => n.id === id);

describe("the recorded Thursday morning (8 Oct, 08:12)", () => {
  it("ranks the open Presence first, then today's classes that can't be missed, the meeting only in EduNex, and attendance out of reach", async () => {
    const h = await startHome();
    const needs = needsYou(h.home());
    expect(summary(needs)).toEqual([
      "now presence:2194342",
      "soon class:2153983",
      "soon class:2194402",
      `soon meeting:II4091:${at("2026-10-09T15:00:00")}`,
      "soon attendance:KU5014:out",
    ]);
    expect(needs.map((n) => n.rank)).toEqual([1, 2, 3, 4, 5]);

    // PL3002: EduNex's window is open while SIX's class runs (moved: until 10:00, usually 09:30); SIX counts.
    const presence = needs[0];
    expect(presence).toMatchObject({ kind: "presence", course: "PL3002", open: true, activity: "course", countedIn: "six", sources: ["edunex", "six"], at: at("2026-10-08T09:30:00") });
    expect(presence.action).toEqual({ kind: "open", url: "https://edunex.itb.ac.id/courses/95001", via: "edunex" });
    if (presence.kind !== "presence") throw new Error("not a Presence item");
    expect(presence.class?.room).toBe("R.SG PWK LT.6");
    expect(presence.classMoved).toEqual({ usualStart: at("2026-10-08T08:00:00"), usualEnd: at("2026-10-08T09:30:00"), usualRoom: null });

    // DK4073 4/6 and PL3032 4/7: no absences left before 80%, and both meet later today.
    expect(find(needs, "class:2153983")).toMatchObject({ course: "DK4073", state: "none", absencesLeft: 0, countedIn: "six", sources: ["six"], action: { kind: "go", route: { screen: "course", code: "DK4073", tab: "meetings" } } });

    // II4091's meeting 3 is announced only in an EduNex text, with its Teams link.
    expect(find(needs, `meeting:II4091:${at("2026-10-09T15:00:00")}`)).toMatchObject({ sources: ["edunex"], action: { kind: "open", via: "link", url: expect.stringContaining("teams.microsoft.com") } });

    // KU5014 2/6 can't reach 80% anymore; the meetings left come from SIX's timetable and ITB's last lecture day.
    expect(find(needs, "attendance:KU5014:out")).toMatchObject({ sources: ["six", "itb"], action: { kind: "go", route: { screen: "presence" } } });
  });

  it("speaks only of what it knows: without SIX, nothing is 'not in SIX' and no class or count is guessed", async () => {
    const h = await startHome();
    const world: HomeWorld = { ...h.home(), schedule: null, courses: h.home().courses.map((c) => ({ ...c, six: null })) };
    expect(summary(needsYou(world))).toEqual(["now presence:2194342"]);
  });
});

describe("a Presence window opening midday", () => {
  it("isn't there before it opens, and is on top the minute it does, with the action that counts and when it closes", async () => {
    const h = await startHome();
    const id = h.world.edunex.schedulePresence(92948, 84725, { start: "2026-10-08T12:00:00+07:00", end: "2026-10-08T13:30:00+07:00" });
    await h.refresh();
    await h.until("2026-10-08T11:59:00+07:00");
    expect(find(needsYou(h.home()), `presence:${id}`)).toBeUndefined();
    await h.until("2026-10-08T12:01:00+07:00");
    const needs = needsYou(h.home());
    expect(needs[0]).toMatchObject({ id: `presence:${id}`, band: "now", course: "KU5014", activity: "course", at: at("2026-10-08T13:30:00"), action: { kind: "open", via: "edunex" } });
    await h.until("2026-10-08T13:31:00+07:00");
    expect(find(needsYou(h.home()), `presence:${id}`)).toBeUndefined();
  });

  it("one that counts only by handing in a Task is announced ahead, in place of the Task's own deadline item", async () => {
    const h = await startHome({ now: "2026-10-15T20:00:00+07:00" });
    const needs = needsYou(h.home());
    // II4091's window Fri 16 Oct 15:00–23:59 counts only if Tugas 02 Bab II is handed in inside it.
    expect(find(needs, "presence:2243740")).toMatchObject({ band: "soon", activity: "assignment", task: { id: 117003 }, action: { kind: "go", route: { screen: "task", taskId: 117003 } } });
    expect(find(needs, "task:117003")).toBeUndefined();
    await h.until("2026-10-16T15:01:00+07:00");
    expect(needsYou(h.home())[0]).toMatchObject({ id: "presence:2243740", band: "now", open: true });
  });
});

describe("a deadline at midnight", () => {
  it("due tonight is now, in three days soon, within a week coming up, later not yet; past midnight it's gone unless still accepted", async () => {
    const h = await startHome();
    const tonight = h.world.edunex.postTask(95059, { name: "Ringkasan K5", end_at: "2026-10-08T23:59:00+07:00", is_lateable: false });
    const late = h.world.edunex.postTask(95059, { name: "Refleksi", end_at: "2026-10-08T23:59:00+07:00", is_lateable: true });
    const soon = h.world.edunex.postTask(95001, { name: "Esai", end_at: "2026-10-10T23:59:00+07:00" });
    const week = h.world.edunex.postTask(95001, { name: "Proposal", end_at: "2026-10-14T23:59:00+07:00" });
    const far = h.world.edunex.postTask(95001, { name: "Laporan akhir", end_at: wib(at("2026-10-30T23:59:00")) });
    await h.refresh();
    const bands = () => Object.fromEntries(needsYou(h.home()).filter((n) => n.kind === "task" && n.reason !== "edited").map((n) => [n.id, `${n.band} ${n.kind === "task" ? n.reason : ""}`]));
    expect(bands()).toEqual({ [`task:${tonight}`]: "now due", [`task:${late}`]: "now due", [`task:${soon}`]: "soon due", [`task:${week}`]: "later due" });
    expect(bands()[`task:${far}`]).toBeUndefined();

    await h.until("2026-10-09T00:01:00+07:00");
    expect(bands()).toEqual({ [`task:${late}`]: "now overdue", [`task:${soon}`]: "soon due", [`task:${week}`]: "later due" });

    // Handed in: nothing left to do.
    h.world.edunex.submitOnWebsite(late);
    await h.refresh();
    expect(bands()[`task:${late}`]).toBeUndefined();
  });

  it("a short answer window is now", async () => {
    const h = await startHome();
    const quiz = h.world.edunex.postTask(95001, { name: "Kuis kelas", end_at: wib(h.world.clock.now() + 2 * 3_600_000) });
    await h.refresh();
    expect(find(needsYou(h.home()), `task:${quiz}`)).toMatchObject({ band: "now", reason: "short" });
  });
});

describe("a class moved", () => {
  it("later today off its usual slot: soon, with the usual time and room", async () => {
    const h = await startHome({ now: "2026-10-15T06:00:00+07:00" });
    // PL3002 usually meets Thursdays 08:00–09:30 in R.SG PWK LT.6.
    h.world.six.moveMeeting("2194343", "10:00", "11:30", "9009");
    await h.refresh();
    const moved = find(needsYou(h.home()), "class:2194343");
    expect(moved).toMatchObject({ band: "soon", course: "PL3002", state: "safe", moved: { usualStart: at("2026-10-15T08:00:00"), usualEnd: at("2026-10-15T09:30:00"), usualRoom: "R.SG PWK LT.6" } });
    // An exam later today isn't a class to attend: DK4073's UTS (no absences left) isn't raised here.
    expect(find(needsYou(h.home()), "class:2179909")).toBeUndefined();
    // Within the hour it's "now": time to go.
    await h.until("2026-10-15T09:10:00+07:00");
    expect(find(needsYou(h.home()), "class:2194343")).toMatchObject({ band: "now" });
  });
});

describe("an edit after submitting", () => {
  it("a handed-in Task the lecturer changed is now while EduNex still takes answers, soon once it doesn't, and gone after a week", async () => {
    const h = await startHome();
    // PL3002's Task was handed in on 16 Sep and is due tonight; KU5014's TUGAS 1 closed on 17 Sep.
    h.world.edunex.editTask(117432, { description: "<p>Tambahkan referensi.</p>" });
    h.world.edunex.editTask(117044, { description: "<p>Format baru.</p>" });
    await h.refresh();
    const needs = needsYou(h.home());
    expect(find(needs, "task:117432:edited")).toMatchObject({ band: "now", reason: "edited", action: { kind: "go", route: { screen: "task", taskId: 117432 } } });
    expect(find(needs, "task:117044:edited")).toMatchObject({ band: "soon", reason: "edited" });
    // A week on, with the same data.
    expect(needsYou({ ...h.home(), now: h.world.clock.now() + 7 * 24 * 3_600_000 }).filter((n) => n.id.endsWith(":edited"))).toEqual([]);
  });
});

describe("the ranking", () => {
  const item = (id: string, kind: Need["kind"], band: Need["band"], at: number | null) => ({ id, kind, band, at, course: null, sources: [], action: { kind: "go", route: { screen: "home" } } }) as never;
  const world = { now: 0, target: 80, term: null, courses: [], tasks: [], presence: {}, materials: {}, announcements: {}, schedule: null, calendar: undefined } satisfies HomeWorld;

  it("band first, then the area in the providers' order, then the soonest moment", () => {
    const providers: NeedProvider[] = [
      { area: "presence", needs: () => [item("p-later", "presence", "later", 1)] },
      { area: "task", needs: () => [item("t-now-late", "task", "now", 20), item("t-now-early", "task", "now", 10), item("t-soon", "task", "soon", null)] },
      { area: "attendance", needs: () => [item("a-now", "attendance", "now", 5)] },
    ];
    expect(needsYou(world, providers).map((n) => `${n.rank} ${n.id}`)).toEqual(["1 t-now-early", "2 t-now-late", "3 a-now", "4 t-soon", "5 p-later"]);
  });

  it("nothing in the data: nothing needs the Student", () => {
    expect(needsYou(world, PROVIDERS)).toEqual([]);
  });
});
