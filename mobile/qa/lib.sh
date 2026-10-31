# What the measurement scripts share (sourced after env.sh).

# The device ($ANDROID_SERIAL or the only one attached), its AVD's name ("mid", "weak"), and `ad`/`sh` for it.
S=$(qa_serial) || exit 1
export ANDROID_SERIAL=$S
AVD=$(adb emu avd name 2> /dev/null | head -1 | tr -d '\r')
AVD=${AVD:-$S}
ad() { adb -s "$S" "$@"; }
# (stdin from nowhere: adb shell would otherwise eat the input of a `while read` loop around it.)
dsh() { adb -s "$S" shell "$@" < /dev/null; }

# A fresh folder for this run's files: C:/qa/runs/<time>-<what>-<avd>.
qa_run_dir() {
  local dir
  dir=$QA_OUT/runs/$(date +%Y%m%d-%H%M%S)-$1-$AVD
  mkdir -p "$dir"
  echo "$dir"
}

# The demo app's start link (signed-in scenario; resume=1 starts from what it saved last time).
qa_link() {
  if [ "${1:-0}" = 1 ]; then echo "edunexplusdemo://demo?EDUNEX_DEMO=signed-in&EDUNEX_DEMO_RESUME=1"; else echo "edunexplusdemo://demo?EDUNEX_DEMO=signed-in"; fi
}
# The link has '&' and '?': quoted again for the device's shell.
qa_open() { dsh am start -a android.intent.action.VIEW -d "'$1'" "$QA_APP" > /dev/null; }

# logcat (epoch times) into a file from now on; qa_logcat_stop ends it.
# (adb itself, not the `ad` function: killing a function's subshell would leave adb.exe running on Windows.)
qa_logcat_start() {
  adb -s "$S" logcat -c
  adb -s "$S" logcat -v epoch > "$1" 2>&1 &
  QA_LOGCAT=$!
}
qa_logcat_stop() { kill "$QA_LOGCAT" 2> /dev/null; wait "$QA_LOGCAT" 2> /dev/null || true; }

# Waits until a line matching the pattern is in the file (seconds); false when it never came.
qa_wait_for() {
  local file=$1 pattern=$2 limit=${3:-60} start=$SECONDS
  until grep -qE "$pattern" "$file" 2> /dev/null; do
    [ $((SECONDS - start)) -lt "$limit" ] || return 1
    sleep 0.25
  done
}

# The epoch time (seconds, ms precision) of the first line matching the pattern.
qa_time_of() { { grep -E "$2" "$1" || true; } | head -1 | awk '{ print $1 }'; }
# Milliseconds between two epoch times.
qa_ms() { awk -v a="$1" -v b="$2" 'BEGIN { if (a == "" || b == "") print ""; else printf "%d", (b - a) * 1000 + 0.5 }'; }

# Median of numbers on stdin (empty lines ignored).
qa_median() { grep -E '^[0-9.]+$' | sort -n | awk '{ v[NR] = $1 } END { if (NR == 0) print "-"; else if (NR % 2) print v[(NR + 1) / 2]; else printf "%d\n", (v[NR / 2] + v[NR / 2 + 1]) / 2 }'; }

# Which build is installed: versionName and the APK's build.txt sha, when the APK came from build.sh.
qa_apk_sha() { local txt; txt=$(dirname "$1")/build.txt; [ -f "$txt" ] && sed -n 's/^sha=//p' "$txt" | cut -c1-10; }
