// The phone app's build number (mobile/scripts/build-number.js), Android's versionCode and the iPhone's buildNumber:
// Android installs an update only over a lower one, so every release, alpha to beta to rc to the release and on to
// the next patch, must come out higher than the one before.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { buildNumber } from "../../mobile/scripts/build-number.js";

describe("the phone app's build number", () => {
  it("is worked out from the repository's version", () => {
    expect(buildNumber("0.1.0-alpha.34")).toBe(100_034);
    expect(buildNumber("0.1.0-beta.1")).toBe(100_301);
    expect(buildNumber("0.1.0-rc.2")).toBe(100_602);
    expect(buildNumber("0.1.0")).toBe(100_999);
    expect(buildNumber("0.1.1-alpha.1")).toBe(101_001);
    expect(buildNumber("1.0.0")).toBe(10_000_999);
  });

  it("goes up with every release, in the order they come", () => {
    const releases = [
      "0.1.0-alpha.1",
      "0.1.0-alpha.9",
      "0.1.0-alpha.10",
      "0.1.0-alpha.34",
      "0.1.0-alpha.299",
      "0.1.0-beta.0",
      "0.1.0-beta.12",
      "0.1.0-rc.1",
      "0.1.0-rc.299",
      "0.1.0",
      "0.1.1-alpha.1",
      "0.1.1",
      "0.1.99",
      "0.2.0-alpha.1",
      "0.99.99",
      "1.0.0-alpha.1",
      "1.0.0",
      "2.3.4",
    ];
    const numbers = releases.map(buildNumber);
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
    expect(new Set(numbers).size).toBe(releases.length);
  });

  it("refuses a version it can't number rather than guess", () => {
    for (const version of ["0.1", "v0.1.0", "0.1.0-alpha", "0.1.0-dev.1", "0.1.0+build.5", "0.1.0-alpha.300", "0.1.0-rc.300", "0.100.0", "0.1.100", "210.0.0"])
      expect(() => buildNumber(version), version).toThrow("Can't make a build number");
  });

  it("numbers the version the repository is at now, above the 1 every build carried before", () => {
    const { version } = JSON.parse(fs.readFileSync(path.resolve(import.meta.dirname, "../../package.json"), "utf8")) as { version: string };
    expect(buildNumber(version)).toBeGreaterThan(1);
  });
});
