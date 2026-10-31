#!/usr/bin/env bash
# Cold start of the demo release APK, timed from the system log (the ported ~/tools/coldstart.sh of
# PROGRESS.md's "Performance (round 2)"):
#
#   mobile/qa/coldstart.sh <apk> [--runs 5] [--only fresh|saved]
#
# fresh: uninstall, install, open the demo's signed-in link: Android's START to the app's
#        "[startup] shown" (Beranda drawn, the splash starts to fade). In the demo the first frame
#        already has Beranda's data (seen in a screen recording; README.md "Cold start").
# saved: force-stop, open the link with EDUNEX_DEMO_RESUME=1 (start from the saved data): START to
#        "[startup] shown".
# Each also gives START to `Running "main"` (JS starts) and Android's own "Displayed", and, in builds that
# have it, `[perf] first-data`. Prints a table with every run and the median; keeps each run's logcat
# and the [perf] summary in C:\qa\runs\<time>-coldstart-<avd>\.
set -euo pipefail
here=$(cygpath -m "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)")
. "$here/env.sh"
. "$here/lib.sh"

apk= runs=5 only=
while [ $# -gt 0 ]; do
  case $1 in
    --runs) runs=$2; shift 2 ;;
    --only) only=$2; shift 2 ;;
    *) apk=$(cygpath -m "$1"); shift ;;
  esac
done
[ -f "$apk" ] || { sed -n '2,15p' "$0"; exit 2; }
out=$(qa_run_dir coldstart)
echo "Cold start on $AVD ($S), $(basename "$apk") ${sha:=$(qa_apk_sha "$apk")}, $runs runs each → $out"
printf 'kind\trun\tinstall_ms\tjs_start_ms\tshown_ms\tdisplayed_ms\tfirst_data_ms\n' > "$out/runs.tsv"

# One start: logcat from before the link to a little after Beranda (the app's own refresh, [perf] lines).
measure() {
  local kind=$1 run=$2 link=$3 install_ms=${4:-} log="$out/$1-$2.logcat.txt"
  qa_logcat_start "$log"
  qa_open "$link"
  if ! qa_wait_for "$log" 'ReactNativeJS.*\[startup\] shown' 90; then
    qa_logcat_stop
    echo "  $kind $run: no \"[startup] shown\" in 90 s (see $log)"
    printf '%s\t%s\t%s\t\t\t\t\n' "$kind" "$run" "$install_ms" >> "$out/runs.tsv"
    return
  fi
  # The start-up refresh and any [perf] first-data come after the first frame.
  qa_wait_for "$log" 'ReactNativeJS.*\[perf\] first-data' 8 || true
  sleep 2
  qa_logcat_stop
  local start js shown displayed first
  start=$(qa_time_of "$log" "ActivityTaskManager: START u0 .*$QA_APP")
  js=$(qa_ms "$start" "$(qa_time_of "$log" 'ReactNativeJS: Running "main"')")
  shown=$(qa_ms "$start" "$(qa_time_of "$log" 'ReactNativeJS.*\[startup\] shown')")
  # "Displayed <activity> for user 0: +1s234ms"
  displayed=$({ grep -E "Displayed $QA_APP" "$log" || true; } | head -1 | sed -nE 's/.*\+(([0-9]+)s)?([0-9]+)ms.*/\2 \3/p' | awk '{ print ($1 == "" ? 0 : $1) * 1000 + $2 }')
  first=$({ grep -E 'ReactNativeJS.*\[perf\] first-data' "$log" || true; } | head -1 | sed -nE 's/.*first-data ([0-9.]+).*/\1/p')
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$kind" "$run" "$install_ms" "$js" "$shown" "$displayed" "$first" >> "$out/runs.tsv"
  echo "  $kind $run: shown ${shown} ms (JS start ${js}, Displayed ${displayed}${first:+, first-data $first})"
}

if [ "$only" != saved ]; then
  for i in $(seq "$runs"); do
    ad uninstall "$QA_APP" > /dev/null 2>&1 || true
    t0=$(date +%s%N)
    ad install "$apk" > /dev/null
    install_ms=$((($(date +%s%N) - t0) / 1000000))
    # From the home screen, after the install's own work settles.
    dsh input keyevent HOME
    sleep 3
    measure fresh "$i" "$(qa_link 0)" "$install_ms"
    # The demo saves its data a moment after the first frame.
    sleep 4
  done
fi

if [ "$only" != fresh ]; then
  if ! dsh pm path "$QA_APP" > /dev/null 2>&1; then
    ad install "$apk" > /dev/null
    qa_open "$(qa_link 0)"
    sleep 15
  fi
  for i in $(seq "$runs"); do
    dsh am force-stop "$QA_APP"
    dsh input keyevent HOME
    sleep 3
    measure saved "$i" "$(qa_link 1)"
    sleep 2
  done
fi
dsh am force-stop "$QA_APP"

col() { awk -F'\t' -v k="$1" -v c="$2" 'NR > 1 && $1 == k { print $c }' "$out/runs.tsv"; }
row() {
  local kind=$1 label=$2 c=$3
  local vals
  vals=$(col "$kind" "$c" | paste -sd' ' -)
  [ -n "${vals// /}" ] || return 0
  printf '| %s | %s | %s | %s |\n' "$label" "$kind" "$(col "$kind" "$c" | qa_median)" "$vals"
}
{
  echo
  echo "Cold start, $AVD, demo release ${sha:-?} (ms; median of $runs):"
  echo
  echo "| measure | start | median | runs |"
  echo "| --- | --- | ---: | --- |"
  for kind in fresh saved; do
    row "$kind" "START → [startup] shown (Beranda with data)" 5
    row "$kind" "START → JS starts (Running \"main\")" 4
    row "$kind" "START → Displayed (Android)" 6
    row "$kind" "[perf] first-data" 7
    row "$kind" "adb install" 3
  done
  echo
  node "$here/perf-summary.mjs" "$out"/*.logcat.txt
} | tee "$out/summary.md"
