// The first run (docs/design-system.md, Motion): the welcome screen, its reading
// step and the first-run scan are seen once, so they are where the app's
// delight goes. Their parts come in one after another, rising into place and
// into focus, instead of all at once; a title comes in a word at a time; the
// app's mark comes into focus as it grows, with a ring leaving it and its light
// coming up behind. Everywhere else screens and rows appear at once:
// test/app/ui-rules.test.ts keeps these classes in this file, and this file to
// the first run.
//
// CSS animations (styles.css), not element.animate: they run off the main
// thread, so they stay smooth while the window is busy signing in and reading.
// With Reduce motion on, nothing moves (motion-safe).
import type { CSSProperties } from "react";

/** From one part starting to the next. */
export const ARRIVAL_STAGGER = 60;

/** A part rising into place; give it its turn with `arriveAt`. */
export const ARRIVE = "motion-safe:animate-arrive";
/** The app's mark coming into focus as it grows, first. */
export const ARRIVE_MARK = "motion-safe:animate-arrive-mark";
/** One word of a title (each an inline-block), a few apart. */
export const ARRIVE_WORD = "motion-safe:animate-arrive-word";
/** A whole block of the welcome screen (its card, its button), further and slower than a line. */
export const ARRIVE_SCENE = "motion-safe:animate-arrive-scene";

/** When the `step`th part (0 first) starts, `after` ms in. */
export function arriveAt(step: number, after = 0, stagger = ARRIVAL_STAGGER): CSSProperties {
  return { animationDelay: `${after + step * stagger}ms` };
}

/** From one word of a title starting to the next. */
export const WORD_STAGGER = 70;
