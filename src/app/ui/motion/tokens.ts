// Motion timings for JS animation (element.animate): the same values as the
// CSS tokens (styles.css: --duration-* in :root, --ease-* in @theme), in the
// Web Animations API's units (milliseconds, CSS easing strings).
// test/app/motion.test.tsx keeps them equal.

/** quick: press, tooltips, popovers, anything leaving, a highlight sliding. base: dialogs, panels opening, a gap closing. slow: numbers changing, the welcome screen's mark gliding. */
export const DURATION = { quick: 150, base: 200, slow: 400 } as const;

/** The easing curves' control points, for code that eases by hand (a counting number). */
export const EASE_POINTS = {
  standard: [0.2, 0, 0, 1],
  out: [0.16, 1, 0.3, 1],
  scene: [0.32, 0.72, 0, 1],
} as const satisfies Record<string, readonly [number, number, number, number]>;

const curve = ([x1, y1, x2, y2]: readonly number[]) => `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;

/**
 * A spring, sampled: it overshoots a little (about 5%) and settles, like the Dynamic Island. Only the welcome
 * screen's pills, a shape changing to fit new words; ISLAND_MS long.
 */
const ISLAND =
  "linear(0, 0.052, 0.175, 0.33, 0.492, 0.641, 0.769, 0.87, 0.946, 0.999, 1.032, 1.049, 1.056, 1.054, 1.048, 1.04, 1.031, 1.022, 1.015, 1.009, 1.004, 1.001, 0.999, 0.997, 1)";
/** How long the island spring takes to settle. */
export const ISLAND_MS = 650;

/** standard for leaving and moving; out (fast start, soft landing) for arriving; scene (off at once, a long soft landing) for the first run's camera moves. None of those overshoots; island, the welcome's pills, does. */
export const EASE = {
  standard: curve(EASE_POINTS.standard),
  out: curve(EASE_POINTS.out),
  scene: curve(EASE_POINTS.scene),
  island: ISLAND,
} as const;
