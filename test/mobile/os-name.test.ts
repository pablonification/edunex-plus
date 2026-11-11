// The phone's system as a report names it (mobile/src/host/os-name.ts): an iPhone is never called Android.
import { describe, expect, it } from "vitest";
import { osName } from "../../mobile/src/host/os-name";

describe("the phone's system, as a report names it", () => {
  it("an iPhone says iOS and its version; Android its API level", () => {
    expect(osName("ios", "26.5")).toBe("iOS 26.5");
    expect(osName("android", 34)).toBe("Android 34");
  });
});
