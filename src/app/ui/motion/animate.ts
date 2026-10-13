// JS animation in the kit goes through here: the browser's own Web Animations
// API (element.animate), no library, as T3 Code does. Transform and opacity
// run off the main thread; the few heights (a disclosure, a leaving row, a
// toast's gap) are one small element each, clipped only while they move.
//
// A piece asks `animate` and gets null when it should jump to the end instead:
// with Reduce motion on in the OS (the CSS rule in styles.css doesn't reach
// element.animate), with animations skipped (tests), or where there is no
// element.animate (jsdom).
import { DURATION, EASE } from "./tokens";

let skipped = false;

/** Tests: every JS animation ends at once, so what leaves is gone when the test looks. */
export function skipAnimations(skip: boolean) {
  skipped = skip;
}

/** Whether nothing should move: Reduce motion is on in the OS, or animations are skipped. Asked each time, so a change of the setting counts at once. */
export function stillMotion(): boolean {
  return skipped || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

const animationsOff = () => stillMotion() || typeof Element.prototype.animate !== "function";

/** element.animate, or null (and nothing done) when animations are off. */
export function animate(element: Element, keyframes: Keyframe[], options: KeyframeAnimationOptions): Animation | null {
  return animationsOff() ? null : element.animate(keyframes, options);
}

const SPACE = ["height", "paddingTop", "paddingBottom", "borderTopWidth", "borderBottomWidth", "marginTop", "marginBottom"] as const;

/**
 * Something leaving a stack (a row, a toast) fades, then the space it took
 * closes, so what's after it slides into place instead of jumping. Clip it
 * while it goes. `gone` runs once the space is closed. Returns a stop for an
 * unmount or a change of mind, or null (and `gone` not run) when animations
 * are off.
 */
export function leave(element: HTMLElement, gone: () => void): (() => void) | null {
  if (animationsOff()) return null;
  const now = getComputedStyle(element);
  const space: Keyframe = {};
  const closed: Keyframe = {};
  for (const side of SPACE) {
    space[side] = now[side];
    closed[side] = "0px";
  }
  // Both hold their end until the element is taken away, so it never flashes back for a frame.
  const fade = element.animate([{ opacity: now.opacity }, { opacity: 0 }], { duration: DURATION.quick, easing: EASE.standard, fill: "forwards" });
  const close = element.animate([space, closed], { duration: DURATION.base, delay: DURATION.quick * 0.6, easing: EASE.standard, fill: "forwards" });
  close.onfinish = gone;
  return () => {
    close.onfinish = null;
    fade.cancel();
    close.cancel();
  };
}
