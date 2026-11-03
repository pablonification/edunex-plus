// The demo build's clock for the screens (mobile/src/shell/demo-clock.ts): the demo plays its start on fast after the
// first frame, and the screens have to follow it there, not stay at the moment the app booted.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { demoClock } from "../../mobile/src/shell/demo-clock";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const MORNING = Date.parse("2026-10-08T07:30:00+07:00");

describe("demoClock", () => {
  beforeEach(() => vi.useFakeTimers({ now: Date.parse("2026-11-03T10:00:00+07:00") }));
  afterEach(() => vi.useRealTimers());

  it("follows the demo's day played on fast after boot: 07:30 to 16:05, said within a second", () => {
    let world = MORNING;
    const clock = demoClock(() => world - Date.now());
    const heard = vi.fn();
    clock.subscribe(heard);
    expect(clock.now()).toBe(MORNING);
    world = Date.parse("2026-10-08T16:05:00+07:00");
    vi.advanceTimersByTime(1_000);
    expect(heard).toHaveBeenCalledTimes(1);
    expect(clock.now()).toBe(world);
  });

  it("in real time, ticks once a minute, not every second", () => {
    const offset = MORNING - Date.now();
    const clock = demoClock(() => offset);
    const heard = vi.fn();
    clock.subscribe(heard);
    vi.advanceTimersByTime(59_000);
    expect(heard).toHaveBeenCalledTimes(0);
    vi.advanceTimersByTime(2 * MINUTE);
    expect(heard).toHaveBeenCalledTimes(2);
    expect(clock.now()).toBeGreaterThanOrEqual(MORNING + 2 * MINUTE);
  });

  it("with nobody listening, reads the demo's time afresh", () => {
    let world = MORNING;
    const clock = demoClock(() => world - Date.now());
    world += 8 * HOUR;
    expect(clock.now()).toBe(world);
  });
});
