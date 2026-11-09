// The moment Beranda's first frame is up and the splash goes (./boot.tsx's Ready, the "[startup] shown" line). What the
// Student can't see yet waits for it: the tabs' badges, Beranda's parts below the fold, the last notification's tap,
// the widget. Each was drawn or worked out before the first frame and held the splash up for it (a cold start's
// "store → shown" was ~300 ms of Beranda's first render on a mid-range phone). No React Native here: tested in Node.
import { startTransition, useEffect, useState } from "react";

let shown = false;
const waiting = new Set<() => void>();

/** Whether the first frame is up. */
export function firstFrameShown(): boolean {
  return shown;
}

/** The first frame is up (once, from Ready's frame callback): what waited for it runs now, in the order it asked. */
export function markFirstFrameShown(): void {
  if (shown) return;
  shown = true;
  const due = [...waiting];
  waiting.clear();
  for (const run of due) run();
}

/** `run` once the first frame is up (at once if it is); the returned function takes it back if it hasn't run. */
export function afterFirstFrame(run: () => void): () => void {
  if (shown) {
    run();
    return () => undefined;
  }
  waiting.add(run);
  return () => void waiting.delete(run);
}

/** Whether the first frame is up, turning true in a transition after it: what a part draws then never holds it up. */
export function useFirstFrameShown(): boolean {
  const [up, setUp] = useState(shown);
  useEffect(() => (up ? undefined : afterFirstFrame(() => startTransition(() => setUp(true)))), [up]);
  return up;
}

/** For a test: as at the app's start. */
export function resetFirstFrame(): void {
  shown = false;
  waiting.clear();
}
