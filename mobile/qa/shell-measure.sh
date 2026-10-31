#!/usr/bin/env bash
# The shell's numbers (mobile/qa/shell-notes.md, "Numbers"): installs a release APK, starts the demo
# (signed-in), runs a tour of the tabs and screens with Maestro, and sums up the app's own [perf] lines
# (tab switches, screen opens, JS blocks) and Android's frame stats for the tour.
#
#   ANDROID_SERIAL=emulator-5560 mobile/qa/shell-measure.sh <apk> <flow.yaml> <name>
#
# Uses the lab's env.sh and perf-summary.mjs (branch mobile-qa, C:\Users\Arqila\edunex-plus\mobile\qa).
set -euo pipefail
LAB=${QA_LAB:-C:/Users/Arqila/edunex-plus/mobile/qa}
. "$LAB/env.sh"
apk=$1 flow=$2 name=$3
S=${ANDROID_SERIAL:?set ANDROID_SERIAL}
out=$QA_OUT/runs/$(date +%Y%m%d-%H%M%S)-shell-$name-$S
mkdir -p "$out"
adb -s "$S" shell am force-stop "$QA_APP" || true
adb -s "$S" install -r "$apk" > /dev/null
adb -s "$S" shell pm clear "$QA_APP" > /dev/null
adb -s "$S" logcat -c
adb -s "$S" logcat -v epoch > "$out/logcat.txt" 2>&1 &
cat=$!
adb -s "$S" shell am start -a android.intent.action.VIEW -d "'edunexplusdemo://demo?EDUNEX_DEMO=signed-in'" "$QA_APP" > /dev/null
# The first read settles before the tour: Beranda drawn with data, then a quiet moment.
for _ in $(seq 120); do grep -q "\[perf\] first-data" "$out/logcat.txt" && break; sleep 1; done
sleep 8
adb -s "$S" shell dumpsys gfxinfo "$QA_APP" reset > /dev/null
echo "tour-start $(date +%s.%N)" > "$out/marks.txt"
maestro --device "$S" test "$flow" > "$out/maestro.txt" 2>&1 || echo "maestro failed: see $out/maestro.txt"
echo "tour-end $(date +%s.%N)" >> "$out/marks.txt"
adb -s "$S" shell dumpsys gfxinfo "$QA_APP" > "$out/gfxinfo.txt"
kill "$cat" 2> /dev/null || true
wait "$cat" 2> /dev/null || true
start=$(sed -n 's/^tour-start //p' "$out/marks.txt")
# Only the tour's lines: the JS blocks of the first read are the engine's, measured elsewhere.
awk -v s="$start" '$1 >= s' "$out/logcat.txt" > "$out/tour.txt"
node "$LAB/perf-summary.mjs" "$out/tour.txt" | tee "$out/summary.txt"
grep -E "Total frames rendered|Janky frames|50th percentile|90th percentile|99th percentile" "$out/gfxinfo.txt" | head -5 | tee -a "$out/summary.txt"
echo "$out"
