// Flashlight's score and averages from a `flashlight test` results file, the way its web report computes
// them (packages/core/reporter/src/reporting/getScore.ts and helpers at v0.18.0, ported as is):
//
//   node mobile/qa/flashlight-summary.mjs <results.json>
//
// score = average(CPU score, FPS score) × (1 − share of the time a thread sat above 90% CPU), where
// CPU score = clamp(−0.3167 × average CPU % + 116, 0..100) and FPS score = average FPS × 100 / 60.
// Flashlight counts 60 fps as perfect: on a 120 Hz screen an app drawing at 120 scores over 100 there.
import fs from "node:fs";

const POLLING_INTERVAL = 500;
const results = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const iterations = results.iterations.filter((i) => i.status !== "FAILURE");

const average = (values) => {
  if (values.length === 0) return undefined;
  if (values.some((v) => v === undefined)) return undefined;
  return values.reduce((a, b) => a + b, 0) / values.length;
};
const averageMaps = (maps) => {
  const total = {};
  for (const map of maps) for (const [k, v] of Object.entries(map)) total[k] = (total[k] || 0) + v;
  return Object.fromEntries(Object.entries(total).map(([k, v]) => [k, v / maps.length]));
};
const minLength = Math.min(...iterations.map((i) => i.measures.length));
const measures = Array.from({ length: minLength }, (_, n) => {
  const at = iterations.map((i) => i.measures[n]);
  return {
    cpu: { perName: averageMaps(at.map((m) => m.cpu.perName)) },
    ram: average(at.map((m) => m.ram)),
    fps: average(at.map((m) => m.fps)),
  };
});
const highCpu = (ms, threshold = 90) => {
  const out = {};
  for (const m of ms) for (const [name, cpu] of Object.entries(m.cpu.perName)) if (cpu > threshold) out[name] = (out[name] || 0) + POLLING_INTERVAL;
  return out;
};
const averageHighCpu = averageMaps(iterations.map((i) => highCpu(i.measures)));

const perThread = {};
for (const m of measures) for (const [name, cpu] of Object.entries(m.cpu.perName)) perThread[name] = (perThread[name] || 0) + cpu / measures.length;
const cpu = Object.values(perThread).reduce((a, b) => a + b, 0);
const fps = average(measures.map((m) => m.fps));
const ram = average(measures.map((m) => m.ram));
const cpuScore = Math.min(Math.max(0, -0.31666666666667 * cpu + 116), 100);
const scores = [cpuScore];
if (fps !== undefined) scores.push((fps * 100) / 60);
const locked = Object.values(averageHighCpu).reduce((a, b) => a + b, 0);
const last = measures.at(-1);
const canHigh = !last || !(Object.keys(last.cpu.perName).length === 1 && Object.keys(last.cpu.perName)[0] === "Total");
const lockedShare = canHigh ? locked / (measures.length * POLLING_INTERVAL) : 0;
const score = Math.round(Math.max(0, average(scores) * (1 - lockedShare)));

const r1 = (v) => (v === undefined ? "-" : (Math.round(v * 10) / 10).toString());
console.log("| Flashlight | value |");
console.log("| --- | --- |");
console.log(`| score | ${score} / 100 |`);
console.log(`| average FPS | ${r1(fps)} |`);
console.log(`| average CPU (all threads, % of one core) | ${r1(cpu)} |`);
console.log(`| average RAM (MB) | ${r1(ram)} |`);
console.log(`| time with a thread over 90% CPU | ${Math.round(locked)} ms of ${measures.length * POLLING_INTERVAL} ms |`);
console.log(`| iterations | ${iterations.length} of ${results.iterations.length} passed, ${r1(average(iterations.map((i) => i.time)) / 1000)} s each |`);
const top = Object.entries(perThread).sort((a, b) => b[1] - a[1]).slice(0, 5);
console.log(`| busiest threads (CPU %) | ${top.map(([n, v]) => `${n} ${r1(v)}`).join(", ")} |`);
