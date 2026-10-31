#!/usr/bin/env bash
# Flashlight's performance score (https://github.com/bamlab/flashlight) over a Maestro flow:
#
#   mobile/qa/flashlight.sh [--flow mobile/qa/flows/flashlight.yaml] [--iterations 5]
#
# `flashlight test` closes the app before each iteration, runs the flow (which opens the demo from its
# saved data, scrolls Tugas and goes through every tab) and samples the app's CPU, RAM and FPS meanwhile;
# `flashlight report` makes the web report (score, charts) in C:\qa\runs\<time>-flashlight-<avd>\report\.
# Prints the averages from the results. Maestro reads the screen between its steps (accessibility), which
# the app pays for: compare Flashlight's numbers with Flashlight's, not with jank.sh's.
set -euo pipefail
here=$(cygpath -m "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)")
. "$here/env.sh"
. "$here/lib.sh"

flow=$here/flows/flashlight.yaml iterations=5
while [ $# -gt 0 ]; do
  case $1 in
    --flow) flow=$(cygpath -m "$2"); shift 2 ;;
    --iterations) iterations=$2; shift 2 ;;
    *) sed -n '2,12p' "$0"; exit 2 ;;
  esac
done
out=$(qa_run_dir flashlight)
echo "Flashlight on $AVD ($S), $iterations iterations of $(basename "$flow") → $out"
cd "$out"
qa_logcat_start "$out/logcat.txt"
flashlight.exe test --bundleId "$QA_APP" \
  --testCommand "maestro.bat --device $S test --no-ansi --no-reinstall-driver $(cygpath -m "$flow")" \
  --iterationCount "$iterations" --resultsFilePath "$(cygpath -m "$out/results.json")" \
  --resultsTitle "$AVD $(date +%Y-%m-%d)" > "$out/flashlight.txt" 2>&1 || { tail -20 "$out/flashlight.txt"; exit 1; }
qa_logcat_stop
flashlight.exe report "$(cygpath -m "$out/results.json")" -o "$(cygpath -m "$out/report")" > /dev/null 2>&1 || true
{
  echo
  echo "Flashlight, $AVD ($S), $iterations iterations:"
  echo
  node "$here/flashlight-summary.mjs" "$out/results.json"
  echo
  echo "Report: $(cygpath -w "$out/report")"
  node "$here/perf-summary.mjs" "$out/logcat.txt"
} | tee "$out/summary.md"
