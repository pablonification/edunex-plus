// Times each tap of taps.sh in its Perfetto traces (see taps.sh for what's measured) and prints a table:
// one row per step, the median over the traces.
//
//   node mobile/qa/taps-analyze.mjs <steps.tsv> <trace>... [--app <package>] [--json]
//
// From each trace (trace_processor_shell, on the PATH from env.sh):
// - the touches: the app's "deliverInputEvent" sections; one touch is the first of a group less than 300 ms
//   apart (down and up, a key's down and up), timed by its eventTimeNano (when it happened, not when the
//   app got it). A step is paired with the first touch after its own time in <trace>.times.txt (the phone's
//   /proc/uptime just before its `input`, written by taps.sh); a step with none (a Back the keyboard took)
//   shows "-";
// - the app's frames: SurfaceFlinger's frame timeline (actual_frame_timeline_slice), each frame on screen at
//   ts + dur; a frame the app's UI thread drew has a "DrawFrames <vsync id>" section on its RenderThread, while
//   one the RenderThread made alone (a ripple fading, Android's own animations) has none;
// - the JS threads (mqt_v_js): when they ran (sched).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  if (i < 0) return fallback;
  const [value] = args.splice(i, 2).slice(1);
  return value;
};
const app = flag("--app", process.env.QA_APP || "io.github.pablonification.edunexplus.demo");
const json = args.includes("--json") && args.splice(args.indexOf("--json"), 1);
const [stepsFile, ...traces] = args;
const steps = fs
  .readFileSync(stepsFile, "utf8")
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => {
    const [kind, name, id] = line.split("\t");
    return { kind, name, id };
  });

const sqlFile = path.join(os.tmpdir(), `qa-taps-${process.pid}.sql`);
const shell = process.platform === "win32" ? "trace_processor_shell.exe" : "trace_processor_shell";

/** Runs one query on a trace; rows as arrays of strings (trace_processor's CSV, quotes off). */
function query(trace, sql) {
  fs.writeFileSync(sqlFile, sql);
  const tp = spawnSync(shell, ["-q", sqlFile, trace], { encoding: "utf8", maxBuffer: 1 << 28 });
  if (tp.status !== 0) throw new Error(`trace_processor failed on ${trace}: ${tp.stderr || tp.error}`);
  const lines = tp.stdout.split(/\r?\n/).filter((l) => l && !l.startsWith("Query executed") && !l.startsWith("Trace loaded"));
  return lines.slice(1).map((l) => l.split(",").map((c) => c.replace(/^"|"$/g, "")));
}

const ms = (ns) => ns / 1e6;
const BURST_GAP = 300e6;
const UI_GAP = 250e6;
const JS_COMMIT = 5e6;

function analyse(trace) {
  const proc = `(select upid from process where name = '${app}')`;
  const touches = [];
  let last = -Infinity;
  for (const [ts, name] of query(
    trace,
    `select s.ts, s.name from slice s join thread_track tt on s.track_id = tt.id join thread t using(utid)
     where t.upid in ${proc} and s.name like 'deliverInputEvent%' order by s.ts`,
  )) {
    const t = Number(ts);
    if (t - last > BURST_GAP) {
      const event = /eventTimeNano=(\d+)/.exec(name);
      touches.push(event ? Number(event[1]) : t);
    }
    last = t;
  }
  const frames = query(
    trace,
    `with draws as (select substr(s.name, 12) as v from slice s join thread_track tt on s.track_id = tt.id join thread t using(utid)
       where t.upid in ${proc} and s.name glob 'DrawFrames *')
     select ts, dur, name in (select v from draws) from actual_frame_timeline_slice where upid in ${proc} order by ts`,
  ).map(([ts, dur, ui]) => ({ start: Number(ts), end: Number(ts) + Math.max(0, Number(dur)), ui: ui === "1" }));
  const js = query(
    trace,
    `select s.ts, s.dur, s.utid from sched s join thread t using(utid) where t.upid in ${proc} and t.name like 'mqt_v_js%' order by s.ts`,
  ).map(([ts, dur, utid]) => ({ start: Number(ts), end: Number(ts) + Number(dur), utid }));

  // Each step's touch: the first one after the step's own time, before the next step's.
  const timesFile = trace.replace(/\.pftrace$/, ".times.txt");
  const times = fs.existsSync(timesFile)
    ? fs.readFileSync(timesFile, "utf8").split(/\r?\n/).filter(Boolean).map((t) => Math.round(Number(t) * 1e9))
    : null;
  const paired = times
    ? times.map((t, i) => touches.find((touch) => touch >= t - 50e6 && touch < (times[i + 1] ?? Infinity)) ?? null)
    : touches;
  return paired.map((touch, i) => {
    if (touch == null) return null;
    const until = touches.find((t) => t > touch) ?? Infinity;
    const after = frames.filter((f) => f.start >= touch && f.start < until);
    const before = frames.some((f) => f.start >= touch - 100e6 && f.start < touch);
    if (after.length === 0) return { touch, responds: null, drawn: null, settled: null, freeze: null, longest: null, js: null, busy: before };
    let end = after[0].end;
    let freeze = 0;
    const burst = [after[0]];
    for (const f of after.slice(1)) {
      if (f.start - end > BURST_GAP) break;
      freeze = Math.max(freeze, f.start - end);
      end = Math.max(end, f.end);
      burst.push(f);
    }
    // The app's own drawing: its UI thread's frames. A ripple fades on the RenderThread alone and the UI thread
    // draws once more when it's gone, with no JS: that late frame isn't the screen. Data that arrives later is a
    // JS commit: UI frames after a pause count when the JS threads ran at least JS_COMMIT just before them.
    const jsBetween = (a, b) => js.reduce((sum, s) => sum + Math.max(0, Math.min(s.end, b) - Math.max(s.start, a)), 0);
    let drawn = null;
    let longest = 0;
    for (const f of burst.filter((f) => f.ui)) {
      if (drawn != null && f.start - drawn > UI_GAP && jsBetween(drawn, f.start) < JS_COMMIT) continue;
      drawn = Math.max(drawn ?? 0, f.end);
      longest = Math.max(longest, f.end - f.start);
    }
    // The JS threads' time running between the touch and the settled frame, and their longest unbroken run.
    let ran = 0;
    let jsLongest = 0;
    let run = null;
    for (const s of js) {
      if (s.end <= touch || s.start >= end) continue;
      const a = Math.max(s.start, touch);
      const b = Math.min(s.end, end);
      ran += b - a;
      if (run && run.utid === s.utid && a - run.end < 1e6) run.end = b;
      else run = { utid: s.utid, start: a, end: b };
      jsLongest = Math.max(jsLongest, run.end - run.start);
    }
    return {
      touch,
      responds: ms(after[0].end - touch),
      drawn: drawn == null ? null : ms(drawn - touch),
      settled: ms(end - touch),
      freeze: ms(freeze),
      longest: ms(longest),
      js: ms(ran),
      jsRun: ms(jsLongest),
      busy: before,
    };
  });
}

const perTrace = traces.map((t) => {
  const taps = analyse(t);
  if (taps.length !== steps.length || taps.includes(null)) {
    console.error(`${t}: ${taps.filter(Boolean).length} of ${steps.length} steps reached the app.`);
  }
  return taps;
});

const median = (values) => {
  const v = values.filter((x) => x != null).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const m = v.length >> 1;
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
};
const rows = steps.map((step, i) => {
  const taps = perTrace.map((taps) => taps[i]).filter(Boolean);
  const pick = (k) => median(taps.map((t) => t[k]));
  return {
    ...step,
    responds: pick("responds"),
    drawn: pick("drawn"),
    settled: pick("settled"),
    longest: pick("longest"),
    freeze: pick("freeze"),
    js: pick("js"),
    jsRun: pick("jsRun"),
    drawnEach: taps.map((t) => t.drawn),
    framesBefore: taps.some((t) => t.busy),
  };
});

if (json) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  const f = (v) => (v == null ? "-" : String(Math.round(v)));
  console.log("| step | kind | responds | drawn | all motion ends | longest frame | longest freeze | JS ran | JS longest run | drawn, each pass |");
  console.log("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |");
  for (const r of rows) {
    const note = r.framesBefore ? " (frames already running before the touch)" : "";
    console.log(
      `| ${r.name}${note} | ${r.kind} | ${f(r.responds)} | ${f(r.drawn)} | ${f(r.settled)} | ${f(r.longest)} | ${f(r.freeze)} | ${f(r.js)} | ${f(r.jsRun)} | ${r.drawnEach.map(f).join(", ")} |`,
    );
  }
}
