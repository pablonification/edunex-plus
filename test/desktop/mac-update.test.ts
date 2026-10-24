// The Mac update, about a third smaller (scripts/package-mac-update.mjs): every release build packs the
// app in each Mac zip again as a .tar.xz beside it, and the app updates from that when the release
// lists it (src/desktop/updater.ts unpacks it). Its name must never fit what older copies look for:
// they'd take it for the zip. On a Mac, the last tests pack a small signed app the way a release
// does and unpack it the way the app does, both for real.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { packArgs, packMacUpdate, updateName } from "../../scripts/package-mac-update.mjs";
import { pickReleaseFile } from "../../src/desktop/self-update";
import { unpackMacUpdate } from "../../src/desktop/updater";

vi.mock("electron", () => ({ app: {}, net: {}, shell: {} }));

const root = path.resolve(import.meta.dirname, "../..");
const RELEASE = "https://github.com/pablonification/edunex-plus/releases/download/v1.2.3";
const asset = (name: string) => ({ name, url: `${RELEASE}/${name}`, size: 10 });

describe("the Mac update", () => {
  it("is named after its zip, and found beside it", () => {
    expect(updateName("Edunex-Plus-1.2.3-arm64-mac.zip")).toBe("Edunex-Plus-1.2.3-arm64-mac.tar.xz");
    expect(updateName("Edunex-Plus-1.2.3-x64-mac.zip")).toBe("Edunex-Plus-1.2.3-x64-mac.tar.xz");
    expect(() => updateName("Edunex-Plus-1.2.3-arm64.dmg")).toThrow("Not a Mac zip");
    const files = ["Edunex-Plus-1.2.3-arm64-mac.zip", "Edunex-Plus-1.2.3-arm64-mac.tar.xz", "latest-mac.yml"].map(asset);
    expect(pickReleaseFile(files, "mac", "arm64")).toEqual({ file: files[0], smaller: files[1], info: files[2] });
  });

  it("is never what a copy up to 0.1.0-alpha.16 takes for its own file, so those keep updating from the zip", () => {
    // What each of them looks for: the first file in the release whose name fits.
    const before = [/-arm64-mac\.zip$/, /-x64-mac\.zip$/, /Setup.*\.exe$/i, /-arm64\.exe$/, /-x86_64\.AppImage$/, /-arm64\.AppImage$/];
    for (const arch of ["arm64", "x64"]) {
      const name = updateName(`Edunex-Plus-1.2.3-${arch}-mac.zip`);
      for (const pattern of before) expect(pattern.test(name), `${name} ${pattern}`).toBe(false);
    }
  });

  it("is packed by macOS's own tar at xz level 9, without what macOS keeps beside a file", () => {
    expect(packArgs("/release/mac-arm64/Edunex Plus.app", "/release/x.tar.xz")).toEqual([
      "-c",
      "-J",
      "--options",
      "xz:compression-level=9",
      "--no-mac-metadata",
      "--no-xattrs",
      "--no-acls",
      "--no-fflags",
      "-f",
      "/release/x.tar.xz",
      "-C",
      "/release/mac-arm64",
      "Edunex Plus.app",
    ]);
  });

  it("is packed by every Mac build of the release workflow, after electron-builder, and kept and summed with the installers", () => {
    const workflow = fs.readFileSync(path.join(root, ".github/workflows/release.yml"), "utf8");
    const built = workflow.indexOf('npm run "package:$TARGET"');
    const packed = workflow.indexOf("node scripts/package-mac-update.mjs release");
    expect(built).toBeGreaterThan(-1);
    expect(packed).toBeGreaterThan(built);
    expect(packed).toBeLessThan(workflow.indexOf("name: Keep the installers"));
    expect(workflow).toContain("release/*.tar.xz");
    expect(workflow).toMatch(/files=\([^)]*\*\.zip \*\.tar\.xz[^)]*\)/);
  });
});

/** A small app laid out as the real one is: its program, and a framework reached through links. Signed ad-hoc. */
function makeApp(folder: string, { id = "id.edunexplus.desktop", version = "1.2.3", name = "Edunex Plus" } = {}) {
  const app = path.join(folder, `${name}.app`);
  const plist = (keys: Record<string, string>) =>
    `<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0"><dict>${Object.entries(keys)
      .map(([key, value]) => `<key>${key}</key><string>${value}</string>`)
      .join("")}</dict></plist>\n`;
  fs.mkdirSync(path.join(app, "Contents", "MacOS"), { recursive: true });
  fs.writeFileSync(
    path.join(app, "Contents", "Info.plist"),
    plist({ CFBundleIdentifier: id, CFBundleShortVersionString: version, CFBundleExecutable: name, CFBundlePackageType: "APPL" }),
  );
  fs.copyFileSync("/usr/bin/true", path.join(app, "Contents", "MacOS", name));
  const framework = path.join(app, "Contents", "Frameworks", "Pretend.framework");
  fs.mkdirSync(path.join(framework, "Versions", "A", "Resources"), { recursive: true });
  fs.copyFileSync("/usr/bin/true", path.join(framework, "Versions", "A", "Pretend"));
  fs.writeFileSync(
    path.join(framework, "Versions", "A", "Resources", "Info.plist"),
    plist({ CFBundleIdentifier: "id.example.pretend", CFBundleExecutable: "Pretend", CFBundlePackageType: "FMWK" }),
  );
  fs.symlinkSync("A", path.join(framework, "Versions", "Current"));
  fs.symlinkSync("Versions/Current/Pretend", path.join(framework, "Pretend"));
  fs.symlinkSync("Versions/Current/Resources", path.join(framework, "Resources"));
  execFileSync("/usr/bin/codesign", ["--sign", "-", "--force", "--deep", app], { stdio: "pipe" });
  return app;
}

const tar = (args: string[]) => execFileSync("/usr/bin/tar", args, { stdio: "pipe" });
const verifies = (app: string) => {
  try {
    execFileSync("/usr/bin/codesign", ["--verify", "--deep", "--strict", app], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
};

describe.runIf(process.platform === "darwin")("the Mac update on this Mac", () => {
  let work = "";
  beforeEach(() => {
    work = fs.mkdtempSync(path.join(os.tmpdir(), "mac-update-test-"));
  });
  afterEach(() => fs.rmSync(work, { recursive: true, force: true }));

  it("comes out as the same app, links, modes and signature as they were, from the .tar.xz as from the zip", async () => {
    const app = makeApp(path.join(work, "built"));
    const zip = path.join(work, "Edunex-Plus-1.2.3-arm64-mac.zip");
    execFileSync("/usr/bin/ditto", ["-c", "-k", "--keepParent", app, zip]);
    const tarXz = path.join(work, updateName(path.basename(zip)));
    const { size } = await packMacUpdate(zip, tarXz);
    expect(size).toBe(fs.statSync(tarXz).size);
    const fromTar = await unpackMacUpdate(tarXz, "tarXz", "1.2.3", path.join(work, "from-tar"));
    const fromZip = await unpackMacUpdate(zip, "zip", "1.2.3", path.join(work, "from-zip"));
    for (const unpacked of [fromTar, fromZip]) {
      expect(path.basename(unpacked)).toBe("Edunex Plus.app");
      expect(verifies(unpacked), unpacked).toBe(true);
      const framework = path.join(unpacked, "Contents", "Frameworks", "Pretend.framework");
      expect(fs.readlinkSync(path.join(framework, "Versions", "Current"))).toBe("A");
      expect(fs.readlinkSync(path.join(framework, "Pretend"))).toBe("Versions/Current/Pretend");
      expect(fs.statSync(path.join(unpacked, "Contents", "MacOS", "Edunex Plus")).mode & 0o777).toBe(0o755);
    }
    // Downloaded once, put in place from the unpacked app: the download itself is gone.
    expect([fs.existsSync(tarXz), fs.existsSync(zip)]).toEqual([false, false]);
  });

  it("is refused when it holds another app, another version, two apps, or a link where the app should be", async () => {
    const built = path.join(work, "built");
    const app = makeApp(built);
    makeApp(built, { name: "Other" });
    makeApp(path.join(work, "other-id"), { id: "id.example.other" });
    fs.mkdirSync(path.join(work, "linked"));
    fs.symlinkSync(app, path.join(work, "linked", "Edunex Plus.app"));
    const packed = (folder: string, ...names: string[]) => {
      const out = path.join(work, `${path.basename(folder)}-${names.length}.tar.xz`);
      tar(["-c", "-J", "-f", out, "-C", folder, ...names]);
      return out;
    };
    const unpack = (archive: string, version = "1.2.3") => unpackMacUpdate(archive, "tarXz", version, path.join(work, "into"));
    await expect(unpack(packed(built, "Edunex Plus.app"), "1.3.0")).rejects.toThrow("another app or another version");
    await expect(unpack(packed(path.join(work, "other-id"), "Edunex Plus.app"))).rejects.toThrow("another app or another version");
    await expect(unpack(packed(built, "Edunex Plus.app", "Other.app"))).rejects.toThrow("doesn't hold one app");
    await expect(unpack(packed(path.join(work, "linked"), "Edunex Plus.app"))).rejects.toThrow("doesn't hold one app");
    const tarXz = path.join(work, "good.tar.xz");
    tar(packArgs(app, tarXz));
    await expect(unpack(tarXz)).resolves.toBe(path.join(work, "into", "Edunex Plus.app"));
  });

  it("never unpacks anything outside its folder: '..' and a path through a link are refused, an absolute path lands inside", async () => {
    const built = path.join(work, "built");
    makeApp(built);
    fs.writeFileSync(path.join(built, "loose"), "not part of the app");
    fs.symlinkSync(work, path.join(built, "link"));
    const into = path.join(work, "into");
    // -P keeps the paths as -s rewrites them, as only a crafted archive would have them.
    const crafted = (from: string, to: string, ...extra: string[]) => {
      const out = path.join(work, `crafted-${extra.length}-${path.basename(to)}.tar.xz`);
      tar(["-c", "-J", "-P", "-s", `,^loose$,${to},`, "-f", out, "-C", built, "Edunex Plus.app", ...extra, from]);
      return out;
    };
    await expect(unpackMacUpdate(crafted("loose", "../escaped"), "tarXz", "1.2.3", into)).rejects.toThrow();
    expect(fs.existsSync(path.join(work, "escaped"))).toBe(false);
    await expect(unpackMacUpdate(crafted("loose", "link/through", "link"), "tarXz", "1.2.3", into)).rejects.toThrow();
    expect(fs.existsSync(path.join(work, "through"))).toBe(false);
    const absolute = path.join(work, "absolute");
    await expect(unpackMacUpdate(crafted("loose", absolute), "tarXz", "1.2.3", into)).resolves.toBe(path.join(into, "Edunex Plus.app"));
    expect(fs.existsSync(absolute)).toBe(false);
    expect(fs.existsSync(path.join(into, absolute))).toBe(true);
  });
});
