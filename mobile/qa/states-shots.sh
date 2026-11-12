#!/usr/bin/env bash
# Every screen in every state of the demo, pictured on the phone over USB (mobile/qa/superapp-states.md):
#
#   ANDROID_SERIAL=<serial> mobile/qa/states-shots.sh <out-dir> [light|dark] [screen...]
#
# For each row of superapp-states.json (a screen in a state the demo can show; [screen...] keeps only those screen ids,
# e.g. `beranda materi`): stop the demo app, open the state's link, wait, open the screen's path, wait, take
# <out-dir>/<screen>-<state>-<theme>.png, press Back. The theme (default light) is set through `cmd uimode night` and put
# back to what it was at the end, whatever happens. Rows whose state is "prime" (offline) open the normal link once
# first, so there is saved data to start from.
#
# What it never does: every command sent to the phone goes through `dev`, which runs only this list: the demo package's
# force-stop and a VIEW link into it, Back, and night mode. No `pm clear` (no state needs it: the demo starts fresh on
# every link but OFFLINE=1's), no uninstall or install, no `settings put`, no other package. Pictures are taken with
# exec-out (nothing is written on the phone).
#
# UNVERIFIED: written on a Mac with no phone (from phone.sh). Not run: whether the waits are long enough on the A52
# (WAIT_START, WAIT_SCREEN override the data's), whether Back after a route link leaves the app in a clean place (it is
# force-stopped before every row anyway), and the quoting of `&` in a link through `adb shell` (quoted for the phone's sh).
set -euo pipefail

here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
export ANDROID_HOME=${ANDROID_HOME:-/opt/homebrew/share/android-commandlinetools}
export PATH="$ANDROID_HOME/platform-tools:$PATH"
DATA="$here/superapp-states.json"
serial=${ANDROID_SERIAL:-}

die() {
  echo "states-shots.sh: $*" >&2
  exit 1
}

[ $# -ge 1 ] || {
  sed -n '2,20p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
  exit 2
}
out=$1
shift
theme=light
if [ $# -ge 1 ] && { [ "$1" = light ] || [ "$1" = dark ]; }; then
  theme=$1
  shift
fi
[ -n "$serial" ] || die "set ANDROID_SERIAL to the phone's serial (adb devices)"
command -v adb > /dev/null || die "no adb on PATH ($ANDROID_HOME/platform-tools)"
command -v node > /dev/null || die "node reads the rows from $DATA"

PKG=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).package)' "$DATA")
[ "$PKG" = io.github.pablonification.edunexplus.demo ] || die "the data names $PKG, not the demo package"

VIEW="^am start -W -a android[.]intent[.]action[.]VIEW -d 'edunexplusdemo://[A-Za-z0-9_./?=&%:,+-]*' ${PKG//./[.]}\$"

# Everything that runs on the phone: an exact list, matched against the whole line.
dev() {
  local cmd="$*"
  case "$cmd" in
    "am force-stop $PKG" | "input keyevent KEYCODE_BACK" | "cmd uimode night" | "cmd uimode night yes" | "cmd uimode night no") ;;
    *)
      if [[ $cmd =~ $VIEW ]]; then
        :
      else
        die "refused to run on the phone: $cmd"
      fi
      ;;
  esac
  adb -s "$serial" shell "$cmd" < /dev/null
}

open_link() {
  dev "am start -W -a android.intent.action.VIEW -d '$1' $PKG" > /dev/null
}

# The rows: screen, state, link, path ("" for Beranda), prime (1|0), wait after the link, wait after the path.
rows() {
  node - "$DATA" "${WAIT_START:-}" "${WAIT_SCREEN:-}" "$@" << 'EOF'
const [data, waitStart, waitScreen, ...only] = process.argv.slice(2);
const d = JSON.parse(require("fs").readFileSync(data, "utf8"));
for (const s of d.screens) {
  if (only.length && !only.includes(s.id)) continue;
  for (const [state, cell] of Object.entries(s.cells)) {
    if (cell.handling === "no-way" || cell.handling === "n/a") continue;
    const st = d.states[state];
    const link = `edunexplusdemo://demo?${cell.query ?? st.query}`;
    const start = waitStart || st.wait || d.waits.start;
    console.log([s.id, state, link, s.path || "-", st.prime ? 1 : 0, start, waitScreen || d.waits.screen].join("\t"));
  }
}
EOF
}

was=$(dev cmd uimode night | tr -d '\r' | sed -n 's/^Night mode: //p')
restore() {
  case "$was" in
    yes | no) dev cmd uimode night "$was" > /dev/null || true ;;
  esac
}
trap restore EXIT
if [ "$theme" = dark ]; then dev cmd uimode night yes > /dev/null; else dev cmd uimode night no > /dev/null; fi

mkdir -p "$out"
normal=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).states.normal.query)' "$DATA")
count=0
while IFS=$'\t' read -r screen state link path prime wait_start wait_screen; do
  echo "[$screen $state $theme] $link → $path"
  dev am force-stop "$PKG" > /dev/null
  if [ "$prime" = 1 ]; then
    open_link "edunexplusdemo://demo?$normal"
    sleep "$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).waits.start)' "$DATA")"
    dev am force-stop "$PKG" > /dev/null
  fi
  open_link "$link"
  sleep "$wait_start"
  if [ "$path" != - ]; then
    open_link "edunexplusdemo://$path"
    sleep "$wait_screen"
  fi
  file="$out/$screen-$state-$theme.png"
  adb -s "$serial" exec-out screencap -p < /dev/null > "$file.part" && mv "$file.part" "$file"
  dev input keyevent KEYCODE_BACK > /dev/null
  count=$((count + 1))
done < <(rows "$@")
dev am force-stop "$PKG" > /dev/null
echo "$count pictures in $out"
