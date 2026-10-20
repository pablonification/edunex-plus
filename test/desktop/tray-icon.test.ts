// The tray icon per system (src/desktop/tray.ts): macOS's menu bar tints a
// one-colour template itself; Windows and Linux show the app's colour icon,
// as their other apps do, with every size Windows' display scaling asks for.
// And the app's own icon on Windows carries each size, drawn, not shrunk.
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

const root = path.resolve(import.meta.dirname, "..", "..");
const { PNG } = createRequire(import.meta.url)("pngjs") as { PNG: { sync: { read(png: Buffer): { width: number; data: Buffer } } } };
const loaded = vi.hoisted(() => [] as { file: string; template: boolean }[]);
vi.mock("electron", () => ({
  app: { getAppPath: () => "/app" },
  Menu: { buildFromTemplate: () => ({}) },
  nativeImage: {
    createFromPath(file: string) {
      const entry = { file, template: false };
      loaded.push(entry);
      return {
        isEmpty: () => false,
        setTemplateImage: (on: boolean) => {
          entry.template = on;
        },
      };
    },
  },
  Tray: class {
    setToolTip() {}
    setContextMenu() {}
    on() {}
    isDestroyed = () => false;
    destroy() {}
  },
}));

const { createTray } = await import("../../src/desktop/tray");
const realPlatform = process.platform;
const runOn = (platform: NodeJS.Platform) => Object.defineProperty(process, "platform", { value: platform });

afterEach(() => {
  runOn(realPlatform);
  loaded.length = 0;
});

/** The sizes in a Windows .ico, smallest first. */
function icoSizes(file: string): number[] {
  const bytes = fs.readFileSync(path.join(root, file));
  expect(bytes.readUInt16LE(2)).toBe(1); // an icon
  return Array.from({ length: bytes.readUInt16LE(4) }, (_, i) => bytes[6 + 16 * i] || 256).sort((a, b) => a - b);
}

describe("the tray icon", () => {
  it.each([
    ["win32", "/app/assets/tray.ico", false],
    ["linux", "/app/assets/tray.png", false],
    ["darwin", "/app/assets/trayTemplate.png", true],
  ] as const)("%s shows %s", (platform, file, template) => {
    runOn(platform);
    createTray({ lang: "id", open: () => undefined, quit: () => undefined });
    expect(loaded).toEqual([{ file, template }]);
  });

  it("macOS's is the app's tile with its \"e+\" cut out, in black on nothing, 16 pt and its Retina double", () => {
    const read = (file: string) => PNG.sync.read(fs.readFileSync(path.join(root, file)));
    expect([read("assets/trayTemplate.png").width, read("assets/trayTemplate@2x.png").width]).toEqual([16, 32]);
    const icon = read("assets/trayTemplate@2x.png");
    const alpha = (x: number, y: number) => icon.data[(y * icon.width + x) * 4 + 3];
    // Only its shape counts (macOS tints it): every pixel drawn is black.
    for (let i = 0; i < icon.data.length; i += 4) if (icon.data[i + 3] > 0) expect([...icon.data.subarray(i, i + 3)]).toEqual([0, 0, 0]);
    // The tile is drawn; the e's ring (right of its centre) and the +'s middle are cut out of it, and so is the outside.
    expect(alpha(4, 16)).toBe(255);
    expect(alpha(20, 18)).toBeLessThan(64);
    expect(alpha(23, 9)).toBeLessThan(64);
    expect(alpha(0, 0)).toBe(0);
  });

  it("Windows' carries 16 to 48 px, for display scaling from 100% to 300%; Linux's a sharp 24 px and its double", () => {
    expect(icoSizes("assets/tray.ico")).toEqual([16, 20, 24, 32, 40, 48]);
    expect(fs.readFileSync(path.join(root, "assets/tray.png")).readUInt32BE(16)).toBe(24);
    expect(fs.readFileSync(path.join(root, "assets/tray@2x.png")).readUInt32BE(16)).toBe(48);
  });
});

describe("the app's icon on Windows", () => {
  it("is a .ico with every size Windows shows, from the title and taskbar's 16 px to Start's 256", async () => {
    expect(icoSizes("assets/icon.ico")).toEqual([16, 20, 24, 32, 40, 48, 64, 256]);
    const { default: config } = (await import(pathToFileURL(path.join(root, "electron-builder.config.mjs")).href)) as {
      default: { win: { icon: string }; files: string[] };
    };
    expect(config.win.icon).toBe("assets/icon.ico");
    // The installed app carries its tray icons.
    expect(config.files).toContain("assets/tray*");
  });
});
