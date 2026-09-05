import { describe, expect, it } from "vitest";
import { shouldFireStartupTestNotification } from "./notifications";

describe("shouldFireStartupTestNotification", () => {
  it("fires in dev builds so every boot re-proves the signed-shell carve-out", () => {
    expect(shouldFireStartupTestNotification(false, {})).toBe(true);
  });

  it("does not fire in packaged builds", () => {
    expect(shouldFireStartupTestNotification(true, {})).toBe(false);
  });

  it("can be skipped in dev with EDUNEX_SKIP_TEST_NOTIFICATION=1", () => {
    expect(
      shouldFireStartupTestNotification(false, { EDUNEX_SKIP_TEST_NOTIFICATION: "1" }),
    ).toBe(false);
  });
});
