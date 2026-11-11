// The guide's few facts that live outside React, small enough for any screen to import: the real parts the tour
// points at (a screen hands its view over with `guidePart`), whether the Student asked for the tour (Settings ›
// Tentang, the invitation's "Mulai panduan", the demo's link), and the demo's switch for the invitation. Nothing
// is imported here but a type, so a screen pays one Map entry for its part and a start pays nothing.
import { useSyncExternalStore } from "react";
import type { GuidePartId } from "./steps";

/** What a part's view can do for the tour: say where it is in the window. */
export interface Measurable {
  measureInWindow(callback: (x: number, y: number, width: number, height: number) => void): void;
}

const parts = new Map<string, Measurable>();
const refs = new Map<string, (view: Measurable | null) => void>();

/**
 * The `ref` for the view the tour points at as `id` (the view's own testID): `<View ref={guidePart("home.grid")} />`.
 * The same function every time, so a redraw doesn't hand the view over again.
 */
export function guidePart(id: GuidePartId): (view: Measurable | null) => void {
  let ref = refs.get(id);
  if (!ref) {
    ref = (view) => {
      if (view) parts.set(id, view);
      else parts.delete(id);
    };
    refs.set(id, ref);
  }
  return ref;
}

/** The view on screen for a part, if its page shows it right now. */
export const guidePartView = (id: string): Measurable | undefined => parts.get(id);

let running = false;
let offers = true;
const watchers = new Set<() => void>();
const tell = () => {
  for (const watcher of watchers) watcher();
};
const subscribe = (watcher: () => void) => {
  watchers.add(watcher);
  return () => void watchers.delete(watcher);
};

/** Starts the tour now, whether or not it was taken before (Settings › Tentang, "Mulai panduan", the demo's link). */
export function startGuide(): void {
  if (running) return;
  running = true;
  tell();
}

/** The tour is over (its last step, or skipped). */
export function endGuide(): void {
  if (!running) return;
  running = false;
  tell();
}

export const guideRunning = () => running;

/** True while the tour runs. */
export function useGuideRunning(): boolean {
  return useSyncExternalStore(subscribe, guideRunning);
}

/**
 * The demo's switch: whether the invitation may show by itself. The demo starts past it (its flows and pictures are
 * of the app, not of the invitation) unless its link says EDUNEX_DEMO_GUIDE=1 (../../demo/world.ts).
 */
export function setGuideOffers(value: boolean): void {
  if (value === offers) return;
  offers = value;
  tell();
}

export function useGuideOffers(): boolean {
  return useSyncExternalStore(subscribe, () => offers);
}

/** For tests: as at a start. */
export function resetGuide(): void {
  running = false;
  offers = true;
  parts.clear();
  tell();
}
