// Draws Edunex Plus's icon and writes every file made from it:
//   assets/icon.svg              the drawing (made here; edit the numbers below, not the file)
//   assets/icon.png              1024 px, for Windows and Linux packages and the Dock in development
//   assets/icon.icns             the macOS app icon
//   src/app/assets/edunex-plus.png  the in-app mark (sidebar, welcome, Settings): the tile alone, no shadow
//
// The mark is a lowercase "e" with a raised "+", white on the app's blue, on a
// macOS-shaped tile (Apple's grid: an 824 px tile with 100 px around it).
// Needs macOS (sips, iconutil) and librsvg (`brew install librsvg`):
//   node scripts/make-icons.mjs
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const out = (file) => path.join(root, file);

/** A superellipse tile, the shape of a macOS icon: smoother corners than a rounded rectangle. */
function tile(r = 412, n = 5, steps = 480) {
  const points = [];
  for (let i = 0; i < steps; i++) {
    const a = (2 * Math.PI * i) / steps;
    const x = 512 + r * Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** (2 / n);
    const y = 512 + r * Math.sign(Math.sin(a)) * Math.abs(Math.sin(a)) ** (2 / n);
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return `M${points.join(" L")} Z`;
}

// The "e": a ring open at the lower right, with a round end, and its bar.
const e = { x: 460, y: 566, radius: 170, stroke: 96, bar: 82, opening: 48 };
// The raised "+".
const plus = { x: 708, y: 338, arm: 68, stroke: 64 };

const gap = (e.opening * Math.PI) / 180;
const end = { x: e.x + e.radius * Math.cos(gap), y: e.y + e.radius * Math.sin(gap) };
const outer = e.radius + e.stroke / 2;
const n = (v) => +v.toFixed(1);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <!-- Made by scripts/make-icons.mjs: change the drawing there. -->
  <defs>
    <linearGradient id="blue" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4f8cff"/>
      <stop offset="0.55" stop-color="#2f6feb"/>
      <stop offset="1" stop-color="#1f55d0"/>
    </linearGradient>
    <radialGradient id="sheen" cx="0.5" cy="0" r="0.75">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.16"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="rim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.35"/>
      <stop offset="0.5" stop-color="#ffffff" stop-opacity="0"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="12" stdDeviation="14" flood-color="#0b1b4d" flood-opacity="0.28"/>
    </filter>
    <clipPath id="e-outline"><circle cx="${e.x}" cy="${e.y}" r="${outer}"/></clipPath>
  </defs>
  <path id="tile" d="${tile()}" fill="url(#blue)" filter="url(#shadow)"/>
  <path d="${tile()}" fill="url(#sheen)"/>
  <path d="${tile(410.5)}" fill="none" stroke="url(#rim)" stroke-width="3"/>
  <g fill="#ffffff">
    <path d="M${e.x + e.radius},${e.y} A${e.radius},${e.radius} 0 1 0 ${n(end.x)},${n(end.y)}" fill="none" stroke="#ffffff" stroke-width="${e.stroke}"/>
    <circle cx="${n(end.x)}" cy="${n(end.y)}" r="${e.stroke / 2}"/>
    <rect x="${e.x - outer}" y="${e.y - e.bar / 2}" width="${2 * outer}" height="${e.bar}" clip-path="url(#e-outline)"/>
    <path d="M${plus.x - plus.arm},${plus.y} H${plus.x + plus.arm} M${plus.x},${plus.y - plus.arm} V${plus.y + plus.arm}" fill="none" stroke="#ffffff" stroke-width="${plus.stroke}" stroke-linecap="round"/>
  </g>
</svg>
`;

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "edunex-icons-"));
const run = (cmd, args) => execFileSync(cmd, args, { stdio: ["ignore", "ignore", "inherit"] });

fs.writeFileSync(out("assets/icon.svg"), svg);
run("rsvg-convert", ["-w", "1024", "-h", "1024", out("assets/icon.svg"), "-o", out("assets/icon.png")]);

// macOS: every size the icon set asks for, from the 1024 px drawing.
const set = path.join(tmp, "icon.iconset");
fs.mkdirSync(set);
for (const size of [16, 32, 128, 256, 512]) {
  run("sips", ["-z", `${size}`, `${size}`, out("assets/icon.png"), "--out", path.join(set, `icon_${size}x${size}.png`)]);
  run("sips", ["-z", `${size * 2}`, `${size * 2}`, out("assets/icon.png"), "--out", path.join(set, `icon_${size}x${size}@2x.png`)]);
}
run("iconutil", ["-c", "icns", set, "-o", out("assets/icon.icns")]);

// The in-app mark: the tile alone (no shadow), cropped to it, 128 px.
const noShadow = path.join(tmp, "no-shadow.css");
fs.writeFileSync(noShadow, "#tile { filter: none; }");
const flat = path.join(tmp, "flat.png");
run("rsvg-convert", ["-s", noShadow, "-w", "1024", "-h", "1024", out("assets/icon.svg"), "-o", flat]);
run("sips", ["-c", "824", "824", "--cropOffset", "100", "100", flat, "--out", flat]);
run("sips", ["-z", "128", "128", flat, "--out", out("src/app/assets/edunex-plus.png")]);

fs.rmSync(tmp, { recursive: true, force: true });
console.log("wrote assets/icon.svg, assets/icon.png, assets/icon.icns, src/app/assets/edunex-plus.png");
