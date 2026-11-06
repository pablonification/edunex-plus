#!/usr/bin/env bash
# The lab's emu.sh on a Mac (Apple silicon): the same two phones, booted the same way where the Mac allows.
#
#   mobile/qa/mac/run.sh emu.sh <mid|weak> [port] [--window]
#
# Differences from the desktop's, all forced by the Mac: the arm64 Android 15 (API 35) Google APIs image (the only
# system image this Mac has; the desktop runs API 34 x86_64), Hypervisor.framework instead of WHPX, the M1's GPU.
# No --prepare: every start wipes the AVD's disk (-wipe-data) and sets the prepared settings itself, so each
# session is a fresh phone, as the desktop's read-only starts are. Prints the serial last.
set -euo pipefail
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
. "$here/../env.sh"
qa_check_disk

name=${1:-}
shift || true
port= window=0
while [ $# -gt 0 ]; do
  case $1 in
    --window) window=1 ;;
    [0-9]*) port=$1 ;;
    *) echo "Unknown argument $1" >&2; exit 2 ;;
  esac
  shift
done

# name: width height density refresh(Hz) ram(MB) cores (as the desktop's emu.sh)
case $name in
  mid) hw=(1080 2400 420 120 4096 4) ;;
  weak) hw=(720 1440 320 60 2048 2) ;;
  *) sed -n '2,10p' "$0"; exit 2 ;;
esac
read -r width height density hz ram cores <<< "${hw[*]}"

image="system-images;android-35;google_apis;arm64-v8a"
ini=$HOME/.android/avd/$name.avd/config.ini
if [ ! -f "$ini" ]; then
  echo "Creating AVD $name ($image, pixel_7 profile)"
  echo no | avdmanager create avd -n "$name" -k "$image" -d pixel_7 --force > /dev/null
fi
set_ini() {
  if grep -q "^$1=" "$ini"; then sed -i '' "s|^$1=.*|$1=$2|" "$ini"; else echo "$1=$2" >> "$ini"; fi
}
set_ini hw.lcd.width "$width"
set_ini hw.lcd.height "$height"
set_ini hw.lcd.density "$density"
set_ini hw.lcd.vsync "$hz"
set_ini hw.ramSize "$ram"
set_ini hw.cpu.ncore "$cores"
set_ini hw.gpu.enabled yes
set_ini hw.gpu.mode host
set_ini hw.keyboard no
set_ini hw.audioInput no
set_ini hw.camera.back none
set_ini hw.camera.front none
set_ini showDeviceFrame no
set_ini fastboot.forceColdBoot yes
set_ini fastboot.forceFastBoot no

if [ -z "$port" ]; then
  for p in $(seq 5554 2 5584); do
    lsof -nP -iTCP:"$p" -sTCP:LISTEN > /dev/null 2>&1 || lsof -nP -iTCP:$((p + 1)) -sTCP:LISTEN > /dev/null 2>&1 || { port=$p; break; }
  done
fi
serial=emulator-$port
args=(-avd "$name" -port "$port" -no-snapshot -wipe-data -no-boot-anim -accel on -gpu host -no-audio -netfast -timezone Asia/Jakarta)
[ $window = 1 ] || args+=(-no-window)
log=$QA_OUT/emulator/$name-$port.log
mkdir -p "$(dirname "$log")"
echo "Starting $name on port $port: emulator ${args[*]}"
nohup emulator "${args[@]}" > "$log" 2>&1 < /dev/null &
disown

boot_start=$(date +%s)
adb -s "$serial" wait-for-device
until [ "$(adb -s "$serial" shell getprop sys.boot_completed 2> /dev/null | tr -d '\r')" = 1 ]; do
  [ $(($(date +%s) - boot_start)) -lt 600 ] || { echo "$serial didn't finish booting in 10 minutes; see $log" >&2; exit 1; }
  sleep 2
done
echo "Booted in $(($(date +%s) - boot_start)) s"

sh() { adb -s "$serial" shell "$@" < /dev/null; }
sh svc power stayon true
sh wm dismiss-keyguard > /dev/null 2>&1 || true
sh input keyevent 82 > /dev/null 2>&1 || true
sh settings put system peak_refresh_rate "$hz.0"
sh settings delete system min_refresh_rate > /dev/null 2>&1 || true
sh setprop debug.hwui.renderer skiavk
# What emu.sh --prepare sets once on the desktop.
sh settings put global auto_time_zone 0
sh cmd alarm set-timezone Asia/Jakarta
sh settings put global hide_error_dialogs 1
sh cmd package bg-dexopt-job > /dev/null 2>&1 &

for _ in $(seq 200); do
  up=$(sh cut -d. -f1 /proc/uptime)
  load=$(sh cat /proc/loadavg | cut -d' ' -f1)
  [ "$up" -ge 120 ] && awk -v l="$load" -v c="$cores" 'BEGIN { exit !(l < c * 0.5) }' && break
  sleep 3
done
echo "Settled: load $load on $cores cores after $(($(date +%s) - boot_start)) s"
echo "$serial"
