import { describe, expect, it } from "vitest";
import { sanitizeWindowState } from "./window-state";

const WORK_AREA = { width: 1512, height: 982 };

describe("sanitizeWindowState", () => {
  it("passes through sane bounds", () => {
    expect(
      sanitizeWindowState({ width: 1180, height: 780, x: 10, y: 20 }, WORK_AREA),
    ).toEqual({ width: 1180, height: 780, x: 10, y: 20 });
  });

  it("rejects garbage, non-numeric, and sub-minimum sizes", () => {
    expect(sanitizeWindowState(null, WORK_AREA)).toBeNull();
    expect(sanitizeWindowState("x", WORK_AREA)).toBeNull();
    expect(sanitizeWindowState({}, WORK_AREA)).toBeNull();
    expect(sanitizeWindowState({ width: 100, height: 780 }, WORK_AREA)).toBeNull();
    expect(sanitizeWindowState({ width: Infinity, height: 780 }, WORK_AREA)).toBeNull();
  });

  it("drops positions that would strand the window far off-screen", () => {
    const state = sanitizeWindowState(
      { width: 1180, height: 780, x: -5000, y: 20 },
      WORK_AREA,
    );
    expect(state).toEqual({ width: 1180, height: 780 });
  });

  it("keeps the maximized flag", () => {
    expect(sanitizeWindowState({ width: 1180, height: 780, isMaximized: true }, WORK_AREA))
      .toEqual({ width: 1180, height: 780, isMaximized: true });
  });
});
