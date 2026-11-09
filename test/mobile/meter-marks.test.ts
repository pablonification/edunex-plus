// A course's absence meter (mobile/src/parts/meter-marks.ts): past the limit it draws a red segment per absence over
// it, also for a target that allows none at all.
import { describe, expect, it } from "vitest";
import { meterMarks } from "../../mobile/src/parts/meter-marks";

describe("meterMarks", () => {
  it("draws the red over-limit marks when the target allows no absence", () => {
    expect(meterMarks({ allowed: 0, used: 0, over: 2, estimate: false })).toEqual({ allowed: 0, joined: false, over: 2 });
  });

  it("draws the allowed ones, joined from eight, and at most eight red ones", () => {
    expect(meterMarks({ allowed: 3, used: 1, over: 0, estimate: false })).toEqual({ allowed: 3, joined: false, over: 0 });
    expect(meterMarks({ allowed: 9, used: 9, over: 12, estimate: false })).toEqual({ allowed: 9, joined: true, over: 8 });
  });

  it("draws nothing with no absence allowed and none over", () => {
    expect(meterMarks({ allowed: 0, used: 0, over: 0, estimate: false })).toBeNull();
    expect(meterMarks(null)).toBeNull();
  });
});
