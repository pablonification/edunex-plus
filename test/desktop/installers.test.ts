// The installers, the first thing someone who downloads Edunex Plus sees. macOS: the disk
// image's window says what to do, with the app and Applications side by side, and Terminal
// beside the one line that lets macOS open the app. Windows: one
// click installs for the Student's own account, opens the app and keeps their data when it's
// uninstalled, with the app's icon sharp at every size. Read from electron-builder's config
// and the files it ships, since a test can't open Finder or run the Windows installer.
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";
import config, { WINDOWS_ARM_INSTALLER, WINDOWS_ARM_UPDATE_INFO } from "../../electron-builder.config.mjs";
import { HASH_KEY, PICTURES, SIZE, sourceHash } from "../../scripts/make-dmg-background.mjs";
import { artifactBuildCompleted, convertArgs } from "../../scripts/package-dmg.mjs";
import { pickReleaseFile } from "../../src/desktop/self-update";

const root = path.resolve(import.meta.dirname, "../..");
const read = (file: string) => fs.readFileSync(path.join(root, file));

type Picture = { width: number; height: number; data: Buffer };
const { PNG } = createRequire(import.meta.url)("pngjs") as { PNG: { sync: { read(png: Buffer): Picture } } };

/** A PNG's text entries (its tEXt chunks). */
function pngText(png: Buffer): Record<string, string> {
  const text: Record<string, string> = {};
  for (let at = 8; at < png.length; at += 12 + png.readUInt32BE(at)) {
    if (png.toString("latin1", at + 4, at + 8) !== "tEXt") continue;
    const [key, value] = png.toString("latin1", at + 8, at + 8 + png.readUInt32BE(at)).split("\0");
    text[key] = value;
  }
  return text;
}

/** Each picture in an .ico: the size its entry says, and the size of the picture it holds (a PNG, or a bitmap whose height counts its mask too). */
function icoPictures(ico: Buffer) {
  expect([ico.readUInt16LE(0), ico.readUInt16LE(2)]).toEqual([0, 1]);
  return Array.from({ length: ico.readUInt16LE(4) }, (_, i) => {
    const entry = 6 + 16 * i;
    const data = ico.subarray(ico.readUInt32LE(entry + 12), ico.readUInt32LE(entry + 12) + ico.readUInt32LE(entry + 8));
    const isPng = data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const { width, height } = isPng ? PNG.sync.read(data) : { width: data.readInt32LE(4), height: data.readInt32LE(8) / 2 };
    return { size: ico.readUInt8(entry) || 256, width, height };
  });
}

/** Where in the picture something other than the plain background shows, if anywhere. */
function drawnIn(picture: Picture, scale: number, box: { x: number; y: number; width: number; height: number }) {
  const at = (x: number, y: number) => picture.data.readUInt32BE(4 * (y * picture.width + x));
  const plain = at(0, picture.height - 1);
  for (let y = box.y * scale; y < (box.y + box.height) * scale; y++) {
    for (let x = box.x * scale; x < (box.x + box.width) * scale; x++) if (at(x, y) !== plain) return `${x / scale},${y / scale}`;
  }
  return null;
}

describe("the macOS downloads", () => {
  const targets = (config.mac?.target ?? []) as { target: string; arch: string[] }[];

  it("come for Apple silicon and for Intel Macs, a disk image and a zip each", () => {
    expect(targets.map(({ target, arch }) => [target, [...arch].sort()])).toEqual([
      ["dmg", ["arm64", "x64"]],
      ["zip", ["arm64", "x64"]],
    ]);
  });

  it("say in their names which Mac they're for, Intel too", () => {
    // Forced names keep ${arch} even for x64, which electron-builder's own names leave out.
    // biome-ignore lint/suspicious/noTemplateCurlyInString: electron-builder fills in its own ${…} names
    expect(config.dmg?.artifactName).toContain("-${arch}.${ext}");
    // biome-ignore lint/suspicious/noTemplateCurlyInString: electron-builder fills in its own ${…} names
    expect(config.mac?.artifactName).toContain("-${arch}-mac.${ext}");
  });
});

describe("every download", () => {
  it("carries Chromium's words only in the app's two languages, not all 55", () => {
    // electron-builder keeps a file whose name starts a wanted language: en-US.pak, and en.lproj on a Mac.
    expect(config.electronLanguages).toEqual(["en-US", "id"]);
  });
});

describe("the files a release publishes for updating from inside the app", () => {
  it("are named without spaces, so the names in latest*.yml are the names on GitHub", () => {
    const names = [config.mac?.artifactName, config.dmg?.artifactName, config.nsis?.artifactName, WINDOWS_ARM_INSTALLER, config.appImage?.artifactName];
    for (const name of names) expect(name).toMatch(/^Edunex-Plus-[^ ]+$/);
  });

  it("come with the update info files, always named latest*.yml, and nothing is uploaded by the build", () => {
    expect(config.publish).toMatchObject({ provider: "github", owner: "pablonification", repo: "edunex-plus" });
    expect(config.detectUpdateChannel).toBe(false);
    const workflow = read(".github/workflows/release.yml").toString();
    expect(workflow).toContain("release/latest*.yml");
    expect(workflow).toContain("--publish never");
  });
});

describe("the macOS disk image", () => {
  const dmg = config.dmg ?? {};
  const [app, applications, terminal] = dmg.contents ?? [];
  const pictures = PICTURES.map(({ file, scale }) => ({ file, scale, picture: PNG.sync.read(read(file)) }));

  it("opens a 640×480 window on its own background, sharp on Retina screens too", () => {
    expect(dmg.background).toBe("assets/dmg-background.png");
    // electron-builder pairs x.png with x@2x.png, and the window takes x.png's size.
    expect(pictures.map(({ file, picture }) => [file, picture.width, picture.height])).toEqual([
      ["assets/dmg-background.png", 640, 480],
      ["assets/dmg-background@2x.png", 1280, 960],
    ]);
  });

  it("shows the app on the left and Applications on the right, side by side and big", () => {
    expect(app).toMatchObject({ type: "file" });
    expect(applications).toMatchObject({ type: "link", path: "/Applications" });
    expect(app.y).toBe(applications.y);
    expect(app.x).toBeLessThan(320);
    expect(applications.x).toBeGreaterThan(320);
    expect(dmg.iconSize).toBe(100);
  });

  it("has Terminal under them, to type the line that lets macOS open the app", () => {
    expect(terminal).toMatchObject({ type: "link", path: "/System/Applications/Utilities/Terminal.app", name: "Terminal" });
    expect(terminal.y).toBeGreaterThan(app.y);
    expect(fs.readFileSync(path.join(root, "assets/dmg-background.svg"), "utf8")).toContain('xattr -cr "/Applications/Edunex Plus.app"');
  });

  it("is packed with LZMA once it's made, which macOS 10.15 and later open (Electron needs 12)", async () => {
    expect(config.artifactBuildCompleted).toBe(artifactBuildCompleted);
    expect(convertArgs("a.dmg", "b.dmg")).toEqual(["convert", "a.dmg", "-format", "ULMO", "-o", "b.dmg", "-ov", "-quiet"]);
    // The zip, the installers and the update info files are left as they are.
    await expect(artifactBuildCompleted({ file: "release/Edunex-Plus-1.2.3-arm64-mac.zip" })).resolves.toBeUndefined();
    // The app updates itself from the zip, so nothing lists the disk image's sha512.
    expect(dmg.writeUpdateInfo).toBe(false);
  });

  it("names the disk after the app and its version, and gives it the app's icon", () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: electron-builder fills in its own ${…} names
    expect(dmg.title).toBe("${productName} ${version}");
    expect(dmg.icon).toBe(config.mac?.icon);
  });

  it("draws nothing where Finder draws: its title bar, the three icons and their names", () => {
    const iconSize = dmg.iconSize ?? 0;
    for (const { scale, picture } of pictures) {
      // The window is the picture's height with Finder's 32 px title bar: the picture's bottom 32 px never show.
      expect(drawnIn(picture, scale, { x: 0, y: SIZE.height - 32, width: SIZE.width, height: 32 })).toBeNull();
      for (const icon of [app, applications, terminal]) {
        // The icon, a little room for its selection, and its name under it.
        const box = { x: icon.x - iconSize / 2 - 8, y: icon.y - iconSize / 2 - 8, width: iconSize + 16, height: iconSize + 40 };
        expect(drawnIn(picture, scale, box)).toBeNull();
      }
    }
  });

  it("was drawn from the current drawing and icon (after a change: node scripts/make-dmg-background.mjs)", () => {
    for (const { file } of PICTURES) expect(pngText(read(file))[HASH_KEY], file).toBe(sourceHash());
  });
});

describe("the Windows installer", () => {
  const nsis = config.nsis ?? {};

  it("comes one per kind of PC, each found by the update for its own kind, the ARM one never by 0.1.0-alpha.5", () => {
    expect(config.win?.target).toEqual([{ target: "nsis", arch: ["x64"] }]);
    expect(read("package.json").toString()).toContain('"package:win": "npm run build && node scripts/package-win.mjs"');
    // As a release names them.
    // biome-ignore lint/suspicious/noTemplateCurlyInString: electron-builder fills in its own ${…} names
    const named = (pattern?: string | null) => (pattern ?? "").replace("${version}", "1.2.3").replace("${ext}", "exe");
    const RELEASE = "https://github.com/pablonification/edunex-plus/releases/download/v1.2.3";
    const files = [named(nsis.artifactName), named(WINDOWS_ARM_INSTALLER), "latest.yml", WINDOWS_ARM_UPDATE_INFO].map((name) => ({
      name,
      url: `${RELEASE}/${name}`,
      size: 10,
    }));
    expect(pickReleaseFile(files, "windows", "x64")).toEqual({ file: files[0], info: files[2] });
    expect(pickReleaseFile(files, "windows", "arm64")).toEqual({ file: files[1], info: files[3] });
    // 0.1.0-alpha.5 takes the first Setup…exe on any PC, and an ARM build doesn't start on an Intel or AMD one.
    expect(files.filter(({ name }) => /Setup.*\.exe$/i.test(name))).toEqual([files[0]]);
  });

  it("installs in one click, for this Windows user only, and opens the app", () => {
    expect(nsis).toMatchObject({ oneClick: true, perMachine: false, runAfterFinish: true });
    expect(nsis.allowToChangeInstallationDirectory).toBeFalsy();
  });

  it("keeps the Student's data when the app is uninstalled", () => {
    // electron-builder's default; "Keluar & hapus data" in Settings is how to remove it.
    expect(nsis.deleteAppDataOnUninstall ?? false).toBe(false);
  });

  it("names the Start menu and desktop shortcuts Edunex Plus", () => {
    expect(nsis.shortcutName ?? config.productName).toBe("Edunex Plus");
  });

  it("shows the app's icon at every size Windows asks for: the app, its installer and its uninstaller", () => {
    const icon = config.win?.icon ?? "";
    // The installer's and uninstaller's icons are the app's unless set; the header's must be set.
    const icons = new Set([icon, nsis.installerIcon ?? icon, nsis.uninstallerIcon ?? icon, nsis.installerHeaderIcon ?? ""]);
    expect([...icons]).toEqual(["assets/icon.ico"]);
    const sizes = icoPictures(read(icon));
    expect(sizes.map(({ size }) => size)).toEqual([16, 20, 24, 32, 40, 48, 64, 256]);
    for (const { size, width, height } of sizes) expect([width, height]).toEqual([size, size]);
  });

  it("stops and says what to do if an older test version is installed for everyone on the computer", () => {
    expect(nsis.include).toBe("assets/installer.nsh");
    const script = read("assets/installer.nsh").toString();
    expect(script).toContain("!macro customInit");
    // biome-ignore lint/suspicious/noTemplateCurlyInString: an NSIS name, as the script spells it
    expect(script).toContain('ReadRegStr $0 HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation');
    expect(script).toContain('ExecShell "open" "ms-settings:appsfeatures"');
  });
});
