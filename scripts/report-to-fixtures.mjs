// Turns a report a Student sent from "Laporkan masalah" (the .json file the app saved for them, see
// docs/adr/0007-report-a-page-the-app-couldnt-read.md) into test data: each page it carries, already
// scrubbed on their computer, goes into test/fixtures under a name that says where it came from.
// Then write the test that reads it and fails the way the report says (its check, or the rows it
// left out), and fix the reader.
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
if (report.format !== 1 || !Array.isArray(report.problems)) {
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

console.log(`Edunex Plus ${report.version}, ${new Date(report.at).toISOString()}`);
if (!report.problems.length) console.log("No page in this report: the app had nothing kept that it couldn't read.");
let refused = 0;
for (const problem of report.problems) {
  const what = problem.kind === "changed" ? `fails: ${problem.check}` : `leaves out ${problem.rows.map((row) => `"${row.row}" (${row.why})`).join(", ")}`;
  console.log(`\n${problem.feed} ${what}`);
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
if (refused) process.exit(1);
