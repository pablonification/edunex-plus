#!/usr/bin/env bash
# The seven journeys of mobile/flows/journeys/, run on the one USB phone from this Mac, timed, one line each:
#
#   ANDROID_SERIAL=<serial> mobile/qa/journeys.sh [flow...]
#
#   flow: a journey's file, name or number ("04", "04-after-class", "mobile/flows/journeys/04-after-class.yaml");
#         none = all seven. Exit 0 only if every journey passed and none took more taps than its hill allows.
#
# One line per journey: its name, PASS or FAIL (with the step that failed), the taps to its goal, the hill's limit, the seconds.
#   journey            result   taps  limit  seconds
#   04-after-class     PASS        2      2     41.3
# The taps are counted from the flow's own comments: every "# tap <n>: ..." line before a "# goal" line. A flow may have several
# goals (06 has six: each office thing from Beranda): the number shown is the most taps any one goal took. Taps after the last goal
# (the way Back, what's walked "not counted") are never counted. The limit is the flow's own "# limit: <n>" line.
# "# gap: ..." lines of a flow (what the demo can't do as the hill words it) are printed under its line, so a pass is not read as more.
#
# What it never does: it touches no package but the demo's (io.github.pablonification.edunexplus.demo): Maestro runs the flows,
# and the flows themselves are the only thing that clears that app's own data (`clearState`, the demo's made-up student). It never
# uninstalls or installs anything, never `pm clear`s, never changes a setting, never pushes a file: the one file 03 needs
# (jawaban.pdf in Downloads) is only checked for, and the command that puts it there is printed.
# The phone-side commands are read-only: `adb get-state`, `pm path <demo>`, `ls /sdcard/Download/jawaban.pdf`.
#
# UNVERIFIED: written on a Mac with no phone, from phone.sh and the other scripts. `bash -n` and a stub `maestro`/`adb` only;
# Maestro's failure line ("❌ ..."), read here to say which step failed, is as Maestro 1.x prints it and was not seen on this Mac's run.
set -uo pipefail

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
root=$(cd "$here/../.." && pwd)
journeys=$root/mobile/flows/journeys
export ANDROID_HOME=${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}
export PATH="$ANDROID_HOME/platform-tools:$HOME/.maestro/bin:$PATH"
export MAESTRO_CLI_NO_ANALYTICS=1
APP=io.github.pablonification.edunexplus.demo
OUT=${JOURNEYS_OUT:-$HOME/hill-climb/run/journeys}/$(date +%Y%m%d-%H%M%S)

die() {
  echo "journeys.sh: $*" >&2
  exit 2
}

[[ -n ${ANDROID_SERIAL:-} ]] || die "set ANDROID_SERIAL to the phone's serial (adb devices)"
command -v maestro > /dev/null || die "maestro not found (expected in ~/.maestro/bin)"
command -v adb > /dev/null || die "adb not found (expected in \$ANDROID_HOME/platform-tools)"
[[ $(adb -s "$ANDROID_SERIAL" get-state 2> /dev/null) == device ]] || die "no phone answers as $ANDROID_SERIAL"
adb -s "$ANDROID_SERIAL" shell pm path "$APP" 2> /dev/null | grep -q '^package:' || die "the demo ($APP) is not installed on $ANDROID_SERIAL"

# Which flows.
files=()
if [[ $# -eq 0 ]]; then
  for f in "$journeys"/0*.yaml; do files+=("$f"); done
else
  for arg in "$@"; do
    if [[ -f $arg ]]; then
      files+=("$arg")
      continue
    fi
    match=("$journeys"/"$arg"*.yaml)
    [[ -f ${match[0]} ]] || die "no journey called \"$arg\" in mobile/flows/journeys"
    files+=("${match[0]}")
  done
fi
mkdir -p "$OUT" || die "can't make $OUT"

# Taps and limit, from a flow's comments. Prints "<taps> <limit>".
count() {
  awk '
    /^# limit:/ { limit = $3 }
    /^# tap [0-9]+/ { n++ }
    /^# goal/ { if (n > most) most = n; n = 0; goals++ }
    END { printf "%d %d %d\n", (goals ? most : n), (limit == "" ? -1 : limit), goals }
  ' "$1"
}

printf '%-18s %-6s %5s %6s %8s\n' journey result taps limit seconds
failed=0
for flow in "${files[@]}"; do
  name=$(basename "$flow" .yaml)
  read -r taps limit goals < <(count "$flow")
  log=$OUT/$name.txt
  result=PASS
  why=""
  start=$(date +%s)
  if [[ $name == 03-* ]] && ! adb -s "$ANDROID_SERIAL" shell ls /sdcard/Download/jawaban.pdf > /dev/null 2>&1; then
    result=FAIL
    why="jawaban.pdf is not in the phone's Downloads: adb -s \$ANDROID_SERIAL push mobile/flows/files/jawaban.pdf /sdcard/Download/jawaban.pdf"
  else
    maestro --device "$ANDROID_SERIAL" test --test-output-dir "$OUT/$name" "$flow" > "$log" 2>&1 || result=FAIL
    if [[ $result == FAIL ]]; then
      # Maestro marks the step that failed with a cross; else the last lines are the reason.
      why=$(grep -m1 -E '❌|FAILED|Failed' "$log" | sed 's/^[[:space:]]*//' | cut -c1-140)
      [[ -n $why ]] || why=$(tail -n 2 "$log" | tr '\n' ' ' | cut -c1-140)
    fi
  fi
  secs=$(($(date +%s) - start))
  over=""
  if [[ $limit -ge 0 && $taps -gt $limit ]]; then
    over="over its limit"
    result=FAIL
    [[ -n $why ]] || why="$taps taps, the hill allows $limit"
  fi
  [[ $goals -ge 1 || $limit -eq 0 ]] || why="${why:+$why; }no # goal in the flow: taps not counted"
  printf '%-18s %-6s %5s %6s %7ss\n' "$name" "$result" "$taps" "$([[ $limit -ge 0 ]] && echo "$limit" || echo '?')" "$secs"
  [[ -z $why ]] || printf '    %s\n' "$why"
  grep -E '^# (gap|unverified):' "$flow" | sed 's/^# /    /'
  [[ $result == PASS ]] || failed=1
done
echo "Logs: $OUT"
exit $failed
