// A figure that changes while the Student watches (the IPK after picking
// another grade, absences left after a recount) counts to its new value in
// 400 ms, so the eye sees that it moved, which way and by about how much.
//
// Ported from motion-primitives' Animated Number
// (github.com/ibelick/motion-primitives, MIT, © 2024 ibelick), with the fixes
// this app needs:
// - The page's text is always the true value. The count runs in a copy laid
//   over it (aria-hidden) while the real value waits underneath, unseen, so a
//   screen reader, a live region, a test or a copy never meets an in-between
//   number, such as an IPK that was never real.
// - A tween that never overshoots (the original sprang past the value and back).
// - The app's own formatting (decimals, "3,45" in Indonesian) through `format`,
//   instead of whole numbers in the system's locale.
// - No component made during render (the original's motion.create(as) made a
//   new element type, and remounted, on every render).
// - At once on first show, with Reduce motion, and with animations off (tests).
// Text can't be tweened by element.animate, so it counts in animation frames.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { cx } from "../cx";
import { stillMotion } from "./animate";
import { DURATION, EASE_POINTS } from "./tokens";

/** A CSS cubic-bezier curve as a function of time (0 to 1): finds the curve's t for that time by halving, then reads its height. */
function curve([x1, y1, x2, y2]: readonly number[]) {
  const at = (p1: number, p2: number, t: number) => 3 * p1 * t * (1 - t) ** 2 + 3 * p2 * t ** 2 * (1 - t) + t ** 3;
  return (time: number) => {
    let low = 0;
    let high = 1;
    for (let step = 0; step < 24; step++) {
      const middle = (low + high) / 2;
      if (at(x1, x2, middle) < time) low = middle;
      else high = middle;
    }
    return at(y1, y2, (low + high) / 2);
  };
}

const easeOut = curve(EASE_POINTS.out);

export function AnimatedNumber({ value, format = String, className }: { value: number; format?: (value: number) => string; className?: string }) {
  const overlay = useRef<HTMLSpanElement>(null);
  /** The number on screen right now, mid-count included, so a new value counts on from there. */
  const shown = useRef(value);
  const formatter = useRef(format);
  const [counting, setCounting] = useState(false);
  useEffect(() => {
    formatter.current = format;
  });

  // Before paint, so the new value never flashes up for a frame before the count starts.
  useLayoutEffect(() => {
    const from = shown.current;
    if (from === value) return;
    if (stillMotion()) {
      shown.current = value;
      setCounting(false);
      return;
    }
    setCounting(true);
    const start = performance.now();
    let frame = requestAnimationFrame(function step(now) {
      // Reduce motion turned on mid-count: straight to the end.
      const progress = stillMotion() ? 1 : Math.min(1, (now - start) / DURATION.slow);
      shown.current = progress < 1 ? from + (value - from) * easeOut(progress) : value;
      if (overlay.current) overlay.current.textContent = formatter.current(shown.current);
      if (progress < 1) frame = requestAnimationFrame(step);
      else setCounting(false);
    });
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return (
    <span className={cx("inline-grid tabular-nums", className)}>
      <span className={cx("[grid-area:1/1]", counting && "opacity-0")}>{format(value)}</span>
      {counting && (
        <span ref={overlay} aria-hidden className="[grid-area:1/1]">
          {format(shown.current)}
        </span>
      )}
    </span>
  );
}
