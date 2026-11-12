#!/usr/bin/env bash
# One place to measure the app on the real phone from this Mac (the conductor's Galaxy A52, over USB):
#
#   ANDROID_SERIAL=<serial> mobile/qa/phone.sh <command> [...]
#
#   info                       the phone's model, screen, font size, night mode, and what is in front (read only)
#   dump <name>                a `uiautomator dump` of the screen, pulled to $PHONE_DUMPS/<name>.xml, deleted from the phone
#   shot <name>                a screenshot to $PHONE_SHOTS/<name>.png (taken with exec-out: nothing is written on the phone)
#   cold <package> [runs]      cold start, median of [runs] (default 5): force-stop, start, then Android's START to the app's
#                              "[startup] shown", to JS start, to Android's "Displayed", and "[perf] first-data" when logged
#   tabs <package> [--from <dump>]
#                              tab switch: 3 tours of the tabs, tapped by their boxes from a dump of the tab bar, then p90 of
#                              the app's own "[perf] tab" lines (the board's number), the first tour (hidden tabs' first draw)
#                              and the warm two apart
#   jank <package> [swipes]    gfxinfo reset, [swipes] (default 12) flings up the screen in front, then janky %, p50/p90/p99
#   night yes|no               dark mode on or off, through `cmd uimode night`
#
# Folders: $PHONE_DUMPS (~/hill-climb/run/dumps), $PHONE_SHOTS (~/hill-climb/run/shots), and each measurement's logcat and
# summary in $PHONE_OUT/<time>-<command>/ (~/hill-climb/run/phone). Nothing goes in the repository.
#
# What it never does, and how that is kept: every command sent to the phone goes through `dev`, which runs only the exact
# commands of this list and stops on anything else: no reboot, no uninstall or install, no `pm clear`, no `settings put`, no
# lock or unlock, no other package's `force-stop` or start. The one setting it changes is night mode (`cmd uimode night`).
# Taps and swipes are sent only while the named package is in front. The package is the only one it stops or starts.
# Not run against a phone yet (written on a Mac with no phone): see "UNVERIFIED" notes below; `bash -n` and a stub `adb` only.
#
# Why it isn't coldstart.sh, jank.sh and taps.sh: they install and uninstall the APK (coldstart.sh), walk to the list with a
# Maestro flow and stop Maestro's own packages (jank.sh), or turn the animation scales off (taps.sh --still-discovery); each
# is a change this script may not make. They are written for another machine (env.sh, Redroid, an emulator) too. What is
# reused as it is: perf-summary.mjs, dump-lib.mjs and tab-centres.mjs; the log parsing and medians are copied from
# coldstart.sh, jank.sh and lib.sh. bash 3.2 (macOS's own) is enough.
set -euo pipefail

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
export PATH="$ANDROID_HOME/platform-tools:$PATH"
DUMPS=${PHONE_DUMPS:-$HOME/hill-climb/run/dumps}
SHOTS=${PHONE_SHOTS:-$HOME/hill-climb/run/shots}
OUT=${PHONE_OUT:-$HOME/hill-climb/run/phone}
DEVICE_DUMP=/sdcard/ph-ui.xml
serial=${ANDROID_SERIAL:-}
PKG=""
COMP=""
LOGPID=""

die() {
  echo "phone.sh: $*" >&2
  exit 1
}
usage() {
  sed -n '2,16p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
  exit "${1:-2}"
}

# Everything that runs on the phone. An exact list, checked as a whole line, so nothing can be added to a command's end.
dev() {
  local cmd="$*"
  if [[ $cmd =~ ^input\ tap\ [0-9]{1,5}\ [0-9]{1,5}$ ]] || [[ $cmd =~ ^input\ swipe(\ [0-9]{1,5}){4}\ [0-9]{1,4}$ ]]; then
    :
  else
    case "$cmd" in
      "uiautomator dump $DEVICE_DUMP" | "rm -f $DEVICE_DUMP") ;;
      "wm size" | "wm density" | "dumpsys window" | "dumpsys activity activities" | "dumpsys power") ;;
      "settings get system font_scale" | "getprop ro.product.model" | "getprop ro.build.version.release") ;;
      "cmd uimode night" | "cmd uimode night yes" | "cmd uimode night no") ;;
      "input keyevent HOME") ;;
      *)
        [ -n "$PKG" ] || die "refused to run on the phone: $cmd"
        case "$cmd" in
          "pm path $PKG" | "am force-stop $PKG" | "monkey -p $PKG -c android.intent.category.LAUNCHER 1") ;;
          "dumpsys gfxinfo $PKG" | "dumpsys gfxinfo $PKG reset" | "dumpsys gfxinfo $PKG framestats") ;;
          "cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.LAUNCHER $PKG") ;;
          "am start -n $COMP") [ -n "$COMP" ] || die "refused to run on the phone: $cmd" ;;
          *) die "refused to run on the phone: $cmd" ;;
        esac
        ;;
    esac
  fi
  adb -s "$serial" shell "$@" < /dev/null
}

cleanup() {
  [ -z "$LOGPID" ] || kill "$LOGPID" 2> /dev/null || true
  # A dump left on the phone by an interrupted run.
  if [ -n "$serial" ]; then adb -s "$serial" shell "rm -f $DEVICE_DUMP" < /dev/null > /dev/null 2>&1 || true; fi
}
trap cleanup EXIT

require_device() {
  [ -n "$serial" ] || { echo "Set ANDROID_SERIAL to one of:" >&2; adb devices >&2; exit 1; }
  [[ $serial =~ ^[A-Za-z0-9._:-]+$ ]] || die "ANDROID_SERIAL looks wrong: $serial"
  [ "$(adb -s "$serial" get-state 2> /dev/null || true)" = device ] || die "$serial isn't connected (adb devices says what is)"
}

need_pkg() {
  PKG=${1:-}
  [[ $PKG =~ ^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z0-9_]+)+$ ]] || die "a package name like io.github.name.app is needed (got: ${PKG:-nothing})"
  dev pm path "$PKG" | grep -q '^package:' || die "$PKG isn't installed on $serial"
}

name_ok() {
  [[ ${1:-} =~ ^[A-Za-z0-9._-]+(/[A-Za-z0-9._-]+)*$ && $1 != *..* ]] || die "a name like home-1 or main/home is needed (letters, digits, . _ -)"
}

# The phone must be awake and unlocked; this script never wakes or unlocks it.
awake_unlocked() {
  local lock wake
  lock=$(dev dumpsys window | grep -o 'isKeyguardShowing=[a-z]*' | head -1 || true)
  wake=$(dev dumpsys power | grep -o 'mWakefulness=[A-Za-z]*' | head -1 || true)
  case "$lock" in *true*) die "the phone is locked: unlock it yourself (this script never touches the lock)" ;; esac
  case "$wake" in "" | *Awake*) ;; *) die "the screen is off ($wake): wake it yourself" ;; esac
}

in_front() {
  local line
  line=$(dev dumpsys activity activities | grep -m1 -E 'topResumedActivity|mResumedActivity' || true)
  [[ $line == *" $PKG/"* ]]
}

# The app's launcher activity, as pkg/.Activity ("" when the phone doesn't say).
component() {
  local out
  out=$(dev cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.LAUNCHER "$PKG" 2> /dev/null | tr -d '\r' | tail -1 || true)
  COMP=""
  if [[ $out =~ ^$PKG/[A-Za-z0-9_.]+$ ]]; then COMP=$out; fi
}
start_app() {
  if [ -n "$COMP" ]; then dev am start -n "$COMP" > /dev/null; else dev monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 > /dev/null 2>&1; fi
}

newrun() {
  local dir
  dir=$OUT/$(date +%Y%m%d-%H%M%S)-$1
  mkdir -p "$dir"
  echo "$dir"
}

# logcat from now on, only the app's JavaScript lines and Android's activity lines (epoch times), into a file.
log_start() {
  adb -s "$serial" logcat -c
  adb -s "$serial" logcat -v epoch -s ReactNativeJS:I ActivityTaskManager:I > "$1" 2>&1 &
  LOGPID=$!
}
log_stop() {
  [ -z "$LOGPID" ] || { kill "$LOGPID" 2> /dev/null || true; wait "$LOGPID" 2> /dev/null || true; }
  LOGPID=""
}
wait_for() {
  local file=$1 pattern=$2 limit=${3:-60} start=$SECONDS
  until grep -qE "$pattern" "$file" 2> /dev/null; do
    [ $((SECONDS - start)) -lt "$limit" ] || return 1
    sleep 0.25
  done
}
# From coldstart.sh and lib.sh: the epoch time of a line, ms between two times, the median of a list.
time_of() { { grep -E "$2" "$1" || true; } | head -1 | awk '{ print $1 }'; }
ms_between() { awk -v a="$1" -v b="$2" 'BEGIN { if (a == "" || b == "") print ""; else printf "%d", (b - a) * 1000 + 0.5 }'; }
median() { grep -E '^[0-9.]+$' | sort -n | awk '{ v[NR] = $1 } END { if (NR == 0) print "-"; else if (NR % 2) print v[(NR + 1) / 2]; else printf "%d\n", (v[NR / 2] + v[NR / 2 + 1]) / 2 }'; }
# Nearest-rank p90 of a list.
p90() { grep -E '^[0-9.]+$' | sort -n | awk '{ v[NR] = $1 } END { if (NR == 0) print "-"; else { i = int(NR * 0.9); if (i < NR * 0.9) i++; print v[i] } }'; }

# A uiautomator dump of the screen into $1 ("" and a message in $LAST_ERROR when it won't). The file on the phone is removed.
LAST_ERROR=""
take_dump() {
  local dest=$1 out i
  for i in 1 2 3; do
    dev rm -f "$DEVICE_DUMP" > /dev/null 2>&1 || true
    out=$(dev uiautomator dump "$DEVICE_DUMP" 2>&1 || true)
    if [[ $out == *"dumped to"* ]]; then
      adb -s "$serial" pull "$DEVICE_DUMP" "$dest" > /dev/null
      dev rm -f "$DEVICE_DUMP" > /dev/null 2>&1 || true
      return 0
    fi
    sleep 1
  done
  dev rm -f "$DEVICE_DUMP" > /dev/null 2>&1 || true
  LAST_ERROR=$out
  return 1
}

cmd_info() {
  echo "serial   $serial"
  echo "model    $(dev getprop ro.product.model | tr -d '\r') (Android $(dev getprop ro.build.version.release | tr -d '\r'))"
  echo "screen   $(dev wm size | tr -d '\r' | tr '\n' ' ')"
  echo "density  $(dev wm density | tr -d '\r' | tr '\n' ' ')"
  echo "font     $(dev settings get system font_scale | tr -d '\r')"
  echo "night    $(dev cmd uimode night | tr -d '\r')"
  echo "lock     $(dev dumpsys window | grep -o 'isKeyguardShowing=[a-z]*' | head -1 || true)"
  echo "front    $(dev dumpsys activity activities | grep -m1 -E 'topResumedActivity|mResumedActivity' | sed -E 's/^ +//' || true)"
}

cmd_dump() {
  name_ok "${1:-}"
  local file=$DUMPS/$1.xml
  mkdir -p "$(dirname "$file")"
  if ! take_dump "$file"; then
    [ -z "$LAST_ERROR" ] || echo "$LAST_ERROR" >&2
    die "no dump. A screen that never goes still (Beranda's wave) can't be dumped by uiautomator: take Maestro's instead: maestro --device $serial hierarchy > $DUMPS/$1.maestro.json (the layout and target scripts read both)"
  fi
  echo "$file"
}

cmd_shot() {
  name_ok "${1:-}"
  local file=$SHOTS/$1.png tmp
  mkdir -p "$(dirname "$file")"
  tmp=$(mktemp)
  adb -s "$serial" exec-out screencap -p > "$tmp"
  # A PNG starts with the bytes 89 50 4e 47.
  [ "$(head -c 4 "$tmp" | od -An -tx1 | tr -d ' \n')" = 89504e47 ] || { rm -f "$tmp"; die "the screenshot isn't a PNG (the phone is locked, or the app blocks screenshots)"; }
  mv "$tmp" "$file"
  echo "$file"
}

cmd_night() {
  case "${1:-}" in yes | no) ;; *) die "night wants yes or no" ;; esac
  dev cmd uimode night "$1" > /dev/null
  dev cmd uimode night | tr -d '\r'
}

# "Displayed pkg/.Main for user 0: +1s234ms" (or +797ms: no seconds; ":" keeps the empty field in its place), in ms.
displayed_ms() {
  { grep -E "Displayed $PKG" "$1" || true; } | head -1 | sed -nE 's/.*\+(([0-9]+)s)?([0-9]+)ms.*/\2:\3/p' | awk -F: '{ print ($1 == "" ? 0 : $1) * 1000 + $2 }'
}
first_data_ms() {
  { grep -E 'ReactNativeJS.*\[perf\] first-data' "$1" || true; } | head -1 | sed -nE 's/.*first-data ([0-9.]+).*/\1/p'
}

cmd_cold() {
  need_pkg "${1:-}"
  local runs=${2:-5}
  [[ $runs =~ ^[0-9]+$ ]] && [ "$runs" -ge 1 ] && [ "$runs" -le 20 ] || die "runs is a number from 1 to 20"
  awake_unlocked
  component
  local out i log start js shown displayed first extra pat_main pat_shown t_js t_shown
  out=$(newrun cold)
  echo "Cold start of $PKG on $serial, $runs runs → $out (start: ${COMP:-the launcher})"
  printf 'run\tjs_start_ms\tshown_ms\tdisplayed_ms\tfirst_data_ms\n' > "$out/runs.tsv"
  for i in $(seq "$runs"); do
    dev am force-stop "$PKG"
    dev input keyevent HOME
    sleep 3
    log=$out/run-$i.logcat.txt
    log_start "$log"
    start_app
    # UNVERIFIED on this phone: "ActivityTaskManager: START" and "Displayed" lines in logcat (round 3's board used them on the A52).
    if ! wait_for "$log" 'ReactNativeJS.*\[startup\] shown' 60; then
      wait_for "$log" "Displayed $PKG" 20 || echo "  run $i: neither \"[startup] shown\" nor \"Displayed\" in 80 s (see $log)"
    fi
    wait_for "$log" 'ReactNativeJS.*\[perf\] first-data' 8 || true
    sleep 2
    log_stop
    # (the patterns sit in variables: bash 3.2 can't read quotes inside quotes inside $( ))
    pat_main='ReactNativeJS: Running "main"'
    pat_shown='ReactNativeJS.*\[startup\] shown'
    start=$(time_of "$log" "ActivityTaskManager: START u0 .*$PKG")
    t_js=$(time_of "$log" "$pat_main")
    t_shown=$(time_of "$log" "$pat_shown")
    js=$(ms_between "$start" "$t_js")
    shown=$(ms_between "$start" "$t_shown")
    displayed=$(displayed_ms "$log")
    first=$(first_data_ms "$log")
    printf '%s\t%s\t%s\t%s\t%s\n' "$i" "$js" "$shown" "$displayed" "$first" >> "$out/runs.tsv"
    extra=""
    [ -z "$first" ] || extra=", first-data $first"
    echo "  run $i: shown ${shown:-?} ms, JS start ${js:-?}, Displayed ${displayed:-?}$extra"
    sleep 2
  done
  col() { awk -F'\t' -v c="$1" 'NR > 1 { print $c }' "$out/runs.tsv"; }
  {
    echo
    echo "Cold start, $PKG, median of $runs (ms): START to [startup] shown $(col 3 | median) · to JS start $(col 2 | median) · to Displayed $(col 4 | median) · [perf] first-data $(col 5 | median)"
    echo "shown, every run: $(col 3 | tr '\n' ' ')"
    echo
    node "$here/perf-summary.mjs" "$out"/run-*.logcat.txt
  } | tee "$out/summary.md"
}

cmd_tabs() {
  need_pkg "${1:-}"
  shift
  local from=""
  if [ "${1:-}" = --from ]; then from=${2:-}; [ -f "$from" ] || die "--from wants a dump file"; fi
  awake_unlocked
  component
  if ! in_front; then
    start_app
    sleep 6
    in_front || die "$PKG isn't in front: open it on a tab and run again"
  fi
  local out dump
  out=$(newrun tabs)
  dump=$out/tabs-dump.xml
  # Where the tabs are: a dump now, else the one given, else the newest dump in $DUMPS that shows a tab bar.
  if [ -n "$from" ]; then
    :
  elif take_dump "$dump" && node "$here/tab-centres.mjs" "$dump" > /dev/null 2>&1; then
    from=$dump
  else
    local candidate
    for candidate in $(ls -t "$DUMPS"/*.xml "$DUMPS"/*.maestro.json 2> /dev/null); do
      if node "$here/tab-centres.mjs" "$candidate" > /dev/null 2>&1; then from=$candidate; break; fi
    done
    [ -n "$from" ] || die "no dump of the tab bar: run \`phone.sh dump <name>\` on a screen that dumps (or pass --from <dump>)"
    echo "  the live dump failed (a screen that never goes still); the tab bar is read from $from: the same phone, font size and tab bar are assumed"
  fi
  local ids=() xs=() ys=() id x y n=0
  while read -r id x y; do
    ids[n]=$id xs[n]=$x ys[n]=$y
    n=$((n + 1))
  done < <(node "$here/tab-centres.mjs" "$from")
  [ "$n" -ge 2 ] || die "fewer than two tabs found in $from"
  echo "Tab switch, $PKG on $serial: tabs ${ids[*]}; 3 tours → $out"
  local t k
  # Start on the first tab, so every tap of a tour changes tab; that first tap isn't measured.
  dev input tap "${xs[0]}" "${ys[0]}"
  sleep 3
  log_start "$out/tabs.logcat.txt"
  for t in 1 2 3; do
    in_front || { log_stop; die "$PKG left the front during tour $t: nothing more was tapped"; }
    for k in $(seq 1 $((n - 1))) 0; do
      dev input tap "${xs[k]}" "${ys[k]}"
      sleep 2.5
    done
  done
  sleep 2
  log_stop
  # UNVERIFIED: the "[perf] tab <name> <ms>" lines' shape on the phone (mobile/src/perf.ts writes them with console.log).
  { grep -E '\[perf\] tab ' "$out/tabs.logcat.txt" || true; } | sed -nE 's/.*\[perf\] tab ([A-Za-z0-9_.-]+) ([0-9.]+).*/\1 \2/p' > "$out/tabs.txt"
  local count expected=$((3 * n))
  count=$(wc -l < "$out/tabs.txt" | tr -d ' ')
  [ "$count" -gt 0 ] || die "no \"[perf] tab\" lines in the log (a build without them: see $out/tabs.logcat.txt)"
  {
    echo
    echo "Tab switch, $PKG: $count \"[perf] tab\" lines of $expected taps (ms, tap to drawn)"
    [ "$count" -eq "$expected" ] || echo "  (not every tap logged a line: a tap that didn't change the tab, or a tab that drew nothing new)"
    echo "p90 over all $count: $(awk '{ print $2 }' "$out/tabs.txt" | p90) ms · median $(awk '{ print $2 }' "$out/tabs.txt" | median) · max $(awk '{ print $2 }' "$out/tabs.txt" | sort -n | tail -1)"
    echo "first tour (hidden tabs drawn for the first time): p90 $(head -n "$n" "$out/tabs.txt" | awk '{ print $2 }' | p90) ms"
    echo "tours 2 and 3 (warm): p90 $(tail -n +$((n + 1)) "$out/tabs.txt" | awk '{ print $2 }' | p90) ms"
    echo "by tab (median ms):"
    awk '{ print $1 }' "$out/tabs.txt" | sort -u | while read -r name; do
      echo "  $name $(awk -v n="$name" '$1 == n { print $2 }' "$out/tabs.txt" | median)"
    done
  } | tee "$out/summary.md"
}

cmd_jank() {
  need_pkg "${1:-}"
  local swipes=${2:-12}
  [[ $swipes =~ ^[0-9]+$ ]] && [ "$swipes" -ge 1 ] && [ "$swipes" -le 60 ] || die "swipes is a number from 1 to 60"
  awake_unlocked
  in_front || die "$PKG isn't in front: open the list to fling first (this script doesn't walk there)"
  local out w h g f
  out=$(newrun jank)
  read -r w h <<< "$(dev wm size | tr -d '\r' | grep -oE '[0-9]+x[0-9]+' | tail -1 | tr x ' ')"
  echo "Jank, $PKG on $serial (${w}x$h), $swipes swipes → $out"
  dev dumpsys gfxinfo "$PKG" reset > /dev/null
  local i
  for i in $(seq "$swipes"); do
    dev input swipe $((w / 2)) $((h * 3 / 4)) $((w / 2)) $((h * 3 / 10)) 250
    sleep 0.7
  done
  sleep 1
  g=$out/gfxinfo.txt f=$out/framestats.txt
  dev dumpsys gfxinfo "$PKG" > "$g"
  dev dumpsys gfxinfo "$PKG" framestats > "$f"
  val() { grep -m1 "$1" "$g" | sed -E "s/.*$1:? *//" | tr -d '\r'; }
  pct() { grep -m1 "^$1 percentile" "$g" | grep -oE '[0-9]+ms' | tr -d '\r'; }
  local rate
  # From jank.sh: the rate frames came at, from framestats (frame to frame, median).
  rate=$(awk -F, '/---PROFILEDATA---/ { p = !p; next } p && $1 ~ /^[0-9]+$/ { print $3 }' "$f" |
    awk 'NR > 1 { d = ($1 - prev) / 1e6; if (d > 0 && d < 40) print d } { prev = $1 }' | sort -n |
    awk '{ v[NR] = $1 } END { if (NR) printf "%.2f ms (%.0f fps)", v[int((NR + 1) / 2)], 1000 / v[int((NR + 1) / 2)] }')
  {
    echo
    echo "Scrolling, $PKG, $swipes swipes:"
    echo "frames $(val 'Total frames rendered') · janky $(val 'Janky frames' | sed -E 's/.*\((.*)\).*/\1/') · janky (legacy, > 16 ms) $(grep -m1 'Janky frames (legacy)' "$g" | sed -E 's/.*\((.*)\).*/\1/' | tr -d '\r')"
    echo "p50 $(pct 50th) · p90 $(pct 90th) · p99 $(pct 99th) · GPU p50 $(grep -m1 '50th gpu percentile' "$g" | grep -oE '[0-9]+ms') · frame to frame ${rate:-?}"
    echo "(the first scroll after the app starts is janky more often: fling again for a warm number)"
  } | tee "$out/summary.md"
}

cmd=${1:-}
[ -n "$cmd" ] || usage 2
shift || true
case "$cmd" in
  help | -h | --help) usage 0 ;;
  info | dump | shot | night | cold | tabs | jank) require_device ;;
  *) usage 2 ;;
esac
"cmd_$cmd" "$@"
