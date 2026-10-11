// Each course gets a color as its identity (dots, bars, the sidebar). The
// color comes from the course code, so it stays the same across launches;
// two courses of the same term never share one while the palette lasts.

export const COURSE_COLORS = ["#2F7CF6", "#7C5CFC", "#1FA971", "#F2884B", "#E0559A", "#14A3B8", "#D7A20F", "#E5484D"] as const;

function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function courseColors(codes: readonly string[]): Map<string, string> {
  const colors = new Map<string, string>();
  const taken = new Set<number>();
  for (const code of [...new Set(codes)].sort()) {
    let index = hash(code) % COURSE_COLORS.length;
    for (let step = 0; step < COURSE_COLORS.length && taken.has(index); step++) index = (index + 1) % COURSE_COLORS.length;
    taken.add(index);
    colors.set(code, COURSE_COLORS[index]);
  }
  return colors;
}
