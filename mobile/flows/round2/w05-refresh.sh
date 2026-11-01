#!/usr/bin/env bash
# W5: the app draws at the screen's full rate, proven on Jadwal's agenda (round 2). On the lab's `mid` (one 120 Hz
# display mode, apps that ask for nothing kept at 60), installs the APK, opens the demo, goes to Jadwal, scrolls the
# agenda three times (mobile/qa/refresh.sh) and fails unless the frames come at ~8.3 ms (median ≤ 9 ms).
#
#   ANDROID_SERIAL=emulator-5564 bash mobile/flows/round2/w05-refresh.sh <apk> [tab]
#
# `tab`: the tab's testID to scroll (tab.schedule; round 1 had the same id).
set -euo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")/../../qa" && pwd)
. "$here/env.sh"
apk=${1:?the APK}
tab=${2:-tab.schedule}
app=$QA_APP
adb install -r "$apk" > /dev/null
adb shell pm clear "$app" > /dev/null
adb shell "am start -a android.intent.action.VIEW -d 'edunexplusdemo://demo?EDUNEX_DEMO=signed-in'" > /dev/null
# The demo's first sync, then its tab.
for _ in $(seq 1 60); do
  adb shell uiautomator dump /sdcard/w05.xml > /dev/null 2>&1 || true
  bounds=$(adb shell cat /sdcard/w05.xml 2> /dev/null | grep -o "resource-id=\"$tab\"[^>]*bounds=\"[^\"]*\"" | grep -o 'bounds="[^"]*"' | grep -o '[0-9]\+' | tr '\n' ' ' || true)
  [ -n "$bounds" ] && break
  sleep 2
done
[ -n "$bounds" ] || { echo "w05: $tab never showed"; exit 1; }
set -- $bounds
adb shell input tap $((($1 + $3) / 2)) $((($2 + $4) / 2))
sleep 3
out=$(bash "$here/refresh.sh")
echo "$out"
median=$(echo "$out" | grep "the app draws at" | grep -o 'median [0-9.]* ms' | grep -o '[0-9.]\+')
echo "w05: median frame to frame ${median:-?} ms"
awk -v m="${median:-99}" 'BEGIN { exit !(m <= 9) }' && echo "w05: PASS (full rate)" || { echo "w05: FAIL (not the screen's full rate)"; exit 1; }
