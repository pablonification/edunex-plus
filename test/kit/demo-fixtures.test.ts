// The phone's demo reads the recordings from a bundle (mobile/src/demo/fixtures.ts, which Metro puts
// in place of ./fixtures.ts): it must give the pretend world exactly what the disk gives, for every
// recorded exchange.
import { execFileSync } from "node:child_process";
import path from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import * as disk from "./fixtures";
import type { System } from "./recordings";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
let phone: typeof import("../../mobile/src/demo/fixtures");

beforeAll(async () => {
  // As `npm run demo:fixtures` makes it before a demo build.
  execFileSync(process.execPath, [path.join(ROOT, "mobile", "scripts", "demo-fixtures.mjs")], { stdio: "ignore" });
  phone = await import("../../mobile/src/demo/fixtures");
});

const SYSTEMS: System[] = ["edunex", "six"];

describe("the demo's recordings on the phone", () => {
  it("list every exchange the disk lists, the same way", () => {
    for (const system of SYSTEMS) {
      expect(disk.exchanges(system).length).toBeGreaterThan(0);
      expect(phone.exchanges(system)).toEqual(disk.exchanges(system));
    }
  });

  it("answer every recorded exchange exactly as the disk does", () => {
    let checked = 0;
    for (const system of SYSTEMS)
      for (const one of disk.exchanges(system)) {
        expect(phone.bodyText(system, one.file), one.file).toBe(disk.bodyText(system, one.file));
        expect(phone.exchange(system, one.path, one.query)).toEqual(disk.exchange(system, one.path, one.query));
        if (system === "edunex") expect(phone.edunexJson(one.path, one.query)).toEqual(disk.edunexJson(one.path, one.query));
        else expect(phone.sixPage(one.path)).toBe(disk.sixPage(one.path));
        checked++;
      }
    expect(checked).toBe(disk.exchanges("edunex").length + disk.exchanges("six").length);
  });

  it("serve ITB's public pages and calendar as the disk does, and say so for a recording that was never made", () => {
    for (const name of ["kur2024", "kur2024-154", "kur2024-174", "kur2024-182"]) expect(phone.publicPage(name)).toBe(disk.publicPage(name));
    expect(phone.calendarFeed()).toBe(disk.calendarFeed());
    expect(() => phone.exchange("six", "/never/recorded")).toThrow("No recorded six response for /never/recorded {}");
    expect(() => phone.publicPage("kur2099")).toThrow(/demo:fixtures/);
  });

  it("bundle every recorded file", async () => {
    const { default: recorded } = await import("../../mobile/src/demo/recorded");
    const files = disk.allFixtureFiles().map((file) => path.relative(disk.FIXTURES_DIR, file).split(path.sep).join("/"));
    expect(Object.keys(recorded).sort()).toEqual(files.sort());
  });
});
