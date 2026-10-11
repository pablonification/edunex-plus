// All scheduled work in the engine runs on an injected clock, so tests can
// play out a whole day in milliseconds.

export interface Clock {
  now(): number;
  setTimeout(fn: () => void, ms: number): TimerHandle;
  clearTimeout(handle: TimerHandle): void;
}

export type TimerHandle = { readonly id: number } | ReturnType<typeof setTimeout>;

export const systemClock: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => setTimeout(fn, Math.max(0, ms)),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** Resolves after `ms` on the given clock. */
export function sleep(clock: Clock, ms: number): Promise<void> {
  return new Promise((resolve) => clock.setTimeout(resolve, ms));
}
