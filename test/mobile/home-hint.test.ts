// Beranda's search hint (mobile/src/screens/home/header.tsx): whole on one line at the largest size the bar's room
// holds, in its own line box, so it sits on the magnifier's centre (shrinking it to fit set it low on an iPhone).
import { describe, expect, it } from "vitest";
import { hintRoom, hintSize } from "../../mobile/src/screens/home/header-hint";
import { translate } from "../../src/core/strings";

describe("Beranda's search hint", () => {
  it("takes the largest size that fits the room, and the smallest when none does", () => {
    expect(hintSize(20, 400)).toBe(16);
    expect(hintSize(26, 200)).toBe(15);
    expect(hintSize(26, 185)).toBe(14);
    expect(hintSize(60, 100)).toBe(13);
  });

  it("fits whole beside the mark and the bell on a 393 pt iPhone and a 360 dp Android, in both languages", () => {
    for (const lang of ["id", "en"] as const) {
      const letters = translate(lang, "mobile.home.searchHint").length;
      for (const width of [393, 360]) {
        const { room } = hintRoom(width);
        expect(letters * 0.5 * hintSize(letters, room), `${lang} at ${width}`).toBeLessThanOrEqual(room);
      }
    }
  });
});
