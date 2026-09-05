// Generates assets/trayTemplate.png (+@2x) for the menu bar / tray: a
// monochrome rounded-square mark. Re-run after changing the drawing:
//   node scripts/generate-tray-icon.mjs
// macOS picks up the "Template" suffix and renders it adaptively.
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const CRC_TABLE = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

function crc32(buf) {
  let c = -1;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function writePng(filePath, size, alphaAt) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    const row = y * (size * 4 + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = alphaAt(x, y, size);
      const px = row + 1 + x * 4;
      raw[px] = r;
      raw[px + 1] = g;
      raw[px + 2] = b;
      raw[px + 3] = a;
    }
  }
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
  writeFileSync(filePath, png);
  console.log(`wrote ${filePath} (${size}x${size})`);
}

// Filled rounded square, inset by ~10% so the glyph doesn't touch the edge.
function roundedSquare(x, y, size) {
  const inset = Math.max(1, Math.round(size * 0.1));
  const radius = Math.round(size * 0.28);
  const min = inset;
  const max = size - 1 - inset;
  const qx = Math.max(min + radius - x, x - (max - radius), 0);
  const qy = Math.max(min + radius - y, y - (max - radius), 0);
  const d = Math.hypot(qx, qy);
  const inside = x >= min && x <= max && y >= min && y <= max && d <= radius;
  if (!inside) return [0, 0, 0, 0];
  // 1px soft edge so the icon doesn't alias harshly in the menu bar.
  const coverage = Math.max(0, Math.min(1, radius - d + 0.5));
  return [0, 0, 0, Math.round(255 * coverage)];
}

const outDir = path.resolve(import.meta.dirname, "..", "assets");
mkdirSync(outDir, { recursive: true });
writePng(path.join(outDir, "trayTemplate.png"), 16, roundedSquare);
writePng(path.join(outDir, "trayTemplate@2x.png"), 32, roundedSquare);
