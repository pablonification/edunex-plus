// The hand-off page, mobile/report/index.html: every flow a Student goes through, the phone beside the
// desktop, light and dark, all from the demo's made-up student. The pictures are CI's own (the e2e "app"
// job's judge walk, mobile/flows/judge/walk.yaml, and the desktop-shots job, scripts/demo/capture.mjs),
// made small here (WebP) so the page stays light in the repository:
//
//   node mobile/scripts/make-report.mjs <phone-light> <phone-dark> <desktop-light> <desktop-dark>
//
// where each is a folder of PNGs: the phone's "light-01-beranda.png", the desktop's "01-beranda.png".
// The words around the pictures are in mobile/report/text.mjs.
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { FLOWS, SECTIONS, TITLE } from "../report/text.mjs";

const root = path.resolve(import.meta.dirname, "..", "..");
const out = path.join(root, "mobile/report");
const [phoneLight, phoneDark, desktopLight, desktopDark] = process.argv.slice(2);
if (!desktopDark) throw new Error("Usage: make-report.mjs <phone-light> <phone-dark> <desktop-light> <desktop-dark>");

// Any Chromium Playwright already downloaded will do (CHROMIUM=<path> to pick one), as make-icons.mjs.
const { chromium } = createRequire(path.join(root, "package.json"))("playwright-core");
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
const page = await browser.newPage();

/** A PNG made `width` wide as WebP; null when there's no such picture. */
async function shrink(file, width, to) {
  if (!fs.existsSync(file)) return null;
  const data = `data:image/png;base64,${fs.readFileSync(file).toString("base64")}`;
  const webp = await page.evaluate(
    async ({ data, width }) => {
      const img = new Image();
      img.src = data;
      await img.decode();
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = Math.round((img.height * width) / img.width);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/webp", 0.8).split(",")[1];
    },
    { data, width },
  );
  fs.writeFileSync(path.join(out, "img", to), Buffer.from(webp, "base64"));
  return `img/${to}`;
}

fs.rmSync(path.join(out, "img"), { recursive: true, force: true });
fs.mkdirSync(path.join(out, "img"), { recursive: true });

const escape = (text) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const figure = (src, alt, kind) =>
  src
    ? `<figure class="${kind}"><img src="${src}" alt="${escape(alt)}" loading="lazy"><figcaption>${kind === "phone" ? "HP" : "Desktop"}</figcaption></figure>`
    : `<figure class="${kind} none"><p>No ${kind} picture</p></figure>`;

const flows = [];
for (const flow of FLOWS) {
  const rows = [];
  for (const shot of flow.shots) {
    const pairs = [];
    for (const [theme, phoneDir, desktopDir] of [
      ["light", phoneLight, desktopLight],
      ["dark", phoneDark, desktopDark],
    ]) {
      const phone = await shrink(path.join(phoneDir, `${theme}-${shot.phone}.png`), 300, `${theme}-${shot.phone}-phone.webp`);
      const desktop = shot.desktop ? await shrink(path.join(desktopDir, `${shot.desktop}.png`), 560, `${theme}-${shot.desktop}-desktop.webp`) : null;
      pairs.push(
        `<div class="pair ${theme}"><h4>${theme === "light" ? "Terang" : "Gelap"}</h4>${figure(phone, `${shot.caption}, HP, ${theme}`, "phone")}${shot.desktop ? figure(desktop, `${shot.caption}, desktop, ${theme}`, "desktop") : ""}</div>`,
      );
    }
    rows.push(`<div class="shot"><h3>${escape(shot.caption)}</h3><div class="pairs">${pairs.join("")}</div></div>`);
  }
  flows.push(
    `<section class="flow" id="${flow.id}"><h2>${escape(flow.title)}</h2><ol class="steps">${flow.steps.map((step) => `<li>${step}</li>`).join("")}</ol>${rows.join("")}</section>`,
  );
}
await browser.close();

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(TITLE)}</title>
<style>
  :root { color-scheme: light dark; --fg: #16181d; --muted: #5d6270; --line: #e3e5ea; --bg: #fff; --sunken: #f5f6f8; --accent: #2f6feb; }
  @media (prefers-color-scheme: dark) { :root { --fg: #eceef2; --muted: #a2a7b3; --line: #2b2f37; --bg: #121418; --sunken: #1a1d23; --accent: #7aa2ff; } }
  body { margin: 0; font: 16px/1.55 system-ui, sans-serif; color: var(--fg); background: var(--bg); }
  main { max-width: 1180px; margin: 0 auto; padding: 32px 20px 80px; }
  h1 { font-size: 30px; line-height: 1.2; margin: 0 0 8px; } h2 { font-size: 22px; margin: 48px 0 12px; padding-top: 16px; border-top: 1px solid var(--line); }
  h3 { font-size: 16px; margin: 24px 0 8px; } h4 { font-size: 13px; color: var(--muted); margin: 0 0 6px; font-weight: 600; }
  a { color: var(--accent); } code { background: var(--sunken); padding: 1px 5px; border-radius: 4px; font-size: 14px; }
  pre { background: var(--sunken); padding: 12px 14px; border-radius: 8px; overflow-x: auto; }
  table { border-collapse: collapse; width: 100%; font-size: 15px; } th, td { text-align: left; border-bottom: 1px solid var(--line); padding: 6px 8px; vertical-align: top; }
  nav ul { columns: 2; padding-left: 18px; } .lead { color: var(--muted); font-size: 18px; }
  .steps { color: var(--muted); } .pairs { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  @media (max-width: 900px) { .pairs { grid-template-columns: 1fr; } nav ul { columns: 1; } }
  .pair { display: flex; gap: 10px; align-items: flex-start; flex-wrap: wrap; background: var(--sunken); padding: 10px; border-radius: 10px; }
  .pair h4 { width: 100%; } figure { margin: 0; } figure img { display: block; border: 1px solid var(--line); border-radius: 8px; max-width: 100%; height: auto; }
  figure.phone img { width: 150px; } figure.desktop { flex: 1; min-width: 220px; } figcaption { font-size: 12px; color: var(--muted); margin-top: 4px; }
  figure.none p { color: var(--muted); font-size: 13px; }
</style>
</head>
<body>
<main>
${SECTIONS.top}
<nav><h2>Every flow, step by step</h2><ul>${FLOWS.map((flow) => `<li><a href="#${flow.id}">${escape(flow.title)}</a></li>`).join("")}</ul></nav>
${flows.join("\n")}
${SECTIONS.bottom}
</main>
</body>
</html>
`;
fs.writeFileSync(path.join(out, "index.html"), html);
console.log(`mobile/report/index.html, ${fs.readdirSync(path.join(out, "img")).length} pictures`);
