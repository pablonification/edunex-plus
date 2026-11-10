// Kuliah's course cards (mobile/src/screens/presence/course-row.tsx): every course colour's fill keeps what's written
// on it readable, in light and dark: the name 4.5:1, the risk's red and amber 4.5:1, the glyph and dots 3:1.
import { describe, expect, it } from "vitest";
import { cardFill } from "../../mobile/src/screens/presence/logic";
import { COURSE_TILE, GREY_TILE, V4 } from "../../mobile/src/ui/palette";

const luminance = (h: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => Number.parseInt(h.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const contrast = (a: string, b: string) => {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

describe("cardFill", () => {
  const tiles = { ...COURSE_TILE, grey: GREY_TILE };
  for (const [scheme, index] of [
    ["light", 0],
    ["dark", 1],
  ] as const)
    it(`keeps the words and the dots readable on every course colour (${scheme})`, () => {
      const v = V4[scheme];
      for (const tile of Object.values(tiles)) {
        const ink = tile[index];
        const fill = cardFill({ ink, tint: tile[2 + index] }, scheme);
        expect(contrast(v.fg, fill)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(v.redFg, fill)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(v.ambFg, fill)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(ink, fill)).toBeGreaterThanOrEqual(3);
        // The card stands off the page more than the bare tint does.
        expect(contrast(fill, v.page)).toBeGreaterThan(1.15);
      }
    });
});
