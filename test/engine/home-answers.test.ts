// Beranda's three answers (src/core/needs.ts): "Sekarang" (the class going
// on or next, where its attendance counts, the Presence open for it),
// "Perlu perhatianmu" without anything "Sekarang" or "Hari ini" already
// shows, and the bell's history, which "Yang berubah" previews.
import { describe, expect, it } from "vitest";
import type { Alert, Bill, CalendarEvent, KrsPlan } from "../../src/core/models";
import { alertFeed, attention, type HomeWorld, needsYou, nowCard, recentChanges, todayPlan } from "../../src/core/needs";
import { startHome } from "./needs-harness";

const at = (iso: string) => Date.parse(`${iso}+07:00`);
const ids = (world: HomeWorld) => attention(world, nowCard(world)).map((n) => n.id);

describe("Sekarang", () => {
  it("the class going on, said plainly: SIX counts it, so being in class is enough; Edunex's open window is optional", async () => {
    const h = await startHome();
    const card = nowCard(h.home())!;
    expect(card.state).toBe("live");
    expect(card.class).toMatchObject({ session: { courseCode: "PL3002", room: "R.SG PWK LT.6", end: at("2026-10-08T10:00:00") }, countedIn: "six" });
    // The window is there, but it doesn't count: it's a quiet extra, not the thing to do.
    expect(card.presence).toMatchObject({ code: "PL3002", counts: false, url: "https://edunex.itb.ac.id/courses/95001" });
    expect(card.after).toMatchObject({ courseCode: "DK4073", start: at("2026-10-08T11:00:00") });
  });

  it("between classes: the next one today; another course's open window stays in Perlu perhatianmu", async () => {
    const h = await startHome();
    const id = h.world.edunex.schedulePresence(92948, 84725, { start: "2026-10-08T13:00:00+07:00", end: "2026-10-08T14:30:00+07:00" });
    await h.refresh();
    await h.until("2026-10-08T10:30:00+07:00");
    expect(nowCard(h.home())).toMatchObject({ state: "next", class: { session: { courseCode: "DK4073" } }, presence: null });
    // KU5014's window opens between classes, but SIX counts KU5014: it doesn't push PL3032 off the card; it's a quiet row.
    await h.until("2026-10-08T13:01:00+07:00");
    const card = nowCard(h.home())!;
    expect(card).toMatchObject({ state: "next", class: { session: { courseCode: "PL3032" } }, presence: null });
    expect(attention(h.home(), card).find((n) => n.id === `presence:${id}`)).toMatchObject({ countedIn: "six" });
  });

  it("no class left today: the next one this week", async () => {
    const h = await startHome();
    await h.until("2026-10-08T18:00:00+07:00");
    const card = nowCard(h.home())!;
    expect(card.state).toBe("later");
    expect(card.class!.session.start).toBeGreaterThan(at("2026-10-09T00:00:00"));
    expect(card.after).toBeNull();
  });

  it("a window that counts for the class going on: handing in the Task is the thing to do", async () => {
    const h = await startHome({ now: "2026-10-16T15:01:00" });
    const card = nowCard(h.home())!;
    expect(card.presence).toMatchObject({ code: "II4091", activity: "assignment", task: { id: 117003 } });
    expect(card.presence!.counts).toBe(true);
    expect(card).toMatchObject({ state: "live", class: { session: { courseCode: "II4091" } } });
    // The card speaks for it: the list doesn't repeat it.
    expect(ids(h.home())).not.toContain("presence:2243740");
  });

  it("without SIX: no class is guessed, an open window alone, and where it counts isn't guessed either", async () => {
    const h = await startHome();
    const world: HomeWorld = { ...h.home(), schedule: null, courses: h.home().courses.map((c) => ({ ...c, six: null })) };
    expect(nowCard(world)).toMatchObject({ state: "presence", class: null, presence: { code: "PL3002", counts: null } });
  });
});

describe("Perlu perhatianmu", () => {
  it("never repeats today: classes, their 'no absences left', today's and tomorrow's meetings stay in Hari ini; a target out of reach stays", async () => {
    const h = await startHome();
    const world = h.home();
    // needsYou still has them all.
    expect(needsYou(world).map((n) => n.id)).toEqual(expect.arrayContaining(["presence:2194342", "class:2153983", "class:2194402"]));
    expect(ids(world)).toEqual(["attendance:KU5014:out"]);
    // Tomorrow's II4091 meeting is in Hari ini's "Besok".
    expect(todayPlan(world).announced.map((m) => m.code)).toEqual(["II4091"]);
  });

  it("a Task due tonight is in Hari ini only; the one edited after handing in is in the list", async () => {
    const h = await startHome();
    const tonight = h.world.edunex.postTask(95059, { name: "Ringkasan K5", end_at: "2026-10-08T23:59:00+07:00" });
    const week = h.world.edunex.postTask(95001, { name: "Proposal", end_at: "2026-10-13T23:59:00+07:00" });
    h.world.edunex.editTask(117432, { description: "<p>Tambahkan referensi.</p>" });
    await h.refresh();
    const world = h.home();
    expect(todayPlan(world).due.map((t) => t.id)).toEqual([tonight]);
    expect(ids(world)).not.toContain(`task:${tonight}`);
    expect(ids(world)).toEqual(expect.arrayContaining([`task:${week}`, "task:117432:edited"]));
  });

  it("KRS not sent while ITB's DRS window is open, and UKT due within the week", async () => {
    const h = await startHome();
    const base = h.home();
    const drs = { kind: "drs", term: "2030-1", title: "DRS", start: at("2026-10-07T00:00:00"), end: at("2026-10-09T00:00:00"), firstDay: "2026-10-07", lastDay: "2026-10-08" } as CalendarEvent;
    const krs = { term: "2030-1", state: "not-sent", courses: [], plan: { sentAt: null, approvedAt: null, legalizedAt: null }, change: null } as unknown as KrsPlan;
    const bill = { term: "2026-1", amount: 5_000_000, paid: 0, status: "unpaid", dueDate: "2026-10-12", dueAt: at("2026-10-12T23:59:59"), instalments: [], nextDueAt: at("2026-10-12T23:59:59") } as Bill;
    const world: HomeWorld = { ...base, krs, bills: [bill], calendar: { ...base.calendar!, events: [...base.calendar!.events, drs] } };
    const found = needsYou(world).filter((n) => n.kind === "krs" || n.kind === "bill");
    expect(found).toMatchObject([
      { id: "krs:2030-1", band: "now", open: true, action: { kind: "go", route: { screen: "plan", tab: "krs" } } },
      { id: "bill:2026-1", band: "soon", overdue: false, action: { kind: "go", route: { screen: "plan", tab: "bills" } } },
    ]);
    // Sent: nothing to do.
    expect(needsYou({ ...world, krs: { ...krs, state: "sent" } as KrsPlan, bills: [{ ...bill, status: "paid", nextDueAt: null }] }).some((n) => n.kind === "krs" || n.kind === "bill")).toBe(false);
  });
});

describe("the bell and Yang berubah", () => {
  it("after a silent first sync the history is empty, yet the bell shows what the data shows: the same items as Yang berubah", async () => {
    const h = await startHome();
    const history = h.dataset("app.alerts")?.items ?? [];
    const world = h.home();
    const changes = recentChanges(world, history);
    expect(changes.length).toBeGreaterThan(0);
    const feed = alertFeed(world, history);
    for (const change of changes) expect(feed.map((a) => a.id)).toContain(change.id);
  });

  it("every alert raised lands in the bell too (reminders included), once, newest first", async () => {
    const h = await startHome();
    const world = h.home();
    const reminder: Alert = { id: "deadline:1", kind: "deadline", source: "edunex", at: world.now - 60_000, title: { key: "alert.due3", vars: { course: "PL3002" } }, body: null, target: { screen: "tasks" } };
    const feed = alertFeed(world, [reminder, reminder]);
    expect(feed.filter((a) => a.id === "deadline:1")).toHaveLength(1);
    expect(feed.map((a) => a.at)).toEqual([...feed.map((a) => a.at)].sort((a, b) => b - a));
    // Yang berubah lists changes only: a reminder isn't one.
    expect(recentChanges(world, [reminder]).some((a) => a.id === "deadline:1")).toBe(false);
  });

  it("an alert raised moments ago shows even before the screen's minute has ticked over", async () => {
    const h = await startHome();
    const world = h.home();
    // The engine raised it 20 s past the screen's last tick: the badge counts it, so the panel lists it.
    const fresh: Alert = { id: "task.new:9", kind: "newTask", source: "edunex", at: world.now + 20_000, title: { key: "alert.newTask", vars: { course: "PL3002" } }, body: null, target: { screen: "tasks" } };
    expect(alertFeed(world, [fresh]).map((a) => a.id)).toContain("task.new:9");
  });
});
