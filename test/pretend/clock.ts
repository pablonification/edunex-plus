// A clock tests move by hand. Timers fire in time order, and async work they
// start gets to run before the next one fires.
import type { Clock, TimerHandle } from "../../src/engine/clock";

interface Timer {
  id: number;
  at: number;
  fn: () => void;
}

const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

export class FakeClock implements Clock {
  private timers: Timer[] = [];
  private nextId = 1;

  constructor(private time: number) {}

  static at(iso: string): FakeClock {
    return new FakeClock(Date.parse(iso));
  }

  now(): number {
    return this.time;
  }

  setTimeout(fn: () => void, ms: number): TimerHandle {
    const timer = { id: this.nextId++, at: this.time + Math.max(0, ms), fn };
    this.timers.push(timer);
    return { id: timer.id };
  }

  clearTimeout(handle: TimerHandle): void {
    const id = (handle as { id: number }).id;
    this.timers = this.timers.filter((t) => t.id !== id);
  }

  /** Pending timers, soonest first (for assertions). */
  pending(): number[] {
    return this.timers.map((t) => t.at).sort((a, b) => a - b);
  }

  /** Moves time forward, firing every timer that comes due on the way. */
  async advance(ms: number): Promise<void> {
    const target = this.time + ms;
    await settle();
    for (;;) {
      const due = this.timers.filter((t) => t.at <= target).sort((a, b) => a.at - b.at || a.id - b.id)[0];
      if (!due) break;
      this.timers = this.timers.filter((t) => t !== due);
      this.time = due.at;
      due.fn();
      await settle();
    }
    this.time = target;
    await settle();
  }

  /** Moves to a wall-clock moment, e.g. "2026-10-08T08:00:00+07:00". */
  async advanceTo(iso: string): Promise<void> {
    await this.advance(Math.max(0, Date.parse(iso) - this.time));
  }
}
