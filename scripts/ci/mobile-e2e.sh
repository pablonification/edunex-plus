#!/usr/bin/env bash
# Runs the phone app's Maestro flows on the emulator that is already up (the mobile
# workflow's e2e job), and keeps everything a reader needs in one folder: JUnit
# results, screenshots, Maestro's own logs and the emulator's log.
#
#   scripts/ci/mobile-e2e.sh <apk> <out-dir> [glob]
#
# glob: which flows, from mobile/flows (default: all of them, "**/*"). A folder named
# `expected` (inventories, not flows), `judge` (the walk judge-light/-dark.yaml run with a theme)
# and Maestro's config.yaml are never run on their own.
set -uo pipefail

apk=$1
out=$(mkdir -p "$2" && cd "$2" && pwd)
pattern=${3:-'**/*'}
root=$(pwd)

adb install -r "$apk" || exit 1
# The phone shows times in its own time zone, as the desktop does the computer's: the emulator is put in
# Bandung's (WIB), where the demo and every Student are, so the pictures and the inventory's times agree.
adb shell settings put global auto_time_zone 0
adb shell setprop persist.sys.timezone Asia/Jakarta
adb shell cmd alarm set-timezone Asia/Jakarta > /dev/null 2>&1 || true
echo "Emulator time: $(adb shell date)"
# A busy emulator's own launcher can stop answering for a while: Android's "isn't responding" dialog would
# then stay over the app under test and hide every screen from the flows. No more of them, and Back closes
# one already up (as "Wait").
adb shell settings put global hide_error_dialogs 1
for _ in 1 2 3; do
  adb shell dumpsys window windows 2> /dev/null | grep -q "Application Not Responding" || break
  adb shell input keyevent KEYCODE_BACK
  sleep 2
done
adb logcat -c
adb logcat > "$out/logcat.txt" 2>&1 &
logcat=$!
trap 'kill "$logcat" 2> /dev/null' EXIT

shopt -s globstar nullglob
cd "$root/mobile/flows" || exit 1
flows=()
# shellcheck disable=SC2206 # the glob is meant to expand here
candidates=($pattern)
for flow in "${candidates[@]}"; do
  [[ -f $flow && ($flow == *.yaml || $flow == *.yml) ]] || continue
  name=$(basename "$flow")
  [[ /$flow == */expected/* || /$flow == */judge/* || $name == config.yaml || $name == config.yml ]] && continue
  flows+=("$PWD/$flow")
done
if [ ${#flows[@]} -eq 0 ]; then
  echo "::error::No flow in mobile/flows matches \"$pattern\"."
  exit 1
fi
printf 'Running %d flow(s):\n' "${#flows[@]}"
printf '  %s\n' "${flows[@]#"$root/"}"

# From inside the output folder, so takeScreenshot's pictures land there too.
cd "$out" || exit 1
# --debug-output keeps each look's result (commands.json), which mobile/scripts/flows-from-inventory-report.mjs counts.
maestro test --format junit --output "$out/junit.xml" --test-output-dir "$out/maestro" --debug-output "$out/debug" "${flows[@]}"
