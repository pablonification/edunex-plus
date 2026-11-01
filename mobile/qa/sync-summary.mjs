// sync.sh's numbers: for each logcat (epoch times) of one phase, what the demo's sync read and how long it took,
// from the phase's "qa-sync" mark (the start link or the pull) to the last request answered and the last source live.
//
//   node mobile/qa/sync-summary.mjs <first.txt> <saved.txt> <pull.txt>
import fs from "node:fs";
import path from "node:path";

const rows = [];
for (const file of process.argv.slice(2)) {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  const at = (line) => Number(line.trim().split(/\s+/)[0]);
  const mark = lines.find((line) => /qa-sync/.test(line));
  const from = mark ? at(mark) : Number.NaN;
  const sync = lines
    .filter((line) => line.includes("[sync]"))
    .map((line) => ({ at: at(line), text: line.slice(line.indexOf("[sync]") + 7).replace(/^\+\d+ /, "") }));
  const requests = sync.filter((s) => /^(GET|POST|PUT|PATCH|DELETE|HEAD) /.test(s.text));
  const by = {};
  for (const r of requests) {
    const host = r.text.split(" ")[1].split("/")[0];
    by[host] = (by[host] ?? 0) + 1;
  }
  const datasets = new Set(sync.filter((s) => s.text.startsWith("dataset ")).map((s) => s.text.slice(8)));
  const live = sync.filter((s) => /^status \S+ live$/.test(s.text));
  const ms = (t) => (Number.isFinite(t) && Number.isFinite(from) ? `${((t - from) * 1000).toFixed(0)}` : "-");
  rows.push({
    phase: path.basename(file, ".txt"),
    requests: requests.length,
    by: Object.entries(by)
      .map(([host, n]) => `${host} ${n}`)
      .join(", "),
    failed: requests.filter((r) => / failed /.test(r.text)).length,
    datasets: datasets.size,
    lastRequest: ms(requests.at(-1)?.at),
    lastLive: ms(live.at(-1)?.at),
  });
}
console.log("| Phase | Requests | By system | Failed | Datasets changed | Last request answered (ms) | Last source live (ms) |");
console.log("| --- | ---: | --- | ---: | ---: | ---: | ---: |");
for (const r of rows) console.log(`| ${r.phase} | ${r.requests} | ${r.by || "-"} | ${r.failed} | ${r.datasets} | ${r.lastRequest} | ${r.lastLive} |`);
