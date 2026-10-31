#!/usr/bin/env bash
# Screenshots of a Maestro flow's named steps, and optionally a screen recording of it, in light, dark or
# large font:
#
#   mobile/qa/shots.sh <flow.yaml> [--theme light|dark] [--font 1.3] [--prefix mid-light] [--out <dir>]
#                      [--record <file.mp4>] [--recorder emulator|phone]
#
# The theme is Android's own (`cmd uimode night yes|no`) and the flow gets it as ${THEME} (the demo's
# links take EDUNEX_DEMO_THEME=${THEME}); --font sets `settings put system font_scale`. Every
# `takeScreenshot: <name>` of the flow becomes <out>/<prefix>-<name>.webp (quality 80, at most 1080 px
# tall; the PNGs stay in <out>/png/). Both settings are put back afterwards.
# --record: the emulator records its display from the host (60 fps, nothing running on the phone), made
# into an MP4; --recorder phone uses Android's `screenrecord` instead (every frame, but on the phone's CPU,
# 3 minutes at most).
# Default out: C:\qa\shots\<time>-<flow>-<avd>\.
set -euo pipefail
here=$(cygpath -m "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)")
. "$here/env.sh"
. "$here/lib.sh"

flow= theme=light font= prefix= out= record= recorder=emulator
while [ $# -gt 0 ]; do
  case $1 in
    --theme) theme=$2; shift 2 ;;
    --font) font=$2; shift 2 ;;
    --prefix) prefix=$2; shift 2 ;;
    --out) out=$(cygpath -m "$2"); shift 2 ;;
    --record) record=$(cygpath -m "$2"); shift 2 ;;
    --recorder) recorder=$2; shift 2 ;;
    *) [ -f "$1" ] && flow=$(cygpath -m "$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"); shift ;;
  esac
done
[ -f "$flow" ] || { sed -n '2,17p' "$0"; exit 2; }
name=$(basename "$flow" .yaml)
out=${out:-$(qa_run_dir "shots-$name")}
prefix=${prefix:-$AVD-$theme${font:+-font$font}}
mkdir -p "$out/png"

old_font=$(dsh settings get system font_scale | tr -d '\r')
restore() {
  dsh cmd uimode night no > /dev/null
  dsh settings put system font_scale "${old_font/null/1.0}"
}
trap restore EXIT
if [ "$theme" = dark ]; then dsh cmd uimode night yes > /dev/null; else dsh cmd uimode night no > /dev/null; fi
[ -z "$font" ] || dsh settings put system font_scale "$font"

work=$(cygpath -m "$(mktemp -d)")
if [ -n "$record" ]; then
  mkdir -p "$(dirname "$record")"
  if [ "$recorder" = phone ]; then
    dsh rm -f /sdcard/qa-record.mp4
    adb -s "$S" shell screenrecord --bit-rate 16000000 --time-limit 180 /sdcard/qa-record.mp4 < /dev/null &
    rec=$!
  else
    ad emu screenrecord start --fps 60 --bit-rate 12M --time-limit 600 "$(cygpath -m "$work/record.webm")" > /dev/null
  fi
  sleep 1
fi

echo "$name on $AVD ($S), $theme${font:+, font $font} → $out"
# Maestro 2.12 puts takeScreenshot's pictures in its test output folder, under <flow>/takeScreenshot/.
status=0
maestro --device "$S" test --no-ansi --no-reinstall-driver --test-output-dir "$(cygpath -m "$work/maestro")" -e THEME="$theme" "$flow" > "$out/$prefix-maestro.txt" 2>&1 || status=$?
notdone=$(grep -E 'COMPLETED|FAILED|WARNED|SKIPPED' "$out/$prefix-maestro.txt" | grep -vc COMPLETED || true)
[ "$notdone" = 0 ] || echo "  $notdone step(s) not completed (optional ones skipped, or a failure): $(cygpath -w "$out/$prefix-maestro.txt")"

if [ -n "$record" ]; then
  sleep 1
  if [ "$recorder" = phone ]; then
    dsh pkill -INT screenrecord || true
    wait "$rec" 2> /dev/null || true
    sleep 1
    ad pull /sdcard/qa-record.mp4 "$record" > /dev/null
  else
    ad emu screenrecord stop > /dev/null
    sleep 2
    ffmpeg -hide_banner -loglevel error -y -i "$work/record.webm" -an -c:v libx264 -preset slow -crf 20 -pix_fmt yuv420p -vf "scale=-2:'min(1600,ih)'" "$record"
  fi
  echo "  recording: $(cygpath -w "$record")"
fi

find "$work/maestro" -name '*.png' -path '*takeScreenshot*' > "$work/pngs.txt" 2> /dev/null || true
while read -r png; do
  [ -f "$png" ] || continue
  shot=$(basename "$png" .png)
  cp "$png" "$out/png/$prefix-$shot.png"
  ffmpeg -hide_banner -loglevel error -y -i "$png" -vf "scale=-2:'min(1080,ih)'" -c:v libwebp -quality 80 "$out/$prefix-$shot.webp" < /dev/null
done < "$work/pngs.txt"
rm -rf "$work"
echo "  $(ls "$out" | grep -c "^$prefix-.*\.webp$") pictures"
exit $status
