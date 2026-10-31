#!/usr/bin/env bash
# Starts one of the lab's emulators the same way every time: a cold boot (no snapshot loaded or saved),
# WHPX acceleration, the host's GPU (not SwiftShader), and the AVD's hardware rewritten from the table
# below first. No window by default (--window shows one): a window is presented on the host's 60 Hz
# monitor, which is no part of the phone.
#
#   mobile/qa/emu.sh <mid|weak> [port] [--window] [--force-hz] [--gpu host]
#   mobile/qa/emu.sh <mid|weak> --prepare
#
# Several instances of one AVD can run at once: each starts -read-only from the AVD's prepared disk, on
# its own port (5554, 5556, 5558, ...; by default the first free one), and keeps nothing when it stops.
# The last line printed is its serial: `export ANDROID_SERIAL=emulator-5556`. Stop it with
# `adb -s <serial> emu kill`.
#
# The refresh rate: the display runs at the AVD's rate (mid: 120 Hz), and Android lets an app draw that
# fast only when the app asks for it, as Samsung's and Xiaomi's phones do (the image's default refresh
# rate, 60, caps the rest). That's the policy the app has to beat (PROGRESS.md W5). --force-hz lifts the
# cap for every app (Settings' minimum refresh rate), to show what the emulator itself can do.
#
# --prepare (once per AVD, with no instance of it running): creates the AVD if it's missing, boots it
# writable from a wiped disk, sets what every later boot should find (time zone, no error dialogs, the
# display's refresh rate), lets Android finish compiling its own apps, and shuts it down. Every
# read-only start begins from that disk.
set -euo pipefail
here=$(cygpath -m "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)")
. "$here/env.sh"

name=${1:-}
shift || true
port= prepare=0 window=0 force_hz=0 gpu=host
while [ $# -gt 0 ]; do
  case $1 in
    --prepare) prepare=1 ;;
    --window) window=1 ;;
    --headless) window=0 ;;
    --force-hz) force_hz=1 ;;
    --gpu) gpu=$2; shift ;;
    [0-9]*) port=$1 ;;
    *) echo "Unknown argument $1" >&2; exit 2 ;;
  esac
  shift
done

# name: width height density refresh(Hz) ram(MB) cores
case $name in
  # A Pixel 7 class phone with a high refresh rate.
  mid) hw=(1080 2400 420 120 4096 4) ;;
  # A small, slow phone at 60 Hz.
  weak) hw=(720 1440 320 60 2048 2) ;;
  *) sed -n '2,17p' "$0"; exit 2 ;;
esac
read -r width height density hz ram cores <<< "${hw[*]}"

avd_home=$(cygpath -m "${ANDROID_AVD_HOME:-$USERPROFILE/.android/avd}")
ini=$avd_home/$name.avd/config.ini
image="system-images;android-34;google_apis;x86_64"

if [ ! -f "$ini" ]; then
  [ $prepare = 1 ] || { echo "AVD $name doesn't exist yet: run $0 $name --prepare first." >&2; exit 1; }
  echo "Creating AVD $name ($image, pixel_7 profile)"
  echo no | avdmanager.bat create avd -n "$name" -k "$image" -d pixel_7 --force > /dev/null
fi

set_ini() {
  if grep -q "^$1=" "$ini"; then sed -i "s|^$1=.*|$1=$2|" "$ini"; else echo "$1=$2" >> "$ini"; fi
}
set_ini hw.lcd.width "$width"
set_ini hw.lcd.height "$height"
set_ini hw.lcd.density "$density"
# The rate the emulator's display runs at (its vsync), which Android then reports as the display's mode.
set_ini hw.lcd.vsync "$hz"
set_ini hw.ramSize "$ram"
set_ini hw.cpu.ncore "$cores"
set_ini hw.gpu.enabled yes
set_ini hw.gpu.mode "$gpu"
# The guest's GL reaches the host through a transport: asg (address space graphics) is the newer, cheaper one.
set_ini hw.gltransport asg
set_ini hw.keyboard no
set_ini hw.audioInput no
set_ini hw.camera.back none
set_ini hw.camera.front none
set_ini showDeviceFrame no
set_ini fastboot.forceColdBoot yes
set_ini fastboot.forceFastBoot no
set_ini firstboot.bootFromDownloadableSnapshot no
set_ini firstboot.bootFromLocalSnapshot no
set_ini firstboot.saveToLocalSnapshot no

# A free port: neither the console port nor adb's (port + 1) is listening.
listening=$(netstat -ano -p tcp | awk '$4 == "LISTENING" { n = split($2, a, ":"); print a[n] }')
free() { ! grep -qx "$1" <<< "$listening" && ! grep -qx "$(($1 + 1))" <<< "$listening"; }
if [ -z "$port" ]; then
  for p in $(seq 5554 2 5584); do free "$p" && { port=$p; break; }; done
  [ -n "$port" ] || { echo "No free emulator port between 5554 and 5584." >&2; exit 1; }
elif ! free "$port"; then
  echo "Port $port (or $((port + 1))) is taken: another emulator runs there." >&2
  exit 1
fi
serial=emulator-$port

# -timezone: the emulator would take the host's zone (Asia/Bangkok here); the demo and CI use Bandung's.
args=(-avd "$name" -port "$port" -no-snapshot -no-boot-anim -accel on -gpu "$gpu" -no-audio -netfast -timezone Asia/Jakarta)
if [ $prepare = 1 ]; then
  # A writable boot (the only kind that keeps what it does) can't share the AVD with a running instance.
  if tasklist //FI "IMAGENAME eq qemu-system-x86_64.exe" //V 2> /dev/null | grep -q " $name"; then
    echo "An instance of $name is running: stop it before --prepare." >&2
    exit 1
  fi
  args+=(-wipe-data)
else
  args+=(-read-only)
fi
[ $window = 1 ] || args+=(-no-window)

log=$QA_OUT/emulator/$name-$port.log
mkdir -p "$(dirname "$log")"
echo "Starting $name on port $port: emulator ${args[*]}"
# Started on its own (not a child of this shell) so it outlives the script, and holding none of this shell's
# handles: an emulator that inherited a pipe would keep `emu.sh | tail` waiting for as long as it runs.
powershell.exe -NoProfile -Command "Start-Process -FilePath '$(cygpath -m "$(command -v emulator.exe)")' -ArgumentList '${args[*]}' -RedirectStandardOutput '$log' -RedirectStandardError '$log.err' -WindowStyle Minimized" < /dev/null > /dev/null 2>&1

boot_start=$(date +%s)
adb -s "$serial" wait-for-device
until [ "$(adb -s "$serial" shell getprop sys.boot_completed 2> /dev/null | tr -d '\r')" = 1 ]; do
  [ $(($(date +%s) - boot_start)) -lt 600 ] || { echo "$serial didn't finish booting in 10 minutes; see $log" >&2; exit 1; }
  sleep 2
done
echo "Booted in $(($(date +%s) - boot_start)) s"

sh() { adb -s "$serial" shell "$@"; }
# Every boot: awake, unlocked, and the refresh policy described at the top ("Smooth display" on, as a
# phone ships: apps may go up to the display's rate; with --force-hz they must).
sh svc power stayon true
sh wm dismiss-keyguard > /dev/null 2>&1 || true
sh input keyevent 82 > /dev/null 2>&1 || true
sh settings put system peak_refresh_rate "$hz.0"
if [ $force_hz = 1 ]; then sh settings put system min_refresh_rate "$hz.0"; else sh settings delete system min_refresh_rate > /dev/null; fi
# Apps draw with Android's Vulkan renderer (the GPU's own, through the emulator to the NVIDIA card). With the
# default, GL, every frame waited ~15 ms on the emulator's GL translation (Android's Settings: 50% janky, p50
# 17 ms; with Vulkan 0%, p50 5 ms, GPU 1 ms), which measured the emulator, not the app. Apps started from
# now on use it; `dumpsys gfxinfo <app>` says "Pipeline=Skia (Vulkan)".
sh setprop debug.hwui.renderer skiavk

if [ $prepare = 1 ]; then
  # As CI does (scripts/ci/mobile-e2e.sh): Bandung's time zone, where the demo and every student are,
  # and no "isn't responding" dialogs of the emulator's own apps over the app under test.
  sh settings put global auto_time_zone 0
  # (setprop persist.sys.timezone needs root; the alarm service sets the same thing for the shell user.)
  sh cmd alarm set-timezone Asia/Jakarta
  sh settings put global hide_error_dialogs 1
  # The made-up answer mobile/flows/use.yaml attaches from Downloads.
  adb -s "$serial" push "$(cygpath -m "$here/../flows/files/jawaban.pdf")" /sdcard/Download/jawaban.pdf > /dev/null
  sh content call --uri content://media --method scan_volume --arg external_primary > /dev/null 2>&1 || true
  echo "Compiling Android's own apps ahead of time (a few minutes)"
  sh cmd package bg-dexopt-job > /dev/null 2>&1 || true
  sleep 60
  echo "Shutting $name down; its disk is now what every read-only start begins from."
  sh reboot -p > /dev/null 2>&1 || true
  adb -s "$serial" wait-for-disconnect 2> /dev/null || sleep 20
  # Let the emulator write its disk out and exit.
  for _ in $(seq 60); do adb devices | grep -q "^$serial" || break; sleep 1; done
  sleep 5
  echo "Prepared $name."
  exit 0
fi

# Android keeps working for a while after boot (Play services, compiling): timing runs wait for it.
for _ in $(seq 90); do
  load=$(sh cat /proc/loadavg | cut -d' ' -f1)
  awk -v l="$load" -v c="$cores" 'BEGIN { exit !(l < c * 0.5) }' && break
  sleep 2
done
echo "Settled: load $load on $cores cores after $(($(date +%s) - boot_start)) s"
echo "$serial"
