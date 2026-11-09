// What a course's absence meter draws (./attendance-meter.tsx), apart from how: a segment per absence the target
// allows, the used ones filled; past the limit a short line, then a red segment per absence over it.

/** The bar's numbers: allowed, used of them, over the limit; `estimate` before SIX counts (dashed rings, nothing used). */
export interface MeterBar {
  allowed: number;
  used: number;
  over: number;
  estimate: boolean;
}

/** From this many allowed the segments join into one bar, split where the used part ends; the most red ones drawn. */
export const JOINED = 8;

/** The segments to draw. A target that allows no absence still draws the limit's line and a red one per absence. */
export function meterMarks(bar: MeterBar | null): { allowed: number; joined: boolean; over: number } | null {
  if (!bar || (bar.allowed <= 0 && bar.over <= 0)) return null;
  return { allowed: Math.max(bar.allowed, 0), joined: bar.allowed >= JOINED, over: Math.min(bar.over, JOINED) };
}
