// Turns a report a Student sent from "Laporkan masalah" (the .json file the app saved for them, see
// docs/adr/0007-report-a-page-the-app-couldnt-read.md) into test data: each page it carries, already
// scrubbed on their computer, goes into test/fixtures under a name that says where it came from.
// Then write the test that reads it and fails the way the report says (its check, or the rows it
// left out), and fix the reader.
//
// A report of format 2 (docs/adr/0014-a-report-carries-what-a-fix-needs.md) also says whether its
// scrubbed pages still fail that way, the rows as the page wrote them, and what it cost the Student:
// the script prints those too. "no": scrubbing took out what went wrong, so the pages alone won't
// show it; the rows' shapes keep how the page really wrote them.
//
// Usage:
//   npm run fixtures:from-report -- <report.json> [<name>]
//   <name>: what to call the pages ("spi-row"); the report's date when left out.
//
// A page that still holds anything shaped like a personal detail (the privacy tests' rules) isn't
// written: the script says what it found. Read the pages before committing them all the same.
import fs from "node:fs";
import path from "node:path";
import { personalHits } from "../test/kit/privacy-rules.ts";

const root = path.resolve(import.meta.dirname, "..");
const [file, label] = process.argv.slice(2).filter((arg) => !arg.startsWith("--"));
if (!file) {
  console.error("Which report? npm run fixtures:from-report -- <report.json> [<name>]");
  process.exit(1);
}
const report = JSON.parse(fs.readFileSync(file, "utf8"));
if (![1, 2].includes(report.format) || !Array.isArray(report.problems)) {
  console.error(`${file} isn't a report from Edunex Plus.`);
  process.exit(1);
}

const slug = (text) =>
  text
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 80);
const name = slug(label ?? new Date(report.at).toISOString().slice(0, 10));

const READ_AGAIN = {
  yes: "scrubbed, it still fails the same way",
  no: "scrubbed, it doesn't fail the same way: what went wrong was scrubbed out, read the rows' shapes",
  unknown: "couldn't be read again offline",
};
const indent = (text) => text.replace(/^/gm, "    ");
const when = (at) => (at === null ? "never" : new Date(at).toISOString());

console.log(`Edunex Plus ${report.version}, ${new Date(report.at).toISOString()}`);
if (!report.problems.length) console.log("No page in this report: the app had nothing kept that it couldn't read.");
let refused = 0;
for (const problem of report.problems) {
  const what = problem.kind === "changed" ? `fails: ${problem.check}` : `leaves out ${problem.rows.map((row) => `"${row.row}" (${row.why})`).join(", ")}`;
  console.log(`\n${problem.feed} ${what}`);
  if (problem.reproduces) console.log(`  ${READ_AGAIN[problem.reproduces] ?? problem.reproduces}`);
  if (problem.impact) {
    const { datasets, rowsLeftOut, detailsBlank, lastGoodAt } = problem.impact;
    console.log(`  cost: ${datasets.join(", ")}, ${rowsLeftOut} rows left out, ${detailsBlank} details blank, last read whole ${when(lastGoodAt)}`);
  }
  for (const cell of problem.cells ?? []) {
    console.log(`  row "${cell.row}", shaped ${cell.shape}${cell.html ? "" : " (not found on its page)"}`);
    if (cell.header) console.log(indent(cell.header));
    if (cell.html) console.log(indent(cell.html));
  }
  for (const page of problem.pages) {
    const hits = personalHits(page.body);
    if (hits.length) {
      refused += 1;
      console.log(`  not written, it still holds ${hits.join(", ")}: ${page.path}`);
      continue;
    }
    const base = slug(page.path.replace(/^\/app\/mahasiswa:\d+(\+\d{4}-\d)?/, "")) || "root";
    const ext = page.system === "six" ? "html" : "json";
    let out = path.join(root, "test", "fixtures", page.system, `report-${name}-${base}.${ext}`);
    for (let n = 2; fs.existsSync(out); n++) out = path.join(root, "test", "fixtures", page.system, `report-${name}-${base}-${n}.${ext}`);
    fs.writeFileSync(out, `${page.body}\n`);
    console.log(`  ${path.relative(root, out)}  (${page.path}, read with bodyText("${page.system}", "${path.basename(out)}"))`);
  }
}
const log = report.log ?? [];
if (log.length) {
  const errors = log.filter((entry) => entry.level !== "info");
  console.log(`\nThe app's log: ${log.length} lines from the last hour, ${errors.length} warnings and errors.`);
  for (const entry of errors) console.log(`  ${new Date(entry.at).toISOString()} ${entry.level} ${entry.area}: ${entry.message}`);
}
if (refused) process.exit(1);
