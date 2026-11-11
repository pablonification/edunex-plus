// How large Beranda's search hint is drawn (./header.tsx): pure, so a test can hold it to the row's room.

/** A letter's share of its font size in the hint's face (mixed case, measured on the phone): how wide a line runs. */
const LETTER = 0.5;
/** The hint's sizes, largest first; under the smallest it is cut with an ellipsis. */
const HINT_SIZES = [16, 15, 14, 13] as const;

/** The largest size at which a hint of `letters` letters fits `room` dp on one line (the smallest when none does). */
export function hintSize(letters: number, room: number): number {
  return HINT_SIZES.find((size) => letters * LETTER * size <= room) ?? HINT_SIZES[HINT_SIZES.length - 1]!;
}

/** The row's sizes the hint's room depends on (./header.tsx draws with the same ones). */
export const ROW = { margin: 16, item: 44, gap: 12, magnifier: 20 } as const;

/**
 * The search bar's own sides and the gap after its magnifier, and the room that leaves the hint, on a screen `width`
 * dp wide: a narrow phone (360 dp) gives the bar's sides and gap a step less, so the hint still fits whole.
 */
export function hintRoom(width: number): { side: number; gap: number; room: number } {
  const narrow = width < 380;
  const side = narrow ? 12 : 16;
  const gap = narrow ? 8 : 12;
  return { side, gap, room: width - ROW.margin * 2 - ROW.item * 2 - ROW.gap * 2 - (side * 2 + ROW.magnifier + gap) };
}
