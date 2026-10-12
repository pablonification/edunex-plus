// "Remind me later" (Ingatkan nanti), seam 1: the rules on Beranda's real
// items, built by the real engine from the pretend Edunex and SIX on the
// Monday of the UTS week, on a fake clock. What identifies an item, which
// changes bring it back, what it can be put off until, and that every snooze
// ends.
import { describe, expect, it } from "vitest";
import type { SnoozeEntry } from "../../src/core/models";
import { type Need, needsYou } from "../../src/core/needs";
import {
  activeSnooze,
  attendanceKey,
  LONGEST,
  partitionSnoozed,
  pruneSnoozes,
  type SnoozeKey,
  snoozable,
  snoozeChoices,
  snoozeKey,
} from "../../src/core/snooze";
import { startHome } from "./needs-harness";

const MONDAY = "2026-10-12T08:07:00+07:00";
const at = (iso: string) => Date.parse(`${iso}+07:00`);
const need = (needs: Need[], id: string) => {
  const found = needs.find((n) => n.id === id || n.id.startsWith(`${id}:`));
  if (!found) throw new Error(`No ${id} in ${needs.map((n) => n.id).join(", ")}`);
  return found;
};
/** The choices offered for an item at `now`, as "kind until". */
const offered = (item: Need, now: number) => snoozeChoices(snoozable(item, now), now).map((c) => `${c.kind} ${new Date(c.until).toISOString()}`);
const iso = (local: string) => new Date(at(local)).toISOString();
/** "In 3 hours" from the clock (signing in to SIX takes the fake clock a few seconds past 08:07). */
const inThreeHours = (now: number) => `hours ${new Date(now + 3 * 3_600_000).toISOString()}`;

describe("what brings a snoozed item back", () => {
  it("a Task: the same id, but new facts when the deadline moves or it turns urgent", async () => {
    const h = await startHome({ now: MONDAY });
    const id = h.world.edunex.postTask(95059, { name: "Ringkasan K6", end_at: "2026-10-14T23:59:00+07:00" });
    await h.refresh();
    const before = snoozeKey(need(needsYou(h.home()), `task:${id}`));
    expect(before.id).toBe(`task:${id}`);

    h.world.edunex.moveDeadline(id, "2026-10-15T23:59:00+07:00");
    await h.refresh();
    const moved = snoozeKey(need(needsYou(h.home()), `task:${id}`));
    expect(moved.id).toBe(before.id);
    expect(moved.facts).not.toBe(before.facts);

    // Within a day it's "now": urgent enough to come back, though nothing else changed.
    await h.until("2026-10-15T08:00:00+07:00");
    const urgent = need(needsYou(h.home()), `task:${id}`);
    expect(urgent.band).toBe("now");
    expect(snoozeKey(urgent).facts).not.toBe(moved.facts);
  });

  it("attendance: one id for Beranda and the course page, new facts when SIX records another meeting", async () => {
    const h = await startHome({ now: MONDAY });
    const ku = need(needsYou(h.home()), "attendance:KU5014");
    expect(snoozeKey(ku)).toEqual({ id: "attendance:KU5014", facts: "out|2/6|80" });
    expect(attendanceKey("KU5014", { state: "out", attended: 2, held: 6 }, 80)).toEqual(snoozeKey(ku));

    h.world.six.setAttendance("KU5014", 2, 7);
    await h.refresh();
    expect(snoozeKey(need(needsYou(h.home()), "attendance:KU5014")).facts).toBe("out|2/7|80");

    // The course's own target, not the default: changing it brings the item back too.
    await h.engine.updateSettings({ attendanceTargets: { KU5014: 85 } });
    expect(snoozeKey(need(needsYou(h.home()), "attendance:KU5014")).facts).toBe("out|2/7|85");
  });
});

describe("what an item can be put off until", () => {
  it("a Task to hand in during a Presence window: when it opens, Friday 15:00", async () => {
    const h = await startHome({ now: MONDAY });
    const now = h.world.clock.now();
    const ahead = need(needsYou(h.home()), "presence:2243740");
    expect(offered(ahead, now)).toEqual([
      inThreeHours(now),
      `morning ${iso("2026-10-13T07:00:00")}`,
      // "Until something changes" would end at the same moment: offered once.
      `opens ${iso("2026-10-16T15:00:00")}`,
    ]);
  });

  it("an exam: the day before, and until something changes ends on the exam's morning", async () => {
    const h = await startHome({ now: MONDAY });
    const now = h.world.clock.now();
    const exam = need(needsYou(h.home()), "exam:DK4073-UTS");
    expect(offered(exam, now)).toEqual([
      inThreeHours(now),
      `morning ${iso("2026-10-13T07:00:00")}`,
      `dayBefore ${iso("2026-10-14T07:00:00")}`,
      `change ${iso("2026-10-15T06:00:00")}`,
    ]);
  });

  it("attendance: before the next class, or until the count changes, two weeks at most", async () => {
    const h = await startHome({ now: MONDAY });
    const now = h.world.clock.now();
    const ku = need(needsYou(h.home()), "attendance:KU5014");
    expect(offered(ku, now)).toEqual([
      inThreeHours(now),
      `morning ${iso("2026-10-13T07:00:00")}`,
      `beforeClass ${iso("2026-10-15T15:00:00")}`,
      // Two weeks out, on a morning.
      `change ${iso("2026-10-26T07:00:00")}`,
    ]);
  });

  it("a Task due tonight: nothing past three hours before the deadline, and no 'until something changes'", async () => {
    const h = await startHome({ now: MONDAY });
    const id = h.world.edunex.postTask(95059, { name: "Kuis", end_at: "2026-10-12T17:00:00+07:00" });
    await h.refresh();
    const now = h.world.clock.now();
    const task = need(needsYou(h.home()), `task:${id}`);
    expect(task.band).toBe("now");
    expect(offered(task, now)).toEqual([inThreeHours(now)]);

    // Two hours later, less than half an hour of putting off is left: nothing to offer.
    await h.until("2026-10-12T13:45:00+07:00");
    expect(offered(need(needsYou(h.home()), `task:${id}`), h.world.clock.now())).toEqual([]);
  });

  it("every choice ends by the item's last useful moment and within two weeks", async () => {
    const h = await startHome({ now: MONDAY });
    const now = h.world.clock.now();
    for (const item of needsYou(h.home())) {
      const { cap } = snoozable(item, now);
      for (const choice of snoozeChoices(snoozable(item, now), now)) {
        expect(choice.until - now).toBeGreaterThanOrEqual(30 * 60_000);
        expect(choice.until).toBeLessThanOrEqual(Math.min(cap ?? Number.POSITIVE_INFINITY, now + LONGEST));
      }
    }
  });
});

describe("which items a list still shows", () => {
  const key: SnoozeKey = { id: "task:1", facts: "due|soon|100" };
  const entry = (patch: Partial<SnoozeEntry> = {}): SnoozeEntry => ({ ...key, until: 2_000, ...patch });

  it("holds an item back only with the same id and facts, until its time", () => {
    expect(activeSnooze(key, [entry()], 1_000)).toEqual(entry());
    expect(activeSnooze(key, [entry({ facts: "due|now|100" })], 1_000)).toBeUndefined();
    expect(activeSnooze(key, [entry()], 2_000)).toBeUndefined();
    const items = [key, { id: "task:2", facts: "x" }];
    const { shown, snoozed } = partitionSnoozed(items, (item) => item, [entry()], 1_000);
    expect(shown).toEqual([{ id: "task:2", facts: "x" }]);
    expect(snoozed).toEqual([{ item: key, entry: entry() }]);
  });

  it("forgets what's over, and keeps the newest when the list grows long", () => {
    expect(pruneSnoozes([entry({ until: 500 }), entry({ id: "b" })], 1_000)).toEqual([entry({ id: "b" })]);
    const many = Array.from({ length: 300 }, (_, i) => entry({ id: `t${i}` }));
    const kept = pruneSnoozes(many, 1_000);
    expect(kept).toHaveLength(200);
    expect(kept.at(-1)?.id).toBe("t299");
  });
});
