// Draws the window people see when they open the macOS disk image (.dmg):
//   assets/dmg-background.svg       the drawing (edit this, then run this script)
//   assets/dmg-background.png       640×480, which electron-builder.config.mjs's dmg points to
//   assets/dmg-background@2x.png    1280×960 for Retina screens (electron-builder joins the two)
//
// Electron's Chromium draws it, so the words are set in the Mac's own font, like Finder's
// names under the two icons. Each picture records a hash of the drawing and of the icon it
// shows (assets/icon.svg), so a test notices a drawing that changed without new pictures.
// Needs macOS (the system font):
//   node scripts/make-dmg-background.mjs
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { crc32 } from "node:zlib";

const root = path.resolve(import.meta.dirname, "..");
export const SOURCES = ["assets/dmg-background.svg", "assets/icon.svg"];
/** The picture's size, which is the window's: the SVG's own width and height. */
export const SIZE = { width: 640, height: 480 };
export const PICTURES = [
  { file: "assets/dmg-background.png", scale: 1 },
  { file: "assets/dmg-background@2x.png", scale: 2 },
];
/** The PNG text entry holding the hash of SOURCES the picture was drawn from. */
export const HASH_KEY = "edunex-plus:source";

/** One hash of everything the picture shows. */
export function sourceHash() {
  const hash = createHash("sha256");
  for (const file of SOURCES) hash.update(fs.readFileSync(path.join(root, file)));
  return hash.digest("hex");
}

/** A PNG with a text entry (`tEXt` chunk) added just before its end. */
function withText(png, key, value) {
  const data = Buffer.from(`${key}\0${value}`, "latin1");
  const chunk = Buffer.alloc(12 + data.length);
  chunk.writeUInt32BE(data.length, 0);
  chunk.write("tEXt", 4, "latin1");
  data.copy(chunk, 8);
  chunk.writeUInt32BE(crc32(chunk.subarray(4, 8 + data.length)), 8 + data.length);
  const end = png.length - 12; // IEND is always last, and always 12 bytes
  return Buffer.concat([png.subarray(0, end), chunk, png.subarray(end)]);
}

/** Electron's side: draw the SVG offscreen at one scale and save the frame as a PNG. */
async function render(source, scale, out, profile) {
  const { app, BrowserWindow } = await import("electron");
  // A throwaway profile, so nothing lands in ~/Library/Application Support.
  app.setPath("userData", profile);
  app.dock?.hide();
  await app.whenReady();
  const window = new BrowserWindow({ ...SIZE, show: false, useContentSize: true, webPreferences: { offscreen: { deviceScaleFactor: scale } } });
  await window.loadFile(source);
  // Everything has loaded (the icon too): the next whole frame at this scale is the picture.
  const frame = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`no ${scale}x frame within 20 s`)), 20_000);
    window.webContents.on("paint", (_event, _dirty, image) => {
      const { width, height } = image.getSize();
      if (width !== SIZE.width * scale || height !== SIZE.height * scale) return;
      clearTimeout(timer);
      resolve(image);
    });
    window.webContents.invalidate();
  });
  fs.writeFileSync(out, frame.toPNG());
  app.quit();
}

/** Node's side: one Electron per scale (each draws one frame), then the hash goes in. */
function main() {
  const electron = path.join(root, "node_modules/.bin/electron");
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const hash = sourceHash();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "edunex-dmg-"));
  try {
    for (const { file, scale } of PICTURES) {
      const frame = path.join(tmp, `${scale}x.png`);
      const args = ["--render", path.join(root, SOURCES[0]), `${scale}`, frame, path.join(tmp, `profile-${scale}x`)];
      execFileSync(electron, [fileURLToPath(import.meta.url), ...args], { env, stdio: "inherit" });
      fs.writeFileSync(path.join(root, file), withText(fs.readFileSync(frame), HASH_KEY, hash));
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`wrote ${PICTURES.map((picture) => picture.file).join(", ")}`);
}

const args = process.argv.slice(2);
if (process.versions.electron && args[0] === "--render") {
  render(args[1], Number(args[2]), args[3], args[4]).catch((error) => {
    console.error(error);
    process.exit(1);
  });
} else if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
