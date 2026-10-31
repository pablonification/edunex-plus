// Sums up the app's own timing lines in one or more logcat captures (tag ReactNativeJS):
//
//   [startup] shown              Beranda drawn (the splash goes)
//   [perf] first-data <ms>       process start to Beranda with real data
//   [perf] screen <route> <ms>   a tap to that screen drawn with its data
//   [perf] tab <name> <ms>       a tab switch, tap to drawn
//   [perf] js-block <ms> <label> the JS thread was blocked that long (> 50 ms), by what
//
//   node mobile/qa/perf-summary.mjs <logcat.txt>... [--json]
//
// Prints a plain table, one row per kind and label: how many, median, max. Builds without the probes
// print a line saying so; every measurement script calls this on the logcat it kept.
import fs from "node:fs";

const args = process.argv.slice(2);
const json = args.includes("--json");
const files = args.filter((a) => a !== "--json");

/** @type {Map<string, {kind: string, label: string, values: number[]}>} */
const rows = new Map();
let shown = 0;
const add = (kind, label, ms) => {
  if (!Number.isFinite(ms)) return;
  const key = `${kind}\u0000${label}`;
  if (!rows.has(key)) rows.set(key, { kind, label, values: [] });
  rows.get(key).values.push(ms);
};

for (const file of files) {
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line.includes("ReactNativeJS")) continue;
    if (line.includes("[startup] shown")) shown++;
    const at = line.indexOf("[perf] ");
    if (at < 0) continue;
    // console.info may quote its argument; the words are what count.
    const words = line.slice(at + 7).replace(/['"]\s*$/, "").trim().split(/\s+/);
    const [kind, ...rest] = words;
    if (kind === "first-data") add(kind, "", Number(rest[0]));
    else if (kind === "js-block") add(kind, rest.slice(1).join(" ") || "?", Number(rest[0]));
    else if (rest.length >= 2) add(kind, rest.slice(0, -1).join(" "), Number(rest.at(-1)));
  }
}

const median = (values) => {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};
const order = ["first-data", "tab", "screen", "js-block"];
const table = [...rows.values()]
  .sort((a, b) => (order.indexOf(a.kind) + 1 || 9) - (order.indexOf(b.kind) + 1 || 9) || a.label.localeCompare(b.label))
  .map((r) => ({ kind: r.kind, label: r.label, count: r.values.length, median: median(r.values), max: Math.max(...r.values) }));

if (json) {
  console.log(JSON.stringify({ shown, rows: table }, null, 2));
} else if (table.length === 0) {
  console.log(`No [perf] lines (a build without the probes). [startup] shown: ${shown}×.`);
} else {
  console.log(`[perf] lines (ms), [startup] shown ${shown}×:\n`);
  console.log("| kind | label | count | median | max |");
  console.log("| --- | --- | ---: | ---: | ---: |");
  for (const r of table) console.log(`| ${r.kind} | ${r.label || "-"} | ${r.count} | ${r.median} | ${r.max} |`);
}
