#!/usr/bin/env bash
# What rate the display runs at, what the app asks for, and what the app really draws at:
#
#   mobile/qa/refresh.sh [--no-swipe]
#
# With the demo app in front, it swipes its page three times and times the frames (framestats'
# IntendedVsync, frame to frame): ~8.3 ms is 120 Hz, ~11.1 ms 90 Hz, ~16.7 ms 60 Hz. --no-swipe only reads.
set -euo pipefail
here=$(cygpath -m "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)")
. "$here/env.sh"
. "$here/lib.sh"
swipe=1
[ "${1:-}" = --no-swipe ] && swipe=0

display=$(dsh dumpsys display)
sf=$(dsh dumpsys SurfaceFlinger)
modes=$(grep -m1 -o 'supportedModes \[[^]]*\]' <<< "$display" | grep -o 'fps=[0-9.]*' | cut -d= -f2 | awk '{ printf "%s%.0f", (NR > 1 ? ", " : ""), $1 }')
# "activeMode=60.00 Hz (120.00 Hz)": the rate frames are drawn at, then the display's own.
active=$(grep -m1 -oE 'activeMode=[0-9.]+ Hz \([0-9.]+ Hz\)' <<< "$sf" | grep -oE '\([0-9.]+' | tr -d '(')
render=$(grep -m1 -oE 'renderFrameRate [0-9.]+' <<< "$display" | awk '{ printf "%.0f", $2 }')
specs=$(grep -m1 -oE 'mDesiredDisplayModeSpecs=\{[^}]*\}' <<< "$display" | sed -E 's/.*primary=(.*) appRequest=(.*)\}/primary \1; app request \2/')
peak=$(dsh settings get system peak_refresh_rate | tr -d '\r')
min=$(dsh settings get system min_refresh_rate | tr -d '\r')
app_win=$(dsh dumpsys window windows | awk -v app="$QA_APP" 'index($0, "Window #") && index($0, app) { p = 1 } p && /mAttrs=/ { print; exit }')
asks=$(grep -oE 'preferred(DisplayModeId|RefreshRate|MinDisplayRefreshRate|MaxDisplayRefreshRate)=[0-9.]+' <<< "$app_win" | paste -sd' ' - || true)
top=$(dsh dumpsys activity activities | grep -m1 -E 'topResumedActivity|mResumedActivity' | grep -o "$QA_APP" || true)

echo "Refresh rate on $AVD ($S):"
echo
echo "| what | value |"
echo "| --- | --- |"
echo "| display modes (Hz) | ${modes:-?} |"
echo "| display refreshes at (SurfaceFlinger activeMode) | ${active:-?} Hz |"
echo "| display renders at (renderFrameRate) | ${render:-?} fps |"
echo "| Settings: peak / min refresh rate | $peak / $min |"
echo "| Android's ranges (render) | ${specs:-?} |"
if [ -n "$app_win" ]; then
  echo "| the app's window asks for | ${asks:-nothing (no preferred mode or rate)} |"
  echo "| the app's renderer | $(dsh dumpsys gfxinfo "$QA_APP" | grep -m1 -o 'Pipeline=.*' | tr -d '\r') |"
fi

if [ $swipe = 1 ] && [ -n "$top" ]; then
  read -r w h <<< "$(dsh wm size | grep -oE '[0-9]+x[0-9]+' | tail -1 | tr x ' ')"
  dsh dumpsys gfxinfo "$QA_APP" reset > /dev/null
  for _ in 1 2 3; do
    dsh input swipe $((w / 2)) $((h * 3 / 4)) $((w / 2)) $((h * 3 / 10)) 250
    sleep 0.7
  done
  # Frame to frame, while frames come back to back (gaps over 40 ms are pauses between swipes).
  dsh dumpsys gfxinfo "$QA_APP" framestats | awk -F, '/---PROFILEDATA---/ { p = !p; next } p && $1 ~ /^[0-9]+$/ { print $3 }' |
    awk 'NR > 1 { d = ($1 - prev) / 1e6; if (d > 0 && d < 40) print d } { prev = $1 }' | sort -n |
    awk '{ v[NR] = $1 } END { if (NR == 0) { print "| the app draws at (measured) | no frames |"; exit }
      m = v[int((NR + 1) / 2)]; printf "| the app draws at (measured, %d frame intervals) | median %.2f ms = %.0f fps (p10 %.2f, p90 %.2f ms) |\n", NR, m, 1000 / m, v[int(NR * 0.1) + 1], v[int(NR * 0.9)] }'
elif [ $swipe = 1 ]; then
  echo "| the app draws at (measured) | the app isn't in front: open it first |"
fi
