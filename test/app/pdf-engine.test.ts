// How sharp a PDF page is drawn: at the screen's own density, until the
// drawing would grow past what one page should cost in memory (zoomed far in
// on a Retina screen) or past the longest side a canvas can have.
import { describe, expect, it } from "vitest";
import { drawingRatio } from "../../src/app/ui/pdf-engine";

/** An A4 page in CSS pixels at this zoom (1 = its printed size). */
const a4 = (zoom: number) => [595 * (96 / 72) * zoom, 842 * (96 / 72) * zoom] as const;

describe("a page's drawing", () => {
  it("is as sharp as the screen at the zooms people read at", () => {
    expect(drawingRatio(...a4(1.5), 2)).toBe(2);
    expect(drawingRatio(...a4(1), 1)).toBe(1);
  });

  it("stays within the memory cap zoomed far in, a little soft instead of hundreds of MB", () => {
    const [width, height] = a4(4);
    const ratio = drawingRatio(width, height, 2);
    expect(ratio).toBeLessThan(2);
    expect(width * ratio * (height * ratio)).toBeLessThanOrEqual(2 ** 25 + 1);
  });

  it("never asks a canvas for a side longer than it can have (a very long page)", () => {
    const ratio = drawingRatio(800, 40_000, 2);
    expect(40_000 * ratio).toBeLessThanOrEqual(32_767);
  });
});
