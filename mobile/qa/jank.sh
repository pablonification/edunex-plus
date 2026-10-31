#!/usr/bin/env bash
# Scrolling jank on long lists (the ported ~/tools/jank.sh of PROGRESS.md's "Performance (round 2)"):
#
#   mobile/qa/jank.sh [--list tasks|curriculum|all] [--swipes 12]
#
# For each list: the demo app started fresh from its saved data, a Maestro flow walks to the list
# (mobile/qa/flows/to-<list>.yaml), then `dumpsys gfxinfo <app> reset` and N swipes up with
# `adb shell input swipe` (250 ms each, 0.7 s apart). The swipes are adb's, not Maestro's: Maestro reads
# the screen between its steps, which costs the phone CPU and would count against the app.
# Prints janky frames, frame time percentiles and the rate frames came at (framestats, frame to frame);
# keeps gfxinfo, framestats, logcat and Maestro's output in C:\qa\runs\<time>-jank-<avd>\.
set -euo pipefail
here=$(cygpath -m "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)")
. "$here/env.sh"
. "$here/lib.sh"

lists="tasks curriculum" swipes=12
while [ $# -gt 0 ]; do
  case $1 in
    --list) [ "$2" = all ] || lists=$2; shift 2 ;;
    --swipes) swipes=$2; shift 2 ;;
    *) sed -n '2,11p' "$0"; exit 2 ;;
  esac
done
out=$(qa_run_dir jank)
read -r w h <<< "$(dsh wm size | grep -oE '[0-9]+x[0-9]+' | tail -1 | tr x ' ')"
echo "Jank on $AVD ($S, ${w}x$h), $swipes swipes per list → $out"

results=()
for list in $lists; do
  flow=$here/flows/to-$list.yaml
  [ -f "$flow" ] || { echo "No flow $flow" >&2; exit 1; }
  dsh am force-stop "$QA_APP"
  qa_logcat_start "$out/$list.logcat.txt"
  qa_open "$(qa_link 1)"
  qa_wait_for "$out/$list.logcat.txt" 'ReactNativeJS.*\[startup\] shown' 90 || { echo "The app didn't start." >&2; exit 1; }
  sleep 3
  maestro --device "$S" test --no-ansi --no-reinstall-driver --test-output-dir "$(cygpath -m "$out/maestro-$list")" "$(cygpath -m "$flow")" > "$out/maestro-$list.txt" 2>&1 ||
    { echo "Maestro couldn't reach the list ($out/maestro-$list.txt)." >&2; exit 1; }
  # Nothing of Maestro's may run during the swipes.
  dsh am force-stop dev.mobile.maestro > /dev/null 2>&1 || true
  dsh am force-stop dev.mobile.maestro.test > /dev/null 2>&1 || true
  sleep 2
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
done
dsh am force-stop "$QA_APP"

{
  echo
  echo "Scrolling, $AVD ($S), $swipes swipes per list:"
  echo
  echo "| list | frames | janky | janky (legacy, > 16 ms) | p50 | p90 | p99 | GPU p50 | frame to frame (median) |"
  echo "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |"
  printf '%s\n' "${results[@]}"
  echo
  node "$here/perf-summary.mjs" "$out"/*.logcat.txt
} | tee "$out/summary.md"
