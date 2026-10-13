// Motion timings for JS animation (element.animate): the same values as the
// CSS tokens (styles.css: --duration-* in :root, --ease-* in @theme), in the
// Web Animations API's units (milliseconds, CSS easing strings).
// test/app/motion.test.tsx keeps them equal.

/** quick: press, tooltips, popovers, anything leaving, a highlight sliding. base: dialogs, panels opening, a gap closing. slow: numbers changing. */
export const DURATION = { quick: 150, base: 200, slow: 400 } as const;

/** The easing curves' control points, for code that eases by hand (a counting number). */
export const EASE_POINTS = {
  standard: [0.2, 0, 0, 1],
  out: [0.16, 1, 0.3, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

const curve = ([x1, y1, x2, y2]: readonly number[]) => `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;

/** standard for leaving and moving; out (fast start, soft landing) for arriving. Neither overshoots. */
export const EASE = { standard: curve(EASE_POINTS.standard), out: curve(EASE_POINTS.out) } as const;
