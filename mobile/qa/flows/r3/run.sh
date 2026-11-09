#!/usr/bin/env bash
# Round 3's five student jobs on the real phone, one after another, then a table: result, taps, seconds.
#
#   mobile/qa/flows/r3/run.sh <serial> [flow.yaml ...]
#
# <serial>: the phone as `adb devices` lists it. Flows: the five (01-05) unless named.
# Needs maestro (on PATH, or ~/.maestro/bin), node and adb, and the real app's QA build (EXPO_PUBLIC_R3_GUARD=1)
# signed in on the phone. Every flow is read-only (see the comment at the top of each).
#
# Each flow's files (Maestro's commands file and log, and its screenshot when a step fails: a real
# Student's screens) stay on this Mac, in ${R3_OUT:-$HOME/edunex-r3-runs}/<time>/<flow>/. Never commit them.
#
#   result   pass, FAIL, or note: passed, but the flow said there was nothing to measure (an "R3-NOTE",
#            e.g. SIX shows no Tandai Hadir right now); the note is printed under the table.
#   taps     the flow's tapOn steps that really ran (COMPLETED in Maestro's commands file), so a fallback
#            path's extra taps count. Back presses and swipes are not taps.
#   seconds  from the flow's first step to the end of its last (the app's start included, Maestro's
#            own start-up not); "wall" is the whole maestro run.
set -uo pipefail

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
if [ $# -lt 1 ]; then
  sed -n '2,18p' "$0" | sed 's/^# \{0,1\}//'
  exit 2
fi
serial=$1
shift

maestro=${MAESTRO:-$(command -v maestro || true)}
[ -n "$maestro" ] || maestro=$HOME/.maestro/bin/maestro
[ -x "$maestro" ] || { echo "No maestro (looked on PATH and in ~/.maestro/bin)." >&2; exit 1; }
command -v node > /dev/null || { echo "No node on PATH." >&2; exit 1; }
if command -v adb > /dev/null && [ "$(adb -s "$serial" get-state 2> /dev/null)" != "device" ]; then
  echo "adb doesn't see $serial as a ready device (adb devices)." >&2
  exit 1
fi

if [ $# -gt 0 ]; then
  flows=("$@")
else
  flows=("$here"/0[1-5]-*.yaml)
fi

out=${R3_OUT:-$HOME/edunex-r3-runs}/$(date +%Y%m%d-%H%M%S)
mkdir -p "$out"
now() { perl -MTime::HiRes=time -e 'printf "%.1f", time'; }

# Reads a flow's output folder: "<taps>\t<seconds>\t<notes>" (seconds "-" if Maestro left no commands file).
read_run() {
  node -e '
    const fs = require("fs"), path = require("path");
    const dir = process.argv[1];
    const files = [];
    const walk = (d) => {
      for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (/^commands.*\.json$/.test(e.name)) files.push(p);
      }
    };
    walk(dir);
    const steps = [];
    const collect = (v) => {
      if (Array.isArray(v)) v.forEach(collect);
      else if (v && typeof v === "object") {
        if (v.command && v.metadata) steps.push(v);
        else Object.values(v).forEach(collect);
      }
    };
    for (const f of files) {
      try { collect(JSON.parse(fs.readFileSync(f, "utf8"))); } catch {}
    }
    if (!steps.length) { process.stdout.write("?\t-\t"); process.exit(0); }
    const done = steps.filter((s) => s.metadata.status === "COMPLETED");
    const taps = done.filter((s) => Object.keys(s.command).some((k) => k.startsWith("tapOn") && s.command[k])).length;
    const notes = new Set();
    for (const s of done) for (const m of JSON.stringify(s.command).matchAll(/R3-NOTE: [^"]*/g)) notes.add(m[0]);
    const timed = steps.filter((s) => typeof s.metadata.timestamp === "number");
    const from = Math.min(...timed.map((s) => s.metadata.timestamp));
    const to = Math.max(...timed.map((s) => s.metadata.timestamp + (s.metadata.duration ?? 0)));
    const seconds = timed.length ? ((to - from) / 1000).toFixed(1) : "-";
    process.stdout.write(`${taps}\t${seconds}\t${[...notes].join(" | ")}`);
  ' "$1"
}

rows=()
notes=()
failed=0
for flow in "${flows[@]}"; do
  name=$(basename "$flow" .yaml)
  dir=$out/$name
  mkdir -p "$dir"
  echo "▶ $name"
  start=$(now)
  "$maestro" --device "$serial" test --no-ansi --test-output-dir "$dir" "$flow" > "$dir/maestro.txt" 2>&1
  code=$?
  wall=$(perl -e "printf '%.1f', $(now) - $start")
  IFS=$'\t' read -r taps seconds note <<< "$(read_run "$dir")"
  # No commands file: count the labelled taps Maestro printed (every tap in these flows is labelled "tap: …").
  if [ "$taps" = "?" ]; then
    taps=$(grep -c 'tap: .*COMPLETED' "$dir/maestro.txt" || true)
    note=$(grep 'R3-NOTE' "$dir/maestro.txt" | grep COMPLETED | grep -o 'R3-NOTE: [^.]*' | sort -u | paste -sd'|' - || true)
  fi
  if [ $code -ne 0 ]; then
    result=FAIL
    failed=1
  elif [ -n "$note" ]; then
    result=note
    notes+=("$name: $note")
  else
    result=pass
  fi
  rows+=("$name|$result|$taps|$seconds|$wall")
done

echo
printf '%-22s %-6s %5s %9s %9s\n' flow result taps seconds wall
printf '%-22s %-6s %5s %9s %9s\n' ---------------------- ------ ----- --------- ---------
for row in "${rows[@]}"; do
  IFS='|' read -r name result taps seconds wall <<< "$row"
  printf '%-22s %-6s %5s %9s %9s\n' "$name" "$result" "$taps" "$seconds" "$wall"
done
for n in "${notes[@]+"${notes[@]}"}"; do echo "note  $n"; done
echo
echo "Files: $out (a real account's screens: keep them off the repo)"
[ $failed -eq 0 ]
