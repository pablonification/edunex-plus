// The strip's first tile, under its date: the Task's own name and hour on one line ("Tugas 02, 23:59").

/** The letters a tile's label holds on one line at font size 1.3 (the kit shrinks it a little, then cuts it). */
const LABEL = 14;

/**
 * A Task's name as short as a tile's one line holds, with its hour when both fit: "Tugas 02, 23:59". The name is the
 * title up to its first ":" (or " - ", "("), and of that a kind and its number when it starts so ("Tugas 02" of
 * "Tugas 02 Bab II"), else its whole words up to the line's length.
 */
export function tileName(title: string, time: string): string {
  const head = (title.split(/:| - | – |\(/)[0] ?? title).trim();
  const numbered = head.match(/^\p{L}+ \d+/u)?.[0];
  let name = numbered ?? head;
  if (name.length > LABEL) {
    let short = "";
    for (const word of name.split(/\s+/)) {
      if (`${short} ${word}`.trim().length > LABEL) break;
      short = `${short} ${word}`.trim();
    }
    name = short || name;
  }
  return name.length + time.length + 2 <= LABEL + 1 ? `${name}, ${time}` : name;
}
