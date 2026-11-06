// The demo build's clock for the screens (./boot.tsx): the demo's world runs on its own time, ahead of the phone's.
import type { UiClock } from "../../../src/app/i18n";

/**
 * The demo's time as the screens read it: the system's, moved by the demo's offset read live. The demo plays its start
 * on fast after the first frame (an after-class scenario runs the day from 07:30 to 16:05), so an offset taken once at
 * boot left every screen in the morning while the data was the afternoon's: no class on now, Task edits and attendance
 * from later in the day left out (Check A, run 41499018655). Read each second, a new minute, or a jump, is passed on
 * at once; otherwise as the app's minute clock (systemClock), one tick a minute.
 */
export function demoClock(offset: () => number): UiClock {
  const read = () => Date.now() + offset();
  const minute = (at: number) => Math.floor(at / 60_000);
  let current = read();
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setInterval> | null = null;
  const poll = () => {
    const at = read();
    if (minute(at) === minute(current)) return;
    current = at;
    for (const listener of listeners) listener();
  };
  return {
    // With nobody listening, nothing polls: read afresh.
    now: () => (timer ? current : (current = read())),
    subscribe(listener) {
      listeners.add(listener);
      timer ??= setInterval(poll, 1_000);
      return () => {
        listeners.delete(listener);
        if (!listeners.size && timer) {
          clearInterval(timer);
          timer = null;
        }
      };
    },
  };
}
