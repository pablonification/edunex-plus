#!/usr/bin/env bash
# How many words a tab's first screen shows (the judge's measure: a tab's first screen ≤ ~45 words):
#
#   mobile/qa/words.sh <serial> <home|schedule|tasks|courses|profile> [--keep]
#
# Starts the signed-in demo fresh (its data cleared, Android's light theme, the font at 1.0), waits for its first
# read to settle, opens the tab, and dumps the screen as it first shows (no scrolling) with uiautomator. words.mjs
# counts the words of the app's visible text above the bottom navigation (the status bar and the tabs' labels are
# left out). Prints the count and each text. --keep starts from the app as it is (no fresh start).
# Raw dump: C:\qa\runs\<time>-words-<tab>-<avd>\ in the lab; on GitHub Actions' emulator (scripts/ci/mobile-e2e.sh),
# $QA_OUT/runs/... with QA_OUT set by the caller.
set -euo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# The lab's Windows tools (env.sh); elsewhere adb and node are on the PATH already.
if command -v cygpath > /dev/null; then
  here=$(cygpath -m "$here")
  . "$here/env.sh"
fi
QA_OUT=${QA_OUT:-/tmp/qa}
QA_APP=${QA_APP:-io.github.pablonification.edunexplus.demo}

serial=${1:-}
tab=${2:-}
keep=0
[ "${3:-}" = --keep ] && keep=1
case "$tab" in home | schedule | tasks | courses | profile) ;; *)
  sed -n '2,10p' "$0"
  exit 2
  ;;
esac
[ -n "$serial" ] || { sed -n '2,10p' "$0"; exit 2; }
export ANDROID_SERIAL=$serial
avd=$(adb emu avd name 2> /dev/null | head -1 | tr -d '\r' || echo phone)
out=$QA_OUT/runs/$(date +%Y%m%d-%H%M%S)-words-$tab-${avd:-phone}
mkdir -p "$out"

# Maestro's driver, left running by a flow, holds Android's UI automation: a dump next to it is killed.
adb shell am force-stop dev.mobile.maestro > /dev/null 2>&1 || true
adb shell am force-stop dev.mobile.maestro.test > /dev/null 2>&1 || true

dump() {
  adb shell uiautomator dump /sdcard/words.xml > /dev/null 2>&1 || true
  adb shell cat /sdcard/words.xml 2> /dev/null | tr -d '\r'
}
# The centre of the first node whose resource-id matches $1.
centre() {
  sed 's/<node /\n<node /g' | grep -E "resource-id=\"$1\"" | head -1 | sed -nE 's/.*bounds="\[([0-9]+),([0-9]+)\]\[([0-9]+),([0-9]+)\]".*/\1 \2 \3 \4/p' |
    awk '{ print int(($1 + $3) / 2), int(($2 + $4) / 2) }'
}
# Waits until the screen's texts stop changing (two dumps 2 s apart alike), at most $1 seconds.
settle() {
  local until=$((SECONDS + $1)) last= now
  while [ $SECONDS -lt $until ]; do
    now=$(dump | grep -oE ' text="[^"]*"' | md5sum)
    [ "$now" = "$last" ] && return 0
    last=$now
    sleep 2
  done
}

if [ $keep = 0 ]; then
  adb shell cmd uimode night no > /dev/null
  adb shell settings put system font_scale 1.0
  adb shell pm clear "$QA_APP" > /dev/null
  adb shell am start -a android.intent.action.VIEW -d "'edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_THEME=light'" > /dev/null
  for _ in $(seq 90); do
    dump | grep -q 'resource-id="tab.home"' && break
    sleep 2
  done
  # The demo's first read (SIX's pages, the check-in look) still changes the screen for a few seconds.
  settle 40
fi
at=$(dump | centre "tab\.$tab")
[ -n "$at" ] || { echo "No tab.$tab on screen (is the app open on its tabs?)" >&2; exit 1; }
adb shell input tap $at
sleep 1.5
settle 20
dump > "$out/dump.xml"
adb exec-out screencap -p > "$out/screen.png"
node "$here/words.mjs" "$out/dump.xml" --app "$QA_APP" | tee "$out/words.txt"
echo "($out)"
