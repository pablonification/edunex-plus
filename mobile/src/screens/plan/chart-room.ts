// How much of the chart's width its end label takes, past the line's last point. Pure (./chart.tsx draws).

/**
 * The room kept after the plot for the text at the line's end: the whole label ("3,54 saat lulus") when it fits in a
 * fifth of the chart, else only what its figure ("3,54") takes. Never a share of the width with nothing drawn in it:
 * the plot runs to what is drawn at its end.
 */
export function endRoomFor(width: number, endLabel: string | undefined, figure: string | undefined, textWidth: (text: string) => number): number {
  if (!endLabel) return 0;
  const whole = textWidth(endLabel);
  if (whole <= width * 0.22) return whole;
  return figure ? Math.min(whole, textWidth(figure)) : 0;
}
