// Everything that takes a tap is 48 dp to touch (mobile/DESIGN.md, "Space, shape, targets"): the shared controls are
// drawn smaller and a hitSlop makes up the difference. Their sizes live in mobile/src/ui/sizes.ts, without react-native.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { BUTTON_HEIGHT, CHIP_HEIGHT, LINK_LINE, LINK_SLOP, SEGMENT_HEIGHT, SWITCH, SWITCH_SLOP, slop, slopY, TARGET } from "../../mobile/src/ui/sizes";

/** How tall a part `height` high is to touch with the hitSlop it gets. */
const reach = (height: number) => {
  const s = slopY(height);
  return height + (s ? s.top + s.bottom : 0);
};

describe("touch targets", () => {
  it("is Material's 48, the same as theme.ts's TOUCH", () => {
    expect(TARGET).toBe(48);
    const theme = readFileSync(new URL("../../mobile/src/ui/theme.ts", import.meta.url), "utf8");
    expect(theme).toMatch(/export const TOUCH = 48;/);
  });

  it("makes every button size 48 to touch", () => {
    for (const height of Object.values(BUTTON_HEIGHT)) expect(reach(height)).toBeGreaterThanOrEqual(TARGET);
  });

  it("makes the filter chip and the segmented button 48 to touch", () => {
    expect(reach(CHIP_HEIGHT)).toBe(TARGET);
    expect(reach(SEGMENT_HEIGHT)).toBe(TARGET);
  });

  it("makes the drawn switch 48 each way", () => {
    expect(SWITCH.height + 2 * SWITCH_SLOP).toBeGreaterThanOrEqual(TARGET);
    expect(SWITCH.width + 2 * SWITCH_SLOP).toBeGreaterThanOrEqual(TARGET);
  });

  it("makes a text link 48 high, and 48 wide for a word of 24 dp", () => {
    expect(LINK_LINE + LINK_SLOP.top + LINK_SLOP.bottom).toBeGreaterThanOrEqual(TARGET);
    expect(24 + LINK_SLOP.left + LINK_SLOP.right).toBeGreaterThanOrEqual(TARGET);
  });

  it("adds nothing to what is already 48 or more", () => {
    expect(slop(TARGET)).toBe(0);
    expect(slop(56)).toBe(0);
    expect(slopY(56)).toBeUndefined();
    expect(slop(16)).toBe(16);
  });
});
