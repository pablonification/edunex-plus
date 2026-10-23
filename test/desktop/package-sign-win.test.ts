// The Windows installers' signature (scripts/package-sign-win.mjs, scripts/package-win.mjs). SignPath
// signs on its own servers, between two passes of the build: the first keeps each uninstaller aside
// as electron-builder makes it, the second puts the signed one back in its place. A test can't run
// electron-builder or SignPath: these check what decides which file gets which signature, and a
// release build checks the signatures themselves with Windows.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import config, { WINDOWS_ARM_INSTALLER } from "../../electron-builder.config.mjs";
import {
  isUninstaller,
  mustBeSigned,
  PROGRAMS_TO_SIGN,
  signatureSize,
  swapUninstaller,
  uninstallerHook,
  uninstallerNames,
  uninstallerStep,
} from "../../scripts/package-sign-win.mjs";

/** The smallest Windows program header that says where its signature is: `signed` bytes of certificate table, or none. */
function program(signed: number, plus = true, body = "the program"): Buffer {
  const pe = Buffer.alloc(0x200);
  pe.write("MZ", 0, "latin1");
  pe.writeUInt32LE(0x80, 0x3c);
  pe.write("PE\0\0", 0x80, "latin1");
  const optional = 0x80 + 24;
  pe.writeUInt16LE(plus ? 0x20b : 0x10b, optional);
  const security = optional + (plus ? 112 : 96) + 4 * 8;
  pe.writeUInt32LE(signed ? 0x180 : 0, security);
  pe.writeUInt32LE(signed, security + 4);
  return Buffer.concat([pe, Buffer.from(body)]);
}

describe("the Windows installers' signature", () => {
  it("is left alone without the two-pass build: local builds and forks stay unsigned, as before", () => {
    expect(uninstallerStep({})).toBeNull();
    expect(uninstallerStep({ WINDOWS_KEEP_UNINSTALLERS: " ", WINDOWS_SIGNED_UNINSTALLERS: "" })).toBeNull();
    // The config these tests load was read without them: no sign hook, so electron-builder signs nothing.
    expect(config.win?.signtoolOptions).toBeUndefined();
    expect(config.win?.azureSignOptions).toBeUndefined();
  });

  it("keeps the uninstallers aside in the first pass, and puts the signed ones in in the second", () => {
    const list = "release/uninstallers.json";
    expect(uninstallerStep({ WINDOWS_KEEP_UNINSTALLERS: "release/to-sign", WINDOWS_UNINSTALLERS_LIST: list })).toEqual({
      step: "keep",
      folder: "release/to-sign",
      list,
    });
    expect(uninstallerStep({ WINDOWS_SIGNED_UNINSTALLERS: "release/signed", WINDOWS_UNINSTALLERS_LIST: list })).toEqual({
      step: "swap",
      folder: "release/signed",
      list,
    });
    expect(() => uninstallerStep({ WINDOWS_KEEP_UNINSTALLERS: "a", WINDOWS_SIGNED_UNINSTALLERS: "b", WINDOWS_UNINSTALLERS_LIST: list })).toThrow(
      "two different passes",
    );
    expect(() => uninstallerStep({ WINDOWS_KEEP_UNINSTALLERS: "a" })).toThrow("WINDOWS_UNINSTALLERS_LIST");
  });

  it("puts no elevate.exe in the app, so the signed app folder gets nothing unsigned added when the installers are made from it", () => {
    expect(config.nsis?.packElevateHelper).toBe(false);
    expect(config.nsis?.perMachine).toBe(false);
  });

  it("knows the two uninstallers the build makes, so pass 1 stops if it didn't keep both", () => {
    expect(uninstallerNames([config.nsis?.artifactName as string, WINDOWS_ARM_INSTALLER], "1.2.0")).toEqual([
      "Edunex-Plus-Setup-1.2.0.__uninstaller.exe",
      "Edunex-Plus-1.2.0-arm64.__uninstaller.exe",
    ]);
  });

  it("tells the uninstaller electron-builder makes from the app and the installer", () => {
    expect(isUninstaller("release/Edunex-Plus-Setup-1.2.0.__uninstaller.exe")).toBe(true);
    expect(isUninstaller("release/Edunex-Plus-1.2.0-arm64.__uninstaller.exe")).toBe(true);
    expect(isUninstaller("release/Edunex-Plus-Setup-1.2.0.exe")).toBe(false);
    expect(isUninstaller("release/win-unpacked/Edunex Plus.exe")).toBe(false);
  });

  it("reads whether a Windows program carries a signature, 32- or 64-bit", () => {
    expect(signatureSize(program(0))).toBe(0);
    expect(signatureSize(program(9000))).toBe(9000);
    expect(signatureSize(program(9000, false))).toBe(9000);
    expect(() => signatureSize(Buffer.from("#!/bin/sh\n"))).toThrow("Not a Windows program");
  });
});

describe("the uninstaller between the two passes", () => {
  let dir: string;
  const at = (...parts: string[]) => path.join(dir, ...parts);
  const name = "Edunex-Plus-Setup-1.2.0.__uninstaller.exe";
  let log: string[];

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "uninstallers-"));
    fs.mkdirSync(at("release"));
    log = [];
    vi.spyOn(console, "log").mockImplementation((line: string) => void log.push(line));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  /** Pass 1 as electron-builder runs it: the uninstaller made in release/ and handed to the hook. */
  async function firstPass(uninstaller: Buffer) {
    fs.writeFileSync(at("release", name), uninstaller);
    await uninstallerHook({ step: "keep", folder: at("to-sign"), list: at("uninstallers.json") })({ path: at("release", name) });
  }
  /** What SignPath sends back: the same uninstaller, now carrying a signature. */
  const signedBack = () => fs.writeFileSync(at("to-sign", name), program(4096));
  const secondPass = () => swapUninstaller(at("release", name), at("to-sign"), at("uninstallers.json"));

  it("is kept aside as it was made, and its sha512 noted outside what goes to be signed", async () => {
    await firstPass(program(0));
    expect(fs.readFileSync(at("to-sign", name))).toEqual(program(0));
    expect(Object.keys(JSON.parse(fs.readFileSync(at("uninstallers.json"), "utf8")))).toEqual([name]);
  });

  it("comes back signed, in place of the uninstaller electron-builder makes again for the installer", async () => {
    await firstPass(program(0));
    signedBack();
    await secondPass();
    expect(fs.readFileSync(at("release", name))).toEqual(program(4096));
    expect(log.at(-1)).toContain("madeAgain=identical");
  });

  it("goes in all the same when electron-builder made it differently from the signed app, and says so", async () => {
    await firstPass(program(0));
    signedBack();
    fs.writeFileSync(at("release", name), program(0, true, "the same script, another app archive"));
    await secondPass();
    expect(fs.readFileSync(at("release", name))).toEqual(program(4096));
    expect(log.at(-1)).toContain("madeAgain=different bytes");
  });

  it("stops the build when an uninstaller wasn't kept, or came back without a signature", async () => {
    await firstPass(program(0));
    await expect(secondPass()).rejects.toThrow("came back without a signature");
    await expect(swapUninstaller(at("release", "Other.__uninstaller.exe"), at("to-sign"), at("uninstallers.json"))).rejects.toThrow(
      "No uninstaller named Other.__uninstaller.exe",
    );
    await expect(mustBeSigned(at("to-sign", name))).rejects.toThrow("without a signature");
  });

  it("lets every other file through the hook untouched: the app and the installer are signed elsewhere", async () => {
    fs.writeFileSync(at("Edunex-Plus-Setup-1.2.0.exe"), program(0));
    await uninstallerHook({ step: "keep", folder: at("to-sign"), list: at("uninstallers.json") })({ path: at("Edunex-Plus-Setup-1.2.0.exe") });
    expect(fs.existsSync(at("to-sign"))).toBe(false);
    expect(fs.existsSync(at("uninstallers.json"))).toBe(false);
  });
});

describe("signing a release with SignPath", () => {
  const read = (file: string) => fs.readFileSync(path.join(import.meta.dirname, "../..", file), "utf8");
  const workflow = read(".github/workflows/release.yml");
  const programs = read(".signpath/windows-programs.xml");
  const installers = read(".signpath/windows-installers.xml");
  // electron-builder's names, ${version} left as it is: SignPath writes its own parameter the same way.
  // biome-ignore lint/suspicious/noTemplateCurlyInString: electron-builder's own ${…} names
  const installer = (artifactName: string) => artifactName.replace("${ext}", "exe");
  const names = [config.nsis?.artifactName as string, WINDOWS_ARM_INSTALLER];

  it("happens only for a version tag, once SignPath's settings exist; a release without them is unsigned, as before", () => {
    expect(workflow).toContain('if [[ "$GITHUB_REF" != refs/tags/* ]]; then');
    expect(workflow).toContain('elif [ -n "$SIGNPATH_API_TOKEN" ] && [ -n "$SIGNPATH_ORGANIZATION_ID" ]; then');
    expect(workflow).toContain('elif [ "$WINDOWS_SIGNING" = none ]; then\n            npm run package:win\n');
  });

  it("asks SignPath for the two configurations kept in .signpath/", () => {
    expect(workflow).toContain("artifact-configuration-slug: windows-programs\n");
    expect(workflow).toContain("artifact-configuration-slug: windows-installers\n");
  });

  it("names in each configuration exactly the files the build puts aside, and nothing else", () => {
    const includes = (xml: string) => [...xml.matchAll(/<include path="([^"]+)" \/>/g)].map((match) => match[1]).sort();
    // As SignPath writes its own parameter.
    // biome-ignore lint/suspicious/noTemplateCurlyInString: SignPath's ${version} parameter
    const version = "${version}";
    expect(includes(programs)).toEqual([...Object.values(PROGRAMS_TO_SIGN), ...uninstallerNames(names, version)].sort());
    expect(includes(installers)).toEqual(names.map(installer).sort());
  });

  it("writes the signed installers' sha512 into the update info before the release keeps them", () => {
    const rewrite = workflow.indexOf("run: node scripts/update-info.mjs release");
    expect(rewrite).toBeGreaterThan(workflow.indexOf("name: Sign the installers (Windows; approve it in SignPath)"));
    expect(rewrite).toBeLessThan(workflow.indexOf("name: Keep the installers"));
  });
});
