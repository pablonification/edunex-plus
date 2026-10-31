#!/usr/bin/env bash
# Every measurement on one emulator, in order, for one APK: cold start, scrolling, taps, the refresh rate
# and Flashlight. The summaries go together into C:\qa\runs\<time>-all-<avd>.md.
#
#   mobile/qa/measure-all.sh <apk> [--quick]
#
# --quick: 3 cold starts, 1 taps pass, 2 Flashlight iterations (for a look, not for the table).
# About 25 minutes on mid. Nothing else should run on the machine meanwhile (no build, no other emulator
# busy): the emulator shares the host's CPU.
set -euo pipefail
here=$(cygpath -m "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)")
. "$here/env.sh"
. "$here/lib.sh"

apk=$(cygpath -m "${1:?usage: measure-all.sh <apk> [--quick]}")
runs=5 passes=3 iterations=5
[ "${2:-}" = --quick ] && runs=3 passes=1 iterations=2
sum=$QA_OUT/runs/$(date +%Y%m%d-%H%M%S)-all-$AVD.md
mkdir -p "$(dirname "$sum")"
{
  echo "# $AVD, $(basename "$apk") $(qa_apk_sha "$apk" || true), $(date '+%Y-%m-%d %H:%M')"
  echo
  echo "Emulator: $(dsh getprop ro.build.version.release | tr -d '\r') (API $(dsh getprop ro.build.version.sdk | tr -d '\r')), $(dsh wm size | grep -oE '[0-9]+x[0-9]+' | tail -1), $(dsh wm density | grep -oE '[0-9]+' | tail -1) dpi, $(dsh nproc | tr -d '\r') cores, $(dsh cat /proc/meminfo | awk '/MemTotal/ { printf "%.1f GB", $2 / 1048576 }') RAM"
} > "$sum"

section() { echo; echo "## $1"; sed -n '/^$/,$p' "$2"; }
last() { ls -d "$QA_OUT"/runs/*-"$1"-"$AVD" | tail -1; }

bash "$here/coldstart.sh" "$apk" --runs "$runs"
section "a. Cold start" "$(last coldstart)/summary.md" >> "$sum"
bash "$here/jank.sh"
section "b. Scrolling" "$(last jank)/summary.md" >> "$sum"
bash "$here/taps.sh" --passes "$passes"
section "c. Taps, tabs and screens" "$(last taps)/summary.md" >> "$sum"
dsh am force-stop "$QA_APP"
qa_open "$(qa_link 1)"
sleep 8
{ echo; echo "## e. Refresh rate"; echo; bash "$here/refresh.sh"; } | tee -a "$sum"
dsh am force-stop "$QA_APP"
bash "$here/flashlight.sh" --iterations "$iterations"
section "d. Flashlight" "$(last flashlight)/summary.md" >> "$sum"
echo
echo "All in $(cygpath -w "$sum")"
