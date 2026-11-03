// Jadwal's ⋮ "Kalender HP" (mobile/src/screens/schedule/calendar-plan.ts): what the phone's Edunex Plus calendar
// holds, over which days, and when it's written again, from the real engine against the pretend Edunex and SIX on the
// recorded Thursday (8 October 2026).
import { describe, expect, it } from "vitest";
import { calendarPlan, needsWrite } from "../../mobile/src/screens/schedule/calendar-plan";
import { snapshotDataset } from "../../src/core/home-world";
import { startHome } from "../engine/needs-harness";

type Home = Awaited<ReturnType<typeof startHome>>;
const planOf = (h: Home) => calendarPlan((name) => snapshotDataset(h.engine.snapshot(), name) as never, "id", "2026-10-08");

describe("the phone's calendar, kept current", () => {
  it("holds the term's classes, exams, deadlines and ITB's days, from a week ago to the term's last UAS day", async () => {
    const h = await startHome();
    const plan = planOf(h);
    expect(plan.days.from).toBe("2026-10-01");
    expect(plan.days.until).toMatch(/^2026-12-\d\d$/);
    const kinds = new Set(plan.items.map((item) => item.kind));
    expect([...kinds].sort()).toEqual(expect.arrayContaining(["classes", "deadlines", "itb"]));
    // Today's class, with its room, as the event.
    expect(
      plan.items.find((item) => item.kind === "classes" && item.summary.includes("PL3002") && item.start === Date.parse("2026-10-08T08:00:00+07:00")),
    ).toMatchObject({
      location: "R.SG PWK LT.6",
    });
    expect(plan.items.every((item) => item.end > plan.span.from && item.start < plan.span.until)).toBe(true);
  });

  it("is written again when Jadwal changes (a Task posted), and not when nothing did", async () => {
    const h = await startHome();
    const before = planOf(h);
    expect(planOf(h).key).toBe(before.key);
    expect(needsWrite({ on: true, busy: false, problem: null, written: before.key }, before.key)).toBe(false);
    h.world.edunex.postTask(95059, { name: "Ringkasan K5", end_at: "2026-10-20T23:59:00+07:00" });
    await h.refresh();
    const after = planOf(h);
    expect(after.key).not.toBe(before.key);
    expect(after.items.some((item) => item.summary.includes("Ringkasan K5"))).toBe(true);
    expect(needsWrite({ on: true, busy: false, problem: null, written: before.key }, after.key)).toBe(true);
  });

  it("isn't written while off, already writing, or stopped by a problem the Student has to fix", () => {
    for (const sync of [
      { on: false, busy: false, problem: null, written: null },
      { on: true, busy: true, problem: null, written: null },
      { on: true, busy: false, problem: "denied", written: null },
    ])
      expect(needsWrite(sync, "k")).toBe(false);
  });
});
