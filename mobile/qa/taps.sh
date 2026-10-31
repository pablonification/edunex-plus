#!/usr/bin/env bash
# Tap → response, tab switch and screen open, from a Perfetto trace:
#
#   mobile/qa/taps.sh [--passes 3] [--gap 2.5] [--plan <file>]
#
# The plan (default mobile/qa/taps/plan.txt) is a list of steps from Beranda: tap an element by its
# testID (a regex), or press Back. First a discovery pass walks it once, finding each element's centre in
# `uiautomator dump`. Then each measured pass starts the app afresh from its saved data, records a
# Perfetto trace (perfetto/taps.pbtx: frame timeline, input, gfx/view/am/wm, scheduler) and replays the
# same taps with `input tap`, a gap apart, with nothing else reading the screen. taps-analyze.mjs then
# times each tap from the touch (the input event's own time) to:
#   responds  the first frame of the app's on screen after the touch (any change: a pressed row, a tab);
#   settled   the last frame of the burst that follows (frames less than 300 ms apart): the new screen
#             drawn, its transition and data included;
# with the longest wait between frames inside it (a freeze) and how long the JS thread ran.
# Prints each step's median over the passes; keeps the traces in C:\qa\runs\<time>-taps-<avd>\
# (open one in https://ui.perfetto.dev to see a tap's frames).
set -euo pipefail
here=$(cygpath -m "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)")
. "$here/env.sh"
. "$here/lib.sh"

passes=3 gap=2.5 plan=$here/taps/plan.txt
while [ $# -gt 0 ]; do
  case $1 in
    --passes) passes=$2; shift 2 ;;
    --gap) gap=$2; shift 2 ;;
    --plan) plan=$(cygpath -m "$2"); shift 2 ;;
    *) sed -n '2,18p' "$0"; exit 2 ;;
  esac
done
out=$(qa_run_dir taps)
read -r w h <<< "$(dsh wm size | grep -oE '[0-9]+x[0-9]+' | tail -1 | tr x ' ')"
echo "Taps on $AVD ($S), $passes passes of $(basename "$plan"), ${gap} s apart → $out"

start_app() {
  # Maestro's driver (left by jank.sh, flashlight.sh or a helper's flow) holds UI automation: uiautomator dump fails.
  dsh am force-stop dev.mobile.maestro > /dev/null 2>&1 || true
  dsh am force-stop dev.mobile.maestro.test > /dev/null 2>&1 || true
  dsh am force-stop "$QA_APP"
  dsh input keyevent HOME
  sleep 2
  qa_logcat_start "$out/$1.logcat.txt"
  qa_open "$(qa_link 1)"
  qa_wait_for "$out/$1.logcat.txt" 'ReactNativeJS.*\[startup\] shown' 90 || { echo "The app didn't start." >&2; exit 1; }
  # The start-up refresh settles first.
  sleep 4
}

# Discovery: where each step's element is, on the screen the steps before it led to.
start_app discovery
: > "$out/steps.tsv"
while IFS='|' read -r kind name target; do
  trim() { sed -E 's/^[[:space:]]+|[[:space:]]+$//g' <<< "$1"; }
  kind=$(trim "$kind") name=$(trim "$name") target=$(trim "$target")
  [ -z "$kind" ] || [ "${kind:0:1}" = "#" ] && continue
  if [ "$target" = BACK ]; then
    printf '%s\t%s\tBACK\t\t\n' "$kind" "$name" >> "$out/steps.tsv"
    dsh input keyevent BACK
  else
    # Not on screen (a small phone shows less): scroll down a little, up to three times; the replay scrolls too.
    found=0
    for attempt in 0 1 2 3; do
      # A screen that's never still (a blinking cursor) can fail a dump: tried again, and an old dump never read.
      dsh rm -f /sdcard/qa-ui.xml
      for _ in 1 2 3; do dsh uiautomator dump /sdcard/qa-ui.xml 2> /dev/null | grep -q 'dumped to' && break; sleep 1; done
      dsh ls /sdcard/qa-ui.xml > /dev/null 2>&1 || break
      if xy=$(dsh cat /sdcard/qa-ui.xml | node "$here/ui-find.mjs" "$target" "$w" "$h"); then found=1; break; fi
      [ "$attempt" -lt 3 ] || break
      printf 'scroll\tscroll\tSCROLL\t%s\t%s,%s\n' $((w / 2)) $((h * 65 / 100)) $((h * 35 / 100)) >> "$out/steps.tsv"
      dsh input swipe $((w / 2)) $((h * 65 / 100)) $((w / 2)) $((h * 35 / 100)) 400
      sleep 1.5
    done
    if [ $found = 1 ]; then
      read -r x y id <<< "$xy"
      printf '%s\t%s\t%s\t%s\t%s\n' "$kind" "$name" "$id" "$x" "$y" >> "$out/steps.tsv"
      dsh input tap "$x" "$y"
    else
      # The rest of the plan would start from the wrong screen: measured up to here only.
      echo "  stopped at \"$name\": no $target on screen (the plan no longer fits the app?); measuring the steps before it"
      dsh screencap -p /sdcard/qa-lost.png && ad pull /sdcard/qa-lost.png "$out/discovery-lost.png" > /dev/null
      break
    fi
  fi
  sleep "$gap"
done < "$plan"
qa_logcat_stop
echo "  $(wc -l < "$out/steps.tsv") steps found"

# Each measured pass runs on the phone as one script: no adb round trips between the taps, and the phone's
# boot clock (the trace's) written before each one, so taps-analyze.mjs pairs every step with its own touch.
{
  echo ': > /data/local/tmp/qa-taps-times.txt'
  while IFS=$'\t' read -r kind name id x y; do
    echo 'cut -d" " -f1 /proc/uptime >> /data/local/tmp/qa-taps-times.txt'
    case $id in
      BACK) echo 'input keyevent BACK' ;;
      SCROLL) echo "input swipe $x ${y%,*} $x ${y#*,} 400"; echo 'sleep 1.5'; continue ;;
      *) echo "input tap $x $y" ;;
    esac
    echo "sleep $gap"
  done < "$out/steps.tsv"
} > "$out/replay.sh"
ad push "$out/replay.sh" /data/local/tmp/qa-taps.sh > /dev/null
# Perfetto's ftrace and process data come from traced_probes; once it was found dead on weak (a trace with frames
# but no input, scheduler or process names). Android's init restarts it for root.
if ! dsh pidof traced_probes > /dev/null; then
  echo "  traced_probes isn't running: starting it (as root, then back)"
  ad root > /dev/null; sleep 2; ad wait-for-device
  dsh setprop ctl.start traced_probes
  ad unroot > /dev/null; sleep 2; ad wait-for-device
  dsh pidof traced_probes > /dev/null || { echo "traced_probes still isn't running: restart the emulator." >&2; exit 1; }
fi
dsh mkdir -p /data/misc/perfetto-configs > /dev/null 2>&1 || true
ad push "$here/perfetto/taps.pbtx" /data/misc/perfetto-configs/qa-taps.pbtx > /dev/null
for pass in $(seq "$passes"); do
  start_app "pass$pass"
  trace=/data/misc/perfetto-traces/qa-taps-$pass.pftrace
  # --background-wait: back once tracing has started, so the first tap is in the trace.
  pid=$(dsh perfetto --txt -c /data/misc/perfetto-configs/qa-taps.pbtx -o "$trace" --background-wait | tr -d '\r')
  sleep 1
  dsh sh /data/local/tmp/qa-taps.sh
  # Perfetto drops its last seconds when stopped: the last step's frames stay well inside.
  sleep 4
  dsh kill -TERM "$pid"
  while dsh kill -0 "$pid" 2> /dev/null; do sleep 0.5; done
  qa_logcat_stop
  ad pull "$trace" "$out/pass$pass.pftrace" > /dev/null
  dsh cat /data/local/tmp/qa-taps-times.txt | tr -d '\r' > "$out/pass$pass.times.txt"
  dsh rm -f "$trace"
  echo "  pass $pass recorded"
done
dsh am force-stop "$QA_APP"

{
  echo
  echo "Taps, $AVD ($S), median of $passes passes (ms from the touch):"
  echo
  node "$here/taps-analyze.mjs" "$out/steps.tsv" "$out"/pass*.pftrace
  echo
  node "$here/perf-summary.mjs" "$out"/pass*.logcat.txt
} | tee "$out/summary.md"
