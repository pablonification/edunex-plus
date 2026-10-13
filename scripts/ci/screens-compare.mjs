// Finds the screens a pull request changes: compares each picture the tour took
// of the pull request with the same picture taken of its base, and writes the
// ones that differ as a before/after pair cropped to where they differ, so the
// change can be read at a glance. Writes <out-dir>/changed.json:
// [{ name, kind: "changed" | "new", pixels }], most changed first.
//
//   node scripts/ci/screens-compare.mjs <base-pictures> <pull-request-pictures> <out-dir>
import fs from "node:fs";
import path from "node:path";
import { PNG } from "pngjs";

const [beforeDir, afterDir, outDir] = process.argv.slice(2);
fs.mkdirSync(outDir, { recursive: true });

/** A pixel counts as changed past this difference in any channel (0–255): below it is font smoothing. */
const TOLERANCE = 24;
/** A picture counts as changed from this many changed pixels: a word or more. */
const MIN_PIXELS = 1500;
/** Crops keep this much around the change, and are at least this big, so the change has its context. */
const PAD = 40;
const MIN_CROP = { width: 760, height: 475 };

/** What changes from one run to the next on its own: the top bar's "Diperbarui … yang lalu", and a message passing over Settings. */
function ignored(name, x, y, width, height) {
  if (x >= width - 520 && y < 48) return true;
  return name.startsWith("26-") && y >= height - 70;
}

const read = (file) => PNG.sync.read(fs.readFileSync(file));

function crop(png, box) {
  const out = new PNG({ width: box.right - box.left, height: box.bottom - box.top });
  PNG.bitblt(png, out, box.left, box.top, out.width, out.height, 0, 0);
  return PNG.sync.write(out);
}

function around(found, width, height) {
  let { left, top, right, bottom } = found;
  left -= PAD;
  top -= PAD;
  right += PAD;
  bottom += PAD;
  const grow = (lo, hi, min, max) => {
    if (hi - lo < min) {
      const middle = Math.round((lo + hi) / 2);
      lo = middle - Math.floor(min / 2);
      hi = lo + min;
    }
    if (lo < 0) [lo, hi] = [0, hi - lo];
    if (hi > max) [lo, hi] = [lo - (hi - max), max];
    return [Math.max(0, lo), Math.min(max, hi)];
  };
  [left, right] = grow(left, right, MIN_CROP.width, width);
  [top, bottom] = grow(top, bottom, MIN_CROP.height, height);
  return { left, top, right, bottom };
}

const results = [];
for (const name of fs
  .readdirSync(afterDir)
  .filter((file) => file.endsWith(".png"))
  .sort()) {
  const after = read(path.join(afterDir, name));
  const beforeFile = path.join(beforeDir, name);
  if (!fs.existsSync(beforeFile)) {
    fs.copyFileSync(path.join(afterDir, name), path.join(outDir, `after-${name}`));
    results.push({ name, kind: "new", pixels: after.width * after.height });
    continue;
  }
  const before = read(beforeFile);
  if (before.width !== after.width || before.height !== after.height) {
    fs.copyFileSync(beforeFile, path.join(outDir, `before-${name}`));
    fs.copyFileSync(path.join(afterDir, name), path.join(outDir, `after-${name}`));
    results.push({ name, kind: "changed", pixels: after.width * after.height });
    continue;
  }
  const { width, height } = after;
  let pixels = 0;
  const found = { left: width, top: height, right: 0, bottom: 0 };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (ignored(name, x, y, width, height)) continue;
      const i = (y * width + x) * 4;
      const a = before.data;
      const b = after.data;
      if (Math.abs(a[i] - b[i]) > TOLERANCE || Math.abs(a[i + 1] - b[i + 1]) > TOLERANCE || Math.abs(a[i + 2] - b[i + 2]) > TOLERANCE) {
        pixels++;
        if (x < found.left) found.left = x;
        if (y < found.top) found.top = y;
        if (x + 1 > found.right) found.right = x + 1;
        if (y + 1 > found.bottom) found.bottom = y + 1;
      }
    }
  }
  if (pixels < MIN_PIXELS) continue;
  const box = around(found, width, height);
  fs.writeFileSync(path.join(outDir, `before-${name}`), crop(before, box));
  fs.writeFileSync(path.join(outDir, `after-${name}`), crop(after, box));
  results.push({ name, kind: "changed", pixels });
}

results.sort((a, b) => b.pixels - a.pixels);
fs.writeFileSync(path.join(outDir, "changed.json"), `${JSON.stringify(results, null, 2)}\n`);
console.log(`${results.length} of the pictures changed: ${results.map((r) => r.name).join(", ") || "none"}`);
