// The first run (docs/design-system.md, Motion): the welcome screen, its reading
// step, the app's first look after them and the first-run scan are seen once,
// so they are where the app's delight goes. Their parts come in one after
// another, 60 ms apart, rising 8 px into place (the app's mark grows in from
// 90%), instead of all at once. Everywhere else screens and rows appear at
// once: test/app/ui-rules.test.ts keeps these classes in this file, and this
// file to the first run.
//
// CSS animations (styles.css), not element.animate: they run off the main
// thread, so they stay smooth while the window is busy signing in and reading.
// With Reduce motion on, nothing moves (motion-safe).
import type { CSSProperties } from "react";

/** From one part starting to the next. */
export const ARRIVAL_STAGGER = 60;

/** A part of the first run rising into place; give it its turn with `arriveAt`. */
export const ARRIVE = "motion-safe:animate-arrive";
/** The app's mark growing in, first. */
export const ARRIVE_MARK = "motion-safe:animate-arrive-mark";
/** The whole app, the first time it shows after the welcome screen. */
export const ARRIVE_APP = "motion-safe:animate-arrive-app";

/** When the `step`th part (0 first) starts, `after` ms in. */
export function arriveAt(step: number, after = 0): CSSProperties {
  return { animationDelay: `${after + step * ARRIVAL_STAGGER}ms` };
}
