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
# then stay over the app under test and hide every screen from the flows. Asked not to show them (and the
# watchdog below closes one that shows anyway).
adb shell settings put global hide_error_dialogs 1
adb logcat -c
adb logcat > "$out/logcat.txt" 2>&1 &
logcat=$!
# The setting above doesn't always hold on the emulator: every few seconds, an "isn't responding" dialog of the
# emulator's own apps (its launcher, Play services) is closed by stopping that app. One of the app under test
# stays, as the failure it is. Android titles the dialog's window "Application Not Responding: <process>".
app=${APP_ID:-io.github.pablonification.edunexplus.demo}
(
  while true; do
    hung=$(adb shell dumpsys window windows 2> /dev/null | grep -o "Application Not Responding: [A-Za-z0-9_.:]*" | head -1 | sed 's/.*: //; s/:.*//')
    if [[ -n $hung && $hung != "$app" ]]; then
      # A process ("com.google.android.gms.persistent") may be named past its package.
      adb shell pm path "$hung" > /dev/null 2>&1 || hung=${hung%.*}
      adb shell am force-stop "$hung" > /dev/null 2>&1
      echo "$(date -u +%H:%M:%S) closed $hung's not-responding dialog" >> "$out/anr.txt"
    fi
    sleep 5
  done
) &
watchdog=$!
trap 'kill "$logcat" "$watchdog" 2> /dev/null' EXIT

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
