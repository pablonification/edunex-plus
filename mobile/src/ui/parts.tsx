// A tab's first draw in parts (./tab-clock.tsx): what's at the top first, then what's under it (`<Part at={1}>`), then
// the rest (`at={2}`), each in its own render and commit. Drawn in one piece, a hidden tab's first draw held a
// mid-range phone's JS thread 106–162 ms (Snapdragon 720G): a transition lets a tap or a frame in while React works, but
// the commit (Android's layout of every new view, each text measured) is one block. Beranda at a cold start the same: its
// lower parts come once the first frame is up, not before it (the splash waited ~300 ms for all of Beranda).
//
// When each part comes:
// - a tab drawn ahead on its turn, out of sight: part 0, then one part each time the JS thread is idle;
// - Beranda's first frame: part 0, part 1 as soon as the frame is up, part 2 when idle;
// - a tab opened (in front) before its parts are all in: the rest at once, as the Student is looking.
// No React Native here: tested in Node (test/mobile/parts.test.tsx).
import { createContext, type ReactNode, startTransition, useContext, useEffect, useState } from "react";
import { afterFirstFrame, firstFrameShown } from "../shell/first-frame";

export const LAST_PART = 2;

const Drawn = createContext(LAST_PART);

/** `children` once the screen's first draw has got to part `at` (0: always); `fallback` (nothing by default) until then. */
export function Part({ at, fallback = null, children }: { at: 0 | 1 | 2; fallback?: ReactNode; children: ReactNode }) {
  return <>{useContext(Drawn) >= at ? children : fallback}</>;
}

/** Whether the screen's first draw has got to part `at` (for a list that grows: its first rows, then the rest). */
export function usePart(at: 1 | 2): boolean {
  return useContext(Drawn) >= at;
}

export function PartsProvider({ part, children }: { part: number; children: ReactNode }) {
  return <Drawn.Provider value={part}>{children}</Drawn.Provider>;
}

/** Runs `run` once the JS thread is idle; the returned function cancels it. */
export type WhenIdle = (run: () => void) => () => void;

/** React Native's requestIdleCallback (at most `timeout` ms away), or the next frame without it. */
export function whenIdle(run: () => void, timeout = 500): () => void {
  const g = globalThis as {
    requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
    cancelIdleCallback?: (id: number) => void;
  };
  if (g.requestIdleCallback) {
    const id = g.requestIdleCallback(run, { timeout });
    return () => g.cancelIdleCallback?.(id);
  }
  const id = requestAnimationFrame(run);
  return () => cancelAnimationFrame(id);
}

/**
 * How far the screen's first draw has got (0 to LAST_PART), while `drawn` (the screen draws at all) and `focused` (it's
 * in front). `say` names each part as it starts, for a stall's label (../perf.ts).
 */
export function useParts({
  drawn,
  focused,
  say,
  idle = whenIdle,
}: {
  drawn: boolean;
  focused: boolean;
  say?: (part: number) => void;
  idle?: WhenIdle;
}): number {
  const [part, setPart] = useState(() => (focused && firstFrameShown() ? LAST_PART : 0));
  // Opened while its parts are still coming: the rest now, in one go (not after Beranda's first frame: that waits).
  useEffect(() => {
    if (focused && firstFrameShown()) setPart(LAST_PART);
  }, [focused]);
  useEffect(() => {
    if (!drawn || part >= LAST_PART) return;
    const next = () => {
      say?.(part + 1);
      startTransition(() => setPart((now) => Math.max(now, part + 1)));
    };
    // Beranda's first frame: the next part as soon as it's up, the one after when idle.
    if (!firstFrameShown()) return afterFirstFrame(next);
    return idle(next);
  }, [drawn, part, say, idle]);
  return part;
}
