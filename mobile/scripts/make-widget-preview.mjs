// The home-screen widget's picture in Android's widget list (assets/widget-preview.png): the widget
// at its 4×2 size, laid out as src/widget/view.tsx draws it, in the light look, saying what the demo
// says on its Thursday 8 October at 08:12 (made-up student, test/pretend). Drawn by Playwright's
// Chromium from the repository's node_modules (CHROMIUM=<path> to pick a browser):
//   node mobile/scripts/make-widget-preview.mjs
import { createRequire } from "node:module";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");
const { chromium } = createRequire(path.join(root, "package.json"))("playwright-core");

// src/ui/theme.ts's light colors, and the course's (indigo).
const c = { surface: "#ffffff", fg: "#1d1d1f", muted: "#5b5b61", faint: "#68686e", successFg: "#166240", course: "#6e46fb" };
const text = (value, size, color, bold = false) =>
  `<div style="font-size:${size}px;color:${color};font-weight:${bold ? 500 : 400};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${value}</div>`;
const widget = `
<div style="width:320px;height:170px;box-sizing:border-box;padding:14px;border-radius:20px;background:${c.surface};
  display:flex;flex-direction:column;justify-content:space-between;font-family:Roboto,'Segoe UI',system-ui,sans-serif;box-shadow:0 1px 3px rgba(0,0,0,.18)">
  <div style="display:flex;flex-direction:column;gap:8px">
    <div>
      ${text("Sedang berlangsung · 08:00–10:00 · R.SG PWK LT.6", 12, c.successFg, true)}
      <div style="display:flex;align-items:center;gap:6px">
        <div style="width:8px;height:8px;border-radius:4px;background:${c.course};flex:none"></div>
        ${text("PL3002 Ekonomi dan Inovasi dalam Perencanaan", 16, c.fg, true)}
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:4px">
      ${text("Perlu perhatianmu", 12, c.muted, true)}
      <div>${text("UTS DK4073", 14, c.fg, true)}${text("Kam, 15 Okt, 11:00", 12, c.muted)}</div>
    </div>
  </div>
  ${text("Diperbarui pukul 08:12", 12, c.faint)}
</div>`;

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
const page = await browser.newPage({ viewport: { width: 340, height: 190 }, deviceScaleFactor: 2 });
await page.setContent(`<html><body style="margin:0;padding:10px;background:transparent">${widget}</body></html>`);
await page.screenshot({ path: path.join(root, "mobile/assets/widget-preview.png"), omitBackground: true });
await browser.close();
console.log("mobile/assets/widget-preview.png");
