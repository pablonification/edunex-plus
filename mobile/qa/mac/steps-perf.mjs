// The app's own [perf] lines, step by step, for a taps.sh run: for each step, the first `[perf] tab|screen`
// after its touch and the longest `[perf] js-block` before the next touch; median over the passes. For screens
// that never stop drawing (Beranda's and Tugas' wave), where taps-analyze.mjs can't tell "drawn" from "still
// animating", these are the app's own tap → drawn times.
//
//   node mobile/qa/mac/steps-perf.mjs <taps run folder> <epoch − uptime offset, s>
//
// The offset: `adb shell 'echo $(date +%s.%N) $(cut -d" " -f1 /proc/uptime)'` on the same boot (the replay
// writes each touch's uptime, logcat writes epoch times).
import fs from "node:fs";
import path from "node:path";

const [dir, offsetArg] = process.argv.slice(2);
const offset = Number(offsetArg);
const steps = fs
  .readFileSync(path.join(dir, "steps.tsv"), "utf8")
  .trim()
  .split("\n")
  .map((l) => l.split("\t"));
const passes = fs
  .readdirSync(dir)
  .filter((f) => /^pass\d+\.times\.txt$/.test(f))
  .sort();
const median = (v) => {
  const s = v.filter(Number.isFinite).sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)] : NaN;
};
const per = steps.map(() => ({ drawn: [], block: [] }));
for (const file of passes) {
  const times = fs
    .readFileSync(path.join(dir, file), "utf8")
    .trim()
    .split("\n")
    .map((t) => Number(t) + offset);
  const log = fs
    .readFileSync(
      path.join(dir, file.replace(".times.txt", ".logcat.txt")),
      "utf8",
    )
    .split("\n");
  const lines = [];
  for (const l of log) {
    const m =
      /^\s*([0-9.]+).*ReactNativeJS.*\[perf\] (tab|screen|js-block) (\S+) ?(.*)$/.exec(
        l,
      );
    if (!m) continue;
    const [, at, kind, a, b] = m;
    // tab/screen: "<label> <ms>"; js-block: "<ms> <label>"
    const ms = Number(kind === "js-block" ? a : b.split(/\s+/)[0]);
    lines.push({ at: Number(at), kind, ms });
  }
  steps.forEach((_, i) => {
    const from = times[i];
    const to = times[i + 1] ?? from + 6;
    const inside = lines.filter((x) => x.at >= from && x.at < to);
    const drawn = inside.find((x) => x.kind !== "js-block");
    per[i].drawn.push(drawn ? drawn.ms : NaN);
    const blocks = inside.filter((x) => x.kind === "js-block").map((x) => x.ms);
    per[i].block.push(blocks.length ? Math.max(...blocks) : 0);
  });
}
console.log(
  "| step | kind | [perf] tap → drawn (median) | each pass | worst js-block until the next step (median) | each pass |",
);
console.log("| --- | --- | ---: | --- | ---: | --- |");
steps.forEach(([kind, name], i) => {
  if (kind === "scroll") return;
  const p = per[i];
  const f = (v) => (Number.isFinite(v) ? Math.round(v) : "-");
  console.log(
    `| ${name} | ${kind} | ${f(median(p.drawn))} | ${p.drawn.map(f).join(", ")} | ${f(median(p.block))} | ${p.block.map(f).join(", ")} |`,
  );
});
