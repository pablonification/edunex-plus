// Each home-screen widget's own picture in Android's widget picker (assets/widget-preview-<name>.png, app.config.ts):
// the widget at its first size, laid out as src/widget/view.tsx and views.tsx draw it, in the light look, saying what
// the demo says on its Thursday 8 October at 08:40 (the made-up student, test/pretend). Drawn by Playwright's Chromium
// from the repository's node_modules (CHROMIUM=<path> to pick a browser):
//   node mobile/scripts/make-widget-previews.mjs
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..", "..");
const { chromium } = createRequire(path.join(root, "package.json"))("playwright-core");

// src/ui/palette.ts's v4 light colours, the courses' inks (indigo, cyan, berry), the services' own (views.tsx).
const v = {
  card: "#ffffff",
  fg: "#14171c",
  muted: "#5f6673",
  brand: "#1f63e0",
  brandInk: "#1450c4",
  okFg: "#11692f",
  ambFg: "#7f4500",
  redFg: "#a8201a",
  live: "#1e9e5a",
  onBrand: "#ffffff",
  fill: "#f1f3f7",
};
const course = { PL3002: "#6c45f6", DK4073: "#02748c", II4091: "#a80165", KU1001: "#015f98" };

/** A widget's size at `w`×`h` cells (Android's portrait estimate, 73n − 16 dp wide; a phone's cell about 86 dp high). */
const cells = (w, h) => ({ width: 73 * w - 16, height: 86 * h - 16 });

const text = (value, size, color, { bold = false, lines = 1, style = "" } = {}) =>
  `<div style="font-size:${size}px;line-height:${Math.round(size * 1.3)}px;color:${color};font-weight:${bold ? 600 : 400};${
    lines === 1 ? "white-space:nowrap;" : `display:-webkit-box;-webkit-line-clamp:${lines};-webkit-box-orient:vertical;`
  }overflow:hidden;text-overflow:ellipsis;${style}">${value}</div>`;
const bar = (color, height = 30) => `<div style="width:4px;height:${height}px;border-radius:2px;background:${color};flex:none"></div>`;
const dot = (color, size = 8) => `<div style="width:${size}px;height:${size}px;border-radius:${size / 2}px;background:${color};flex:none"></div>`;
const frame = ({ width, height }, inner, { pad = 14, background = v.card, justify = "space-between" } = {}) =>
  `<div style="width:${width}px;height:${height}px;box-sizing:border-box;padding:${pad}px;border-radius:20px;background:${background};display:flex;flex-direction:column;justify-content:${justify};gap:8px;overflow:hidden">${inner}</div>`;
const col = (inner, gap = 4) => `<div style="display:flex;flex-direction:column;gap:${gap}px;min-width:0">${inner}</div>`;
const row = (inner, gap = 8, extra = "") => `<div style="display:flex;flex-direction:row;align-items:center;gap:${gap}px;min-width:0;${extra}">${inner}</div>`;

// Fluent's filled icons at 24 (views.tsx's ICON_PATH), with each service's ink on its tint.
const iconPath = (file, name) => {
  const source = fs.readFileSync(path.join(root, "node_modules/@fluentui/react-icons/lib/atoms/headless-svg", `${file}.js`), "utf8");
  return source.match(new RegExp(`export const ${name} = [^\\n]*?createFluentIcon\\([^,]+, "24", \\["([^"]+)"\\]`))[1];
};
const services = [
  ["Jadwal", "calendar-ltr", "CalendarLtr24Filled", "#1f63e0", "#dbe6ff"],
  ["Tugas", "clipboard-task", "ClipboardTask24Filled", "#b5530a", "#ffe8d4"],
  ["Kuliah", "book-open", "BookOpen24Filled", "#11692f", "#dcf2e3"],
  ["Nilai", "hat-graduation", "HatGraduation24Filled", "#6c45f6", "#efebff"],
];

const WIDGETS = {
  // Now, 4×2: the class on now, Tandai Hadir open in SIX, then what needs you.
  now: frame(
    cells(4, 2),
    col(
      col(
        text("Sedang berlangsung · 08:00–10:00 · R.SG PWK LT.6", 12, v.okFg, { bold: true }) +
          row(dot(course.PL3002) + text("PL3002 Ekonomi dan Inovasi dalam Perencanaan", 16, v.fg, { bold: true }), 6),
        0,
      ) +
        `<div style="padding:7px 12px;border-radius:10px;background:${v.brand}">${text("Tandai Hadir sudah dibuka di SIX · PL3002", 14, v.onBrand, { bold: true })}</div>` +
        col(text("Perlu perhatianmu", 12, v.muted, { bold: true }) + text("UTS DK4073 · Kam, 15 Okt, 11:00", 14, v.fg, { bold: true }), 2),
      8,
    ) + text("Diperbarui pukul 08:40", 12, v.muted),
  ),
  // Hari ini, 3×2: today's classes, then the next deadline.
  today: frame(
    cells(3, 2),
    col(
      text("Hari ini · Kam 8 Okt", 12, v.brand, { bold: true }) +
        row(bar(course.PL3002, 16) + text("08:00–10:00", 14, v.okFg, { bold: true }) + text("PL3002 · R.SG PWK", 14, v.fg, { bold: true }), 6) +
        row(bar(course.DK4073, 16) + text("11:00–12:59", 14, v.fg) + text("DK4073 · R.9009", 14, v.fg, { bold: true }), 6),
      4,
    ) + col(text("Tenggat 23:59 · II4091", 12, v.muted, { bold: true }) + text("Laporan Praktikum 3", 14, v.fg), 0),
  ),
  // Tenggat, 3×2: what's due, soonest first.
  due: frame(
    cells(3, 2),
    col(
      text("Tenggat", 12, v.brand, { bold: true }) +
        row(
          bar(course.II4091) + col(text("Laporan Praktikum 3", 14, v.fg, { bold: true }) + text("II4091 · Hari ini, 23:59", 12, v.ambFg, { bold: true }), 0),
        ) +
        row(bar(course.DK4073) + col(text("Esai Studi Kasus", 14, v.fg, { bold: true }) + text("DK4073 · Sen, 12 Okt, 23:59", 12, v.muted), 0)),
      8,
    ),
    { justify: "flex-start" },
  ),
  // Kehadiran, 3×2: every course's absences left, the nearest its limit first.
  attendance: frame(
    cells(3, 2),
    col(
      text("Jatah absen", 12, v.brand, { bold: true }) +
        [
          ["DK4073", "Habis", v.ambFg],
          ["PL3002", "Sisa 1×", v.okFg],
          ["II4091", "Sisa 3×", v.okFg],
          ["KU1001", "Sisa 4×", v.okFg],
        ]
          .map(([code, label, ink]) =>
            row(dot(course[code]) + text(code, 14, v.fg, { bold: true }) + `<div style="flex:1"></div>` + text(label, 14, ink, { bold: true })),
          )
          .join(""),
      6,
    ),
    { justify: "flex-start" },
  ),
  // Ujian, 2×2: days to the next exam.
  exam: frame(
    cells(2, 2),
    col(text("UTS DK4073", 14, v.fg, { bold: true }) + text("Kam, 15 Okt, 11:00 · R.9009", 12, v.muted, { lines: 2 }), 0) +
      row(text("7", 40, course.DK4073, { bold: true, style: "line-height:40px" }) + text("hari lagi", 12, v.muted, { bold: true }), 4, "align-items:flex-end"),
  ),
  // Kelas berikutnya, 1×1: the next class's time and code.
  next: frame({ width: 72, height: 72 }, col(text("11:00", 20, v.fg, { bold: true }) + text("DK4073", 12, course.DK4073, { bold: true }), 2), {
    pad: 10,
    justify: "center",
  }),
  // Pintasan, 4×1: four places, one tap each.
  services: frame(
    { width: cells(4, 1).width, height: 76 },
    row(
      services
        .map(
          ([label, file, name, ink, tint]) =>
            `<div style="display:flex;flex-direction:column;align-items:center;gap:4px">
              <div style="width:40px;height:40px;border-radius:14px;background:${tint};display:flex;align-items:center;justify-content:center">
                <svg viewBox="0 0 24 24" width="22" height="22"><path fill="${ink}" d="${iconPath(file, name)}"/></svg></div>
              ${text(label, 12, v.fg, { bold: true })}</div>`,
        )
        .join(""),
      0,
      "justify-content:space-around;width:100%",
    ),
    { pad: 6, justify: "center" },
  ),
  // Satu mata kuliah, 3×2: one course's absences, next class and Task.
  course: frame(
    cells(3, 2),
    col(
      row(dot(course.DK4073, 10) + text("DK4073 Desain Komunikasi Visual", 16, v.fg, { bold: true })) +
        text("Jatah absen habis", 14, v.ambFg, { bold: true }) +
        text("Hari ini, 11:00–12:59 · R.9009", 14, v.fg) +
        col(text("Esai Studi Kasus", 14, v.fg, { bold: true }) + text("Tenggat Sen, 12 Okt, 23:59", 12, v.muted), 0),
      6,
    ),
    { justify: "flex-start" },
  ),
};

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM });
for (const [name, html] of Object.entries(WIDGETS)) {
  const page = await browser.newPage({ deviceScaleFactor: 2 });
  await page.setContent(
    `<html><body style="margin:0;padding:10px;background:transparent;font-family:Roboto,'Segoe UI',system-ui,sans-serif;display:inline-block">
      <div id="w" style="display:inline-block;border-radius:20px;box-shadow:0 1px 3px rgba(0,0,0,.18)">${html}</div></body></html>`,
  );
  const file = path.join(root, `mobile/assets/widget-preview-${name}.png`);
  await page.locator("body").screenshot({ path: file, omitBackground: true });
  await page.close();
  console.log(path.relative(root, file));
}
await browser.close();
