// How many lines a segment's label may take (./controls.tsx's `Segmented`). Pure, so it's tested on its own.

/**
 * Two for words ("Kalender lengkap" wraps between them), one for a single word or a number: "3,50" never breaks into
 * "3,5" and "0" beside its tick; it's drawn a little smaller instead, if the room is short.
 */
export const segmentLines = (label: string): 1 | 2 => (/\s/.test(label.trim()) ? 2 : 1);
