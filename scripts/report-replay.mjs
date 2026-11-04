// Reads a report's scrubbed pages again with this checkout's readers: for each problem, whether its page now reads
// whole, still fails as it did on the Student's computer, or fails another way (a page with two problems shows the
// second once the first is fixed). Run it before and after a fix; it never needs the network or the Student.
//
// Usage:
//   npm run report:replay -- <report.json>
//   <report.json>: what the app saved for the Student, or what the relay keeps (docs/relay.md, "Reading a report").
//
// Exits with 1 while any problem still fails or leaves rows out, so a fix can be checked in one line.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const root = path.resolve(import.meta.dirname, "..");
const file = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
if (!file) {
  console.error("Which report? npm run report:replay -- <report.json>");
  process.exit(2);
}
const contents = JSON.parse(fs.readFileSync(file, "utf8"));
// The relay keeps the report inside what the app sent it ({ envelope: 1, report, os, note, … }).
const report = contents.envelope === 1 ? contents.report : contents;
if (![1, 2].includes(report?.format) || !Array.isArray(report.problems)) {
  console.error(`${file} isn't a report from Edunex Plus.`);
  process.exit(2);
}

// The readers are TypeScript: bundled for this run, next to the packages they import.
const out = path.join(root, "node_modules", ".cache", "report-replay.mjs");
await build({
  entryPoints: [path.join(root, "src/engine/report/replay.ts")],
  outfile: out,
  bundle: true,
  platform: "node",
  format: "esm",
  packages: "external",
  logLevel: "error",
});
const { replayReport } = await import(pathToFileURL(out).href);

const SAYS = {
  fixed: "reads whole now",
  same: "still fails as it did",
  other: "now ends another way",
  unknown: "can't be read again from these pages",
};
const describe = (outcome) => [
  ...(outcome.check ? [`check: ${outcome.check}`] : []),
  ...outcome.rows.map((row) => `left out: ${row.row}\n      why: ${row.why}`),
];

console.log(`Edunex Plus ${report.version}, ${new Date(report.at).toISOString()}, read again with this checkout`);
if (!report.problems.length) console.log("No page in this report: nothing to read again.");
const results = await replayReport(report);
for (const [i, result] of results.entries()) {
  const pages = report.problems[i].pages.map((page) => page.path).join(", ");
  console.log(`\n${result.feed}: ${SAYS[result.verdict]}`);
  console.log(`  pages: ${pages}`);
  console.log("  was:");
  for (const line of describe(result.was)) console.log(`    ${line}`);
  const item = report.problems[i].item;
  if (item) console.log(`  the item it failed on (${item.at}):\n${item.shape.replace(/^/gm, "    ")}`);
  if (result.now && result.verdict !== "fixed" && result.verdict !== "same") {
    console.log("  now:");
    for (const line of describe(result.now)) console.log(`    ${line}`);
  }
}
process.exit(results.every((result) => result.verdict === "fixed") ? 0 : 1);
