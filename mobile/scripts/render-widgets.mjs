// Every home-screen widget as pictures, without a phone: each at its smallest, first and largest size (and a step
// between), light and dark, in its normal state and in each of empty, signed out, offline and holiday, from the
// pretend Student's Thursday, on a wallpaper-like background. One PNG per picture and one contact sheet per widget.
//
//   node mobile/scripts/render-widgets.mjs [folder]      (default: a folder in the system's temp directory)
//   node mobile/scripts/render-widgets.mjs [folder] --grid=samsung
//
// Two grids, the sizes labelled the same: the first one (a cell about 97×134 dp), and with --grid=samsung the dp a
// Galaxy A52's launcher really gives a placed widget (4×1 373×124, 4×2 373×260, 3×2 277×260).
//
// How: test/mobile/widget-drawings.test.tsx walks the real widget trees (mobile/src/widget) into web pages when
// WIDGET_RENDER names a folder; this script runs it, then photographs the pages with the Playwright in the root
// node_modules. It's an approximation of Android's drawing (CSS flexbox for the library's Yoga, the Mac's font for
// Roboto): the phone is still the real check. It also lists every line that was cut ("…") in report.txt.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright-core";

const root = path.resolve(import.meta.dirname, "..", "..");
const args = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
// --previews: also keep each widget's picker picture (assets/widget-preview-<name>.png), cut from the same drawing.
const previews = process.argv.includes("--previews");
const grid = process.argv.find((arg) => arg.startsWith("--grid="))?.slice("--grid=".length) ?? "";
const out = path.resolve(args[0] ?? path.join(os.tmpdir(), "edunex-plus-widget-render"));
const pages = path.join(out, "pages");

const test = spawnSync("npx", ["vitest", "run", "test/mobile/widget-drawings.test.tsx"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, WIDGET_RENDER: pages, WIDGET_GRID: grid },
});
if (test.status !== 0) process.exit(test.status ?? 1);

/** Playwright's own browser, or any Chromium it downloaded earlier (the newest), as this Mac may hold an older one. */
function browserPath() {
  const bundled = chromium.executablePath();
  if (fs.existsSync(bundled)) return bundled;
  const cache = process.env.PLAYWRIGHT_BROWSERS_PATH ?? path.join(os.homedir(), "Library", "Caches", "ms-playwright");
  const found = fs.existsSync(cache)
    ? fs
        .readdirSync(cache)
        .filter((name) => /^chromium(_headless_shell)?-\d+$/.test(name))
        .sort((a, b) => Number(b.split("-")[1]) - Number(a.split("-")[1]))
        .flatMap((name) => fs.globSync(path.join(cache, name, "**", "{chrome-headless-shell,Chromium,chrome}")))
        .filter((file) => fs.statSync(file).isFile())
    : [];
  return found[0] ?? null;
}

const executablePath = browserPath();
if (!executablePath) {
  console.error(`No Chromium for Playwright on this machine: the pages are in ${pages}, open them in a browser.`);
  process.exit(0);
}

const browser = await chromium.launch({ executablePath });
const context = await browser.newContext({ deviceScaleFactor: 3, viewport: { width: 1800, height: 1200 } });
const report = [];
for (const file of fs
  .readdirSync(pages)
  .filter((name) => name.endsWith(".html"))
  .sort()) {
  const name = path.basename(file, ".html");
  const page = await context.newPage();
  await page.goto(`file://${path.join(pages, file)}`);
  await page.screenshot({ path: path.join(out, `${name}-sheet.png`), fullPage: true });
  const shots = await page.locator("[data-shot]").all();
  fs.mkdirSync(path.join(out, name), { recursive: true });
  for (const shot of shots) {
    const id = await shot.getAttribute("data-shot");
    await shot.screenshot({ path: path.join(out, name, `${id}.png`) });
    // The asset is the widget alone: the sheet's grey behind it comes off first, so its corners stay clear.
    if (previews && id.includes("-preview-")) await shot.evaluate((node) => (node.style.background = "transparent"));
    if (previews && id.includes("-preview-"))
      await shot.locator("[data-widget]").screenshot({ path: path.join(root, "mobile", "assets", `widget-preview-${name}.png`), omitBackground: true });
    // A line that was cut, or a widget whose parts run past its edge.
    const cut = await shot.evaluate((node) => {
      const lines = [...node.querySelectorAll("div")]
        .filter((el) => el.children.length === 0 && el.textContent && (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1))
        .map((el) => `cut: "${el.textContent}"`);
      const widget = node.querySelector("[data-widget]");
      const inner = widget?.firstElementChild;
      if (widget && inner && (inner.scrollHeight > widget.clientHeight + 1 || inner.scrollWidth > widget.clientWidth + 1)) lines.push("overflows its size");
      return lines;
    });
    for (const line of cut) report.push(`${id}: ${line}`);
  }
  await page.close();
}
await browser.close();
fs.writeFileSync(path.join(out, "report.txt"), report.length ? `${report.join("\n")}\n` : "Nothing cut, nothing past its edge.\n");
console.log(`${out}: a sheet and a folder of PNGs per widget; ${report.length} cut or overflowing lines (report.txt).`);
