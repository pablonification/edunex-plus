// The sizes of what takes a tap, and the hitSlop that makes each 48 dp to touch however small it looks (DESIGN.md,
// "Space, shape, targets"). Kept free of react-native so the tests can read the numbers (test/mobile/touch-targets).

/** The least a finger can hit (Material's 48 dp): theme.ts's TOUCH, here without react-native. */
export const TARGET = 48;

/** What a part `size` dp across adds on each side to be 48 to touch. */
export function slop(size: number): number {
  return Math.max(0, (TARGET - size) / 2);
}

/** A hitSlop above and below for a part `height` dp high; none once it's 48. */
export function slopY(height: number): { top: number; bottom: number } | undefined {
  const s = slop(height);
  return s > 0 ? { top: s, bottom: s } : undefined;
}

/** Button heights: M3 Expressive's XS, S (the default) and M. */
export const BUTTON_HEIGHT = { sm: 32, md: 40, lg: 56 } as const;

/** The filter chip, 32 high. */
export const CHIP_HEIGHT = 32;

/** A segmented button, 40 high. */
export const SEGMENT_HEIGHT = 40;

/** The switch drawn in JS (the native one is 52×48 itself). */
export const SWITCH = { width: 52, height: 32 } as const;
/** Around the drawn switch, each side. */
export const SWITCH_SLOP = 8;

/** A tappable word in a line of small text (Body M, 20 high). */
export const LINK_LINE = 20;
/** Around it: 48 high, and 48 wide for a word of 24 dp or more. */
export const LINK_SLOP = { top: slop(LINK_LINE), bottom: slop(LINK_LINE), left: 12, right: 12 } as const;
