// The macOS disk image, the first thing someone who downloads Edunex Plus for a Mac sees:
// its window says what to do, with the app and Applications side by side. Read from
// electron-builder's config and the pictures it ships, since a test can't open Finder.
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";
import config from "../../electron-builder.config.mjs";
import { HASH_KEY, PICTURES, sourceHash } from "../../scripts/make-dmg-background.mjs";

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


/** Where in the picture something other than the plain background shows, if anywhere. */
function drawnIn(picture: Picture, scale: number, box: { x: number; y: number; width: number; height: number }) {
  const at = (x: number, y: number) => picture.data.readUInt32BE(4 * (y * picture.width + x));
  const plain = at(0, picture.height - 1);
  for (let y = box.y * scale; y < (box.y + box.height) * scale; y++) {
    for (let x = box.x * scale; x < (box.x + box.width) * scale; x++) if (at(x, y) !== plain) return `${x / scale},${y / scale}`;
  }
  return null;
}

describe("the macOS disk image", () => {
  const dmg = config.dmg ?? {};
  const [app, applications] = dmg.contents ?? [];
  const pictures = PICTURES.map(({ file, scale }) => ({ file, scale, picture: PNG.sync.read(read(file)) }));

  it("opens a 640×432 window on its own background, sharp on Retina screens too", () => {
    expect(dmg.background).toBe("assets/dmg-background.png");
    // electron-builder pairs x.png with x@2x.png, and the window takes x.png's size.
    expect(pictures.map(({ file, picture }) => [file, picture.width, picture.height])).toEqual([
      ["assets/dmg-background.png", 640, 432],
      ["assets/dmg-background@2x.png", 1280, 864],
    ]);
  });

  it("shows the app on the left and Applications on the right, side by side and big", () => {
    expect(app).toMatchObject({ type: "file" });
    expect(applications).toMatchObject({ type: "link", path: "/Applications" });
    expect(app.y).toBe(applications.y);
    expect(app.x).toBeLessThan(320);
    expect(applications.x).toBeGreaterThan(320);
    expect(dmg.iconSize).toBe(120);
  });

  it("names the disk after the app and its version, and gives it the app's icon", () => {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: electron-builder fills in its own ${…} names
    expect(dmg.title).toBe("${productName} ${version}");
    expect(dmg.icon).toBe(config.mac?.icon);
  });

  it("draws nothing where Finder draws: its title bar, the two icons and their names", () => {
    const iconSize = dmg.iconSize ?? 0;
    for (const { scale, picture } of pictures) {
      // The window is 432 high with Finder's 32 px title bar: the picture's bottom 32 px never show.
      expect(drawnIn(picture, scale, { x: 0, y: 400, width: 640, height: 32 })).toBeNull();
      for (const icon of [app, applications]) {
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
