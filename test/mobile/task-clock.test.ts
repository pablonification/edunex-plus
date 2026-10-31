// Tugas's clock (mobile/src/screens/tasks/task-clock.tsx): a minute's tick reaches the list only when the list can
// look different, so the rows aren't all drawn again each minute for nothing.
import { describe, expect, it } from "vitest";
import { byMoments, momentsOf } from "../../mobile/src/screens/tasks/task-clock";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
// Thu 8 Oct 2026, 08:07 WIB (the demo's morning).
const START = Date.UTC(2026, 9, 8, 1, 7);

function setup(moments: number[]) {
  let now = START;
  const parents = new Set<() => void>();
  const parent = {
    now: () => now,
    subscribe(listener: () => void) {
      parents.add(listener);
      return () => void parents.delete(listener);
    },
  };
  const clock = byMoments(parent, () => moments);
  let ticks = 0;
  clock.subscribe(() => ticks++);
  const passTo = (at: number) => {
    now = at;
    for (const listener of parents) listener();
  };
  return { clock, passTo, ticks: () => ticks };
}

describe("Tugas's clock", () => {
  it("lets a minute pass when nothing on the list is near", () => {
    const due = START + 3 * 24 * HOUR;
    const { clock, passTo, ticks } = setup([due]);
    passTo(START + MINUTE);
    passTo(START + 2 * MINUTE);
    expect(ticks()).toBe(0);
    expect(clock.now()).toBe(START);
  });

  it("ticks when a deadline passes, and every minute in the hour before it", () => {
    const due = START + 2 * HOUR;
    const { clock, passTo, ticks } = setup([due]);
    passTo(START + MINUTE);
    expect(ticks()).toBe(0);
    passTo(due - 30 * MINUTE);
    expect(ticks()).toBe(1);
    passTo(due - 29 * MINUTE);
    expect(ticks()).toBe(2);
    passTo(due + MINUTE);
    expect(ticks()).toBe(3);
    expect(clock.now()).toBe(due + MINUTE);
  });

  it("ticks the day before a deadline, at midnight, and after a quarter of an hour anyway", () => {
    const due = START + 30 * HOUR;
    const { passTo, ticks } = setup([due]);
    passTo(due - 24 * HOUR + MINUTE);
    expect(ticks()).toBe(1);
    passTo(due - 24 * HOUR + 15 * MINUTE + MINUTE);
    expect(ticks()).toBe(2);
    // 08:07 + 15:53 = midnight WIB.
    const { passTo: pass2, ticks: ticks2 } = setup([]);
    pass2(START + 15 * HOUR + 53 * MINUTE + MINUTE);
    expect(ticks2()).toBe(1);
  });

  it("finds the moments a list's items carry, an object deep", () => {
    const items = [
      { kind: "task", at: 1, task: { dueAt: 2, opensAt: 3, title: "x" } },
      { kind: "period", at: 4, week: { start: 5, end: 6 } },
    ];
    expect(momentsOf(items, [7]).sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });
});
