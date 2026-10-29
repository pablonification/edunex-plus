// The score for "same data": reads what Maestro saw when it ran the flows from
// ./flows-from-inventory.mjs and prints, as markdown, how many of the desktop's
// entries the phone showed, per scenario and per screen. An entry counts as found
// when every one of its texts was seen (its labelled assertVisible completed).
//
//   maestro test --debug-output .scratch/maestro --format junit --output .scratch/maestro/report.xml mobile/flows/data
//   node mobile/scripts/flows-from-inventory-report.mjs .scratch/maestro [--missing]
//
// It reads every commands.json (Maestro 2.x; commands-*.json before) under the folders given (Maestro's debug output) and
// every JUnit .xml (flows that failed outright: the screen wasn't reached, or the app stopped).
import fs from "node:fs";
import path from "node:path";
import { EXPECTED, LABEL, phoneSkip, SCREENS } from "./flows-from-inventory.mjs";

/** Every file under `at` (or `at` itself). */
function files(at) {
  const stat = fs.statSync(at, { throwIfNoEntry: false });
  if (!stat) throw new Error(`Nothing at ${at}`);
  if (stat.isFile()) return [at];
  return fs.readdirSync(at).flatMap((name) => files(path.join(at, name)));
}

/** Every label in a command (Maestro nests it under the command's own name). */
function labels(value, out = []) {
  if (Array.isArray(value)) for (const v of value) labels(v, out);
  else if (value && typeof value === "object")
    for (const [key, v] of Object.entries(value)) {
      if (key === "label" && typeof v === "string") out.push(v);
      else labels(v, out);
    }
  return out;
}

/** Labels of looks that completed, and labels that ran at all, from Maestro's commands-*.json. */
function seen(commandFiles) {
  const completed = new Set();
  const ran = new Set();
  for (const file of commandFiles) {
    let list;
    try {
      list = JSON.parse(fs.readFileSync(file, "utf8"));
    } catch {
      continue;
    }
    for (const item of Array.isArray(list) ? list : []) {
      const status = item?.metadata?.status;
      for (const text of new Set(labels(item?.command ?? item))) {
        if (!LABEL.test(text)) continue;
        ran.add(text);
        if (status === "COMPLETED") completed.add(text);
      }
    }
  }
  return { completed, ran };
}

/** Flows that failed in a JUnit report: their names. */
function failedFlows(xmlFiles) {
  const failed = [];
  for (const file of xmlFiles) {
    const xml = fs.readFileSync(file, "utf8");
    for (const match of xml.matchAll(/<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/g)) {
      const name = /\bname="([^"]*)"/.exec(match[1])?.[1] ?? "?";
      if (/<failure|<error/.test(match[2] ?? "") || /status="(?:ERROR|FAILURE)"/.test(match[1])) failed.push(name);
    }
  }
  return failed;
}

const share = (found, of) => (of ? `${Math.round((found / of) * 100)}%` : "-");

function main() {
  const args = process.argv.slice(2);
  const showMissing = args.includes("--missing");
  const inputs = args.filter((a) => !a.startsWith("--"));
  if (!inputs.length) throw new Error("Usage: flows-from-inventory-report.mjs <maestro debug output or junit.xml> ... [--missing]");
  const all = inputs.flatMap(files);
  const { completed, ran } = seen(all.filter((f) => /^commands(?:-.*)?\.json$/.test(path.basename(f))));
  const failed = failedFlows(all.filter((f) => f.endsWith(".xml")));

  const config = JSON.parse(fs.readFileSync(SCREENS, "utf8"));
  const scenarios = fs
    .readdirSync(EXPECTED)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(EXPECTED, f), "utf8")));
  const ranScenarios = new Set([...ran].map((l) => LABEL.exec(l)[1]));
  const lines = ["## Same data: what the phone shows of the desktop's items", "", "| Scenario | Found | Of | Share |", "| --- | ---: | ---: | ---: |"];
  const details = [];
  let totalFound = 0;
  let totalOf = 0;
  for (const inventory of scenarios) {
    const name = inventory.scenario;
    if (!ranScenarios.has(name)) {
      lines.push(`| ${name} | not run | ${inventory.entries.length} | - |`);
      continue;
    }
    const byScreen = new Map();
    const missing = [];
    const skipped = [];
    let found = 0;
    // The desktop's items the phone leaves out on purpose don't count, and are listed with why.
    const counted = inventory.entries.filter((entry) => {
      const skip = phoneSkip(config, entry.id);
      if (skip) skipped.push({ entry, skip });
      return !skip;
    });
    for (const entry of counted) {
      const looks = entry.tokens.map((_, i) => `data|${name}|${entry.id}|${i + 1}/${entry.tokens.length}`);
      const ok = looks.every((l) => completed.has(l));
      const row = byScreen.get(entry.screen) ?? { found: 0, of: 0 };
      row.of++;
      if (ok) {
        row.found++;
        found++;
      } else missing.push({ entry, unseen: entry.tokens.filter((_, i) => !completed.has(looks[i])) });
      byScreen.set(entry.screen, row);
    }
    totalFound += found;
    totalOf += counted.length;
    lines.push(`| ${name} | ${found} | ${counted.length} | ${share(found, counted.length)} |`);
    details.push("", `### ${name}: by screen`, "", "| Screen | Found | Of | Share |", "| --- | ---: | ---: | ---: |");
    for (const [screen, row] of byScreen) details.push(`| ${screen} | ${row.found} | ${row.of} | ${share(row.found, row.of)} |`);
    if (showMissing && skipped.length) {
      details.push("", `Left out on purpose (${skipped.length}, not counted):`, "");
      for (const { entry, skip } of skipped) details.push(`- \`${entry.id}\`: ${skip.row}, ${skip.why}`);
    }
    if (showMissing && missing.length) {
      details.push("", `Not found on the phone (${missing.length}):`, "");
      for (const { entry, unseen } of missing) details.push(`- \`${entry.id}\`: ${unseen.map((t) => `"${t}"`).join(", ")}`);
    }
  }
  lines.push(`| **all run** | **${totalFound}** | **${totalOf}** | **${share(totalFound, totalOf)}** |`);
  if (failed.length) details.push("", "### Flows that stopped (screen not reached, or the app stopped)", "", ...failed.map((f) => `- ${f}`));
  console.log([...lines, ...details].join("\n"));
}

if (process.argv[1] === import.meta.filename) main();
