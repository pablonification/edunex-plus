// #82: the fuse check that stops a packaged build whose Electron security
// switches came out wrong. The wire is what @electron/fuses reads back from a
// binary: { [fuse index]: state byte }.
import { FuseState, FuseV1Options } from "@electron/fuses";
import { describe, expect, it } from "vitest";
import { fuseProblems } from "../../scripts/package-fuses.mjs";

const { ENABLE: ON, DISABLE: OFF } = FuseState;

/** A binary as electron-builder should leave it. */
const good = (): Record<number, number> => ({
  [FuseV1Options.RunAsNode]: OFF,
  [FuseV1Options.EnableCookieEncryption]: ON,
  [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: OFF,
  [FuseV1Options.EnableNodeCliInspectArguments]: OFF,
  [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: ON,
  [FuseV1Options.OnlyLoadAppFromAsar]: ON,
  [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: OFF,
  [FuseV1Options.GrantFileProtocolExtraPrivileges]: ON,
});

describe("packaged build fuse check", () => {
  it("passes a binary with every switch set", () => {
    expect(fuseProblems(good())).toEqual([]);
  });

  it("fails an unpackaged Electron (Node mode, inspector and NODE_OPTIONS on; no cookie encryption or archive checks)", () => {
    const stock = { ...good(), [FuseV1Options.RunAsNode]: ON, [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: ON, [FuseV1Options.EnableNodeCliInspectArguments]: ON, [FuseV1Options.EnableCookieEncryption]: OFF, [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: OFF, [FuseV1Options.OnlyLoadAppFromAsar]: OFF };
    expect(fuseProblems(stock)).toEqual([
      "RunAsNode is on, should be off",
      "EnableNodeOptionsEnvironmentVariable is on, should be off",
      "EnableNodeCliInspectArguments is on, should be off",
      "EnableCookieEncryption is off, should be on",
      "EnableEmbeddedAsarIntegrityValidation is off, should be on",
      "OnlyLoadAppFromAsar is off, should be on",
    ]);
  });

  it("names a fuse an Electron version removed or never had", () => {
    const wire = good();
    wire[FuseV1Options.RunAsNode] = FuseState.REMOVED;
    delete wire[FuseV1Options.OnlyLoadAppFromAsar];
    expect(fuseProblems(wire)).toEqual(["RunAsNode is removed, should be off", "OnlyLoadAppFromAsar is missing, should be on"]);
  });
});
