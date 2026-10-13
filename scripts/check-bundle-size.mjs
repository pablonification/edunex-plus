// Keeps the window quick to open: fails when the JavaScript the window loads at
// start (gzip-compressed, as Vite reports it) grows past the budget. Pieces the
// window loads later on demand are counted separately and only reported.
//
//   npx vite build && node scripts/check-bundle-size.mjs [--budget 360]
import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const DEFAULT_BUDGET_KB = 360;

const args = process.argv.slice(2);
const budgetArg = args.indexOf("--budget");
const budgetKb = budgetArg >= 0 ? Number(args[budgetArg + 1]) : DEFAULT_BUDGET_KB;
if (!Number.isFinite(budgetKb) || budgetKb <= 0) throw new Error(`Not a budget in kB: ${args[budgetArg + 1]}`);

const appDir = path.resolve(import.meta.dirname, "..", "dist", "app");
const indexHtml = path.join(appDir, "index.html");
if (!fs.existsSync(indexHtml)) {
  console.error("No window build: run `npx vite build` first.");
  process.exit(1);
}

// What index.html loads right away: its module script and the chunks it preloads.
const html = fs.readFileSync(indexHtml, "utf8");
const atStart = new Set(
  [...html.matchAll(/<(?:script[^>]*\bsrc|link[^>]*\brel="modulepreload"[^>]*\bhref)="\.?\/?([^"]+\.js)"/g)].map((match) => path.normalize(match[1])),
);
if (atStart.size === 0) throw new Error("Found no JavaScript in dist/app/index.html; has the build changed shape?");

const kb = (bytes) => Math.round(bytes / 1000);
const gzipBytes = (file) => gzipSync(fs.readFileSync(path.join(appDir, file))).length;

const jsFiles = fs
  .readdirSync(path.join(appDir, "assets"))
  .filter((name) => name.endsWith(".js"))
  .map((name) => path.join("assets", name));
let startBytes = 0;
let laterBytes = 0;
for (const file of jsFiles) {
  if (atStart.has(file)) startBytes += gzipBytes(file);
  else laterBytes += gzipBytes(file);
}

const over = kb(startBytes) > budgetKb;
const line = `Window JS loaded at start: ${kb(startBytes)} kB gzip of a ${budgetKb} kB budget${laterBytes ? ` (plus ${kb(laterBytes)} kB loaded later, when needed)` : ""}.`;
console.log(line);

if (process.env.GITHUB_STEP_SUMMARY) {
  const verdict = over
    ? `**Over budget by ${kb(startBytes) - budgetKb} kB.** Something heavy now loads when the window opens. Load it only when it's needed (a dynamic \`import()\`), or raise the budget in \`scripts/check-bundle-size.mjs\` on purpose.`
    : `Within budget, ${budgetKb - kb(startBytes)} kB to spare.`;
  fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Window size\n\n${line}\n\n${verdict}\n`);
}
if (over) process.exit(1);
