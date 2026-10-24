// The zip beside each Windows installer on a release (scripts/package-zip-win.mjs): it holds exactly
// the installer beside it, made once that installer is final, and no version of the app ever takes
// it for its update. Read back here by the zip format's own rules, since a test can't open it in
// Windows; the release workflow's Windows job opens it with Windows' own reader too.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { crc32, inflateRawSync } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import config, { WINDOWS_ARM_INSTALLER, WINDOWS_ARM_UPDATE_INFO, WINDOWS_ZIPS } from "../../electron-builder.config.mjs";
import { zipInstallersIn } from "../../scripts/package-zip-win.mjs";
import { type Arch, pickReleaseFile, type UpdateKind } from "../../src/desktop/self-update";

/** The files a zip lists, read from the list at its end and each file's own header: name, method, time and bytes. */
function unzip(zip: Buffer) {
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  let at = zip.readUInt32LE(end + 16);
  return Array.from({ length: zip.readUInt16LE(end + 10) }, () => {
    expect(zip.readUInt32LE(at)).toBe(0x02014b50);
    const name = zip.toString("utf8", at + 46, at + 46 + zip.readUInt16LE(at + 28));
    const [method, time, day] = [10, 12, 14].map((i) => zip.readUInt16LE(at + i));
    const [crc, packedSize, size] = [16, 20, 24].map((i) => zip.readUInt32LE(at + i));
    const header = zip.readUInt32LE(at + 42);
    at += 46 + zip.readUInt16LE(at + 28) + zip.readUInt16LE(at + 30) + zip.readUInt16LE(at + 32);
    expect(zip.readUInt32LE(header)).toBe(0x04034b50);
    expect(zip.toString("utf8", header + 30, header + 30 + zip.readUInt16LE(header + 26))).toBe(name);
    const start = header + 30 + zip.readUInt16LE(header + 26) + zip.readUInt16LE(header + 28);
    const packed = zip.subarray(start, start + packedSize);
    const data = method === 8 ? inflateRawSync(packed) : packed;
    expect([data.length, crc32(data)]).toEqual([size, crc]);
    const modified = new Date((day >> 9) + 1980, ((day >> 5) & 15) - 1, day & 31, time >> 11, (time >> 5) & 63, (time & 31) * 2);
    return { name, method, modified, data };
  });
}

describe("the zip beside each Windows installer", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "windows-zips-"));
  });
  afterEach(() => fs.rmSync(dir, { recursive: true, force: true }));

  /** An installer's bytes: some that pack well, like a program's headers, and some that don't, like its packed app. */
  const installer = (seed: number) => Buffer.concat([Buffer.alloc(4096, seed), Buffer.from(Array.from({ length: 65536 }, (_, i) => (i * 7919 + seed) & 255))]);

  it("holds exactly the installer beside it, under the installer's own name and time", async () => {
    const x64 = path.join(dir, "Edunex-Plus-Setup-1.2.3.exe");
    const arm64 = path.join(dir, "Edunex-Plus-1.2.3-arm64.exe");
    fs.writeFileSync(x64, installer(1));
    fs.writeFileSync(arm64, installer(2));
    const time = new Date(2026, 9, 24, 13, 5, 42);
    for (const file of [x64, arm64]) fs.utimesSync(file, time, time);

    const zips = await zipInstallersIn(dir, "1.2.3");

    expect(zips).toEqual(["Edunex-Plus-Setup-1.2.3-windows-x64.zip", "Edunex-Plus-1.2.3-windows-arm64.zip"]);
    for (const [zip, file] of [
      [zips[0], x64],
      [zips[1], arm64],
    ]) {
      const [only, ...more] = unzip(fs.readFileSync(path.join(dir, zip)));
      expect(more).toEqual([]);
      expect(only).toMatchObject({ name: path.basename(file), method: 8, modified: time });
      expect(only.data.equals(fs.readFileSync(file))).toBe(true);
    }
  });

  it("is made of both installers or not at all: one missing stops the build", async () => {
    fs.writeFileSync(path.join(dir, "Edunex-Plus-Setup-1.2.3.exe"), installer(1));
    await expect(zipInstallersIn(dir, "1.2.3")).rejects.toThrow(/Edunex-Plus-1\.2\.3-arm64\.exe/);
  });

  it("is never taken for an update, by this version or any before it", () => {
    // As a release names its files, the zips first: the app takes the first file that fits.
    // biome-ignore lint/suspicious/noTemplateCurlyInString: electron-builder fills in its own ${…} names
    const named = (pattern?: string | null) => (pattern ?? "").replace("${version}", "1.2.3").replace("${ext}", "exe");
    const RELEASE = "https://github.com/pablonification/edunex-plus/releases/download/v1.2.3";
    const names = [
      named(WINDOWS_ZIPS.x64),
      named(WINDOWS_ZIPS.arm64),
      named(config.nsis?.artifactName),
      named(WINDOWS_ARM_INSTALLER),
      "Edunex-Plus-1.2.3-arm64-mac.zip",
      "Edunex-Plus-1.2.3-x64-mac.zip",
      "Edunex-Plus-1.2.3-x86_64.AppImage",
      "Edunex-Plus-1.2.3-arm64.AppImage",
      "latest.yml",
      WINDOWS_ARM_UPDATE_INFO,
      "latest-mac.yml",
      "latest-linux.yml",
      "latest-linux-arm64.yml",
    ];
    const files = names.map((name) => ({ name, url: `${RELEASE}/${name}`, size: 10 }));
    const picked = (kind: UpdateKind, arch: Arch) => pickReleaseFile(files, kind, arch)?.file.name;
    // Every version since 0.1.0-alpha.5 (the first to update itself) picks by these same rules;
    // 0.1.0-alpha.5 only lacked the ARM installer's, and took "Setup….exe" on any PC.
    expect([picked("mac", "arm64"), picked("mac", "x64")]).toEqual(["Edunex-Plus-1.2.3-arm64-mac.zip", "Edunex-Plus-1.2.3-x64-mac.zip"]);
    expect([picked("windows", "x64"), picked("windows", "arm64")]).toEqual(["Edunex-Plus-Setup-1.2.3.exe", "Edunex-Plus-1.2.3-arm64.exe"]);
    expect([picked("appImage", "x64"), picked("appImage", "arm64")]).toEqual(["Edunex-Plus-1.2.3-x86_64.AppImage", "Edunex-Plus-1.2.3-arm64.AppImage"]);
    expect(names.filter((name) => /Setup.*\.exe$/i.test(name))).toEqual(["Edunex-Plus-Setup-1.2.3.exe"]);
  });

  it("is made once the installers are final, then kept, summed and published with them", () => {
    const workflow = fs.readFileSync(path.resolve(import.meta.dirname, "../../.github/workflows/release.yml"), "utf8");
    const at = (text: string) => workflow.indexOf(text);
    expect(at("node scripts/package-zip-win.mjs release")).toBeGreaterThan(at("name: Put the signed installers in place (Windows)"));
    expect(at("node scripts/package-zip-win.mjs release")).toBeLessThan(at("name: Keep the installers"));
    expect(workflow).toContain("release/*.zip");
    expect(workflow).toContain("files=(*.dmg *.zip *.tar.xz *.exe *.deb *.AppImage)");
  });
});
