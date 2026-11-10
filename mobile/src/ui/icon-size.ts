// Which of an icon's drawings to draw at a size (src/ui/icons.tsx): Fluent draws each icon anew for 12, 16, 20, 24,
// 28, 32 and 48 px, its lines as thick as that size wants, so an icon draws the one made for the size nearest its own.

/** One icon's drawings: the size Fluent drew each for (its viewBox), its regular path, its filled path. */
export type Drawn = readonly (readonly [size: number, regular: string, filled: string])[];

/** The drawing made for the size nearest `size` (between two, the bigger: its lines are the finer). */
export function nearest(drawn: Drawn, size: number): Drawn[number] {
  let best = drawn[0];
  for (const row of drawn) if (Math.abs(row[0] - size) <= Math.abs(best[0] - size)) best = row;
  return best;
}
