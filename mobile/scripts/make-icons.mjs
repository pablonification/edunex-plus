// The Android icons, from the desktop's drawing (assets/icon.svg, made by scripts/make-icons.mjs):
//   assets/icon.png                     the tile, 1024 px (the launcher's legacy icon)
//   assets/splash-icon.png              the tile, for the splash screen
//   assets/android-icon-foreground.png  the white mark alone, inside the adaptive icon's safe zone
//   assets/android-icon-background.png  the app's blue, top to bottom, as the tile has it
//   assets/android-icon-monochrome.png  the mark alone, for Android's themed icons
// Drawn by Playwright's Chromium (from the repository's node_modules), so no other tool is needed:
//   node mobile/scripts/make-icons.mjs
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");
const { chromium } = createRequire(path.join(root, "package.json"))("playwright-core");
const svg = fs.readFileSync(path.join(root, "assets/icon.svg"), "utf8");
const mark = svg.slice(svg.lastIndexOf('<g fill="#ffffff">'), svg.lastIndexOf("</g>") + 4);
const clip = svg.match(/<clipPath id="e-outline">[\s\S]*?<\/clipPath>/)[0];
// The mark spans about x 242–808, y 238–784: centred on the canvas and scaled into the safe zone (66 of 108 dp).
const markOnly = (colour, scale) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><defs>${clip}</defs>` +
  `<g transform="translate(512 512) scale(${scale}) translate(-525 -511)">${mark.replaceAll("#ffffff", colour)}</g></svg>`;
const background = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><defs><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4f8cff"/><stop offset="0.55" stop-color="#2f6feb"/><stop offset="1" stop-color="#1f55d0"/></linearGradient></defs><rect width="1024" height="1024" fill="url(#b)"/></svg>`;

// Any Chromium Playwright already downloaded will do (CHROMIUM=<path> to pick one).
const cache = path.join(process.env.HOME ?? "", ".cache/ms-playwright");
const found = fs.existsSync(cache)
  ? fs
      .readdirSync(cache)
      .filter((name) => name.startsWith("chromium_headless_shell-"))
      .map((name) => path.join(cache, name, "chrome-headless-shell-linux64/chrome-headless-shell"))
      .filter((file) => fs.existsSync(file))
      .at(-1)
  : undefined;
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? found });
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
async function draw(source, file, size = 1024) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(
    `<html><body style="margin:0;background:transparent"><img src="data:image/svg+xml;base64,${Buffer.from(source).toString("base64")}" width="${size}" height="${size}" style="display:block"></body></html>`,
  );
  await page.screenshot({ path: path.join(root, "mobile/assets", file), omitBackground: true });
  console.log(`mobile/assets/${file}`);
}
await draw(svg, "icon.png");
await draw(svg, "splash-icon.png");
await draw(markOnly("#ffffff", 0.78), "android-icon-foreground.png");
await draw(background, "android-icon-background.png");
await draw(markOnly("#ffffff", 0.78), "android-icon-monochrome.png");
await browser.close();
