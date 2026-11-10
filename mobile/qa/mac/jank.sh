#!/usr/bin/env bash
# jank.sh without Maestro (not installed on the Mac): the same measure, the walk to each list done by tapping
# testIDs found in `uiautomator dump` (ui-find.mjs, as taps.sh finds them).
#
#   mobile/qa/mac/run.sh jank.sh [--list "tasks schedule modules grades"] [--swipes 12]
#
# tasks: Tugas; schedule: Jadwal; modules: Kuliah → the first course (its Modul tab); grades: Profil → Nilai.
set -euo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
. "$here/env.sh"
. "$here/lib.sh"

lists="tasks schedule modules grades" swipes=12
while [ $# -gt 0 ]; do
  case $1 in
    --list) lists=$2; shift 2 ;;
    --swipes) swipes=$2; shift 2 ;;
    *) sed -n '2,8p' "$0"; exit 2 ;;
  esac
done
out=$(qa_run_dir jank)
read -r w h <<< "$(dsh wm size | grep -oE '[0-9]+x[0-9]+' | tail -1 | tr x ' ')"
echo "Jank on $AVD ($S, ${w}x$h), $swipes swipes per list → $out"

# Taps the first on-screen element whose testID matches (waits up to 20 s for it).
tap_id() {
  local xy
  for _ in $(seq 10); do
    dsh rm -f /sdcard/qa-ui.xml
    dsh uiautomator dump /sdcard/qa-ui.xml > /dev/null 2>&1 || true
    if xy=$(dsh cat /sdcard/qa-ui.xml 2> /dev/null | node "$here/ui-find.mjs" "$1" "$w" "$h"); then
      read -r x y _ <<< "$xy"
      dsh input tap "$x" "$y"
      sleep 2
      return 0
    fi
    sleep 2
  done
  echo "No $1 on screen." >&2
  return 1
}
walk() {
  case $1 in
    tasks) tap_id 'tab\.tasks' ;;
    schedule) tap_id 'tab\.schedule' ;;
    modules) tap_id 'tab\.courses' && tap_id 'row\.course\..*' ;;
    grades) tap_id 'tab\.profile' && tap_id 'row\.profile\.grades' ;;
    *) echo "Unknown list $1" >&2; return 1 ;;
  esac
}

# uiautomator dump needs a still screen (Beranda's wave never is): the walk runs with Android's animations off,
# the swipes with them on.
animations() { for k in window_animation_scale transition_animation_scale animator_duration_scale; do dsh settings put global "$k" "$1"; done; }
trap 'animations 1' EXIT
results=()
for list in $lists; do
  animations 0
  dsh am force-stop "$QA_APP"
  qa_logcat_start "$out/$list.logcat.txt"
  qa_open "$(qa_link 1)"
  qa_wait_for "$out/$list.logcat.txt" 'ReactNativeJS.*\[startup\] shown' 90 || { echo "The app didn't start." >&2; exit 1; }
  sleep 3
  walk "$list"
  animations 1
  sleep 2
  dsh screencap -p /sdcard/qa-list.png && ad pull /sdcard/qa-list.png "$out/$list.png" > /dev/null
  dsh dumpsys gfxinfo "$QA_APP" reset > /dev/null
  for _ in $(seq "$swipes"); do
    dsh input swipe $((w / 2)) $((h * 3 / 4)) $((w / 2)) $((h * 3 / 10)) 250
    sleep 0.7
  done
  sleep 1
  dsh dumpsys gfxinfo "$QA_APP" > "$out/$list.gfxinfo.txt"
  dsh dumpsys gfxinfo "$QA_APP" framestats > "$out/$list.framestats.txt"
  qa_logcat_stop
  g=$out/$list.gfxinfo.txt
  val() { grep -m1 "$1" "$g" | sed -E "s/.*$1:? *//" | tr -d '\r'; }
  total=$(val 'Total frames rendered')
  janky=$(val 'Janky frames' | sed -E 's/.*\((.*)\).*/\1/')
  legacy=$(grep -m1 'Janky frames (legacy)' "$g" | sed -E 's/.*\((.*)\).*/\1/' | tr -d '\r')
  p() { grep -m1 "^$1 percentile" "$g" | grep -oE '[0-9]+ms' | tr -d '\r'; }
  rate=$(awk -F, '/---PROFILEDATA---/ { p = !p; next } p && $1 ~ /^[0-9]+$/ { print $3 }' "$out/$list.framestats.txt" |
    awk 'NR > 1 { d = ($1 - prev) / 1e6; if (d > 0 && d < 40) print d } { prev = $1 }' | sort -n |
    awk '{ v[NR] = $1 } END { if (NR) printf "%.2f ms (%.0f fps)", v[int((NR + 1) / 2)], 1000 / v[int((NR + 1) / 2)] }')
  results+=("| $list | $total | $janky | $legacy | $(p 50th) | $(p 90th) | $(p 99th) | $(grep -m1 '50th gpu percentile' "$g" | grep -oE '[0-9]+ms') | ${rate:-?} |")
  echo "  ${results[${#results[@]}-1]}"
done
dsh am force-stop "$QA_APP"

{
  echo
  echo "Scrolling, $AVD ($S, Mac emulator), $swipes swipes per list:"
  echo
  echo "| list | frames | janky | janky (legacy, > 16 ms) | p50 | p90 | p99 | GPU p50 | frame to frame (median) |"
  echo "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |"
  printf '%s\n' "${results[@]}"
  echo
  node "$here/perf-summary.mjs" "$out"/*.logcat.txt
} | tee "$out/summary.md"
