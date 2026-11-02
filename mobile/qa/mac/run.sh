#!/usr/bin/env bash
# Runs one of the lab's scripts on a Mac: mobile/qa/mac/run.sh coldstart.sh <apk> [...]
# (taps.sh, coldstart.sh and perf-summary run unchanged; jank and the emulator have Mac versions here.)
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
export PATH="$here/bin:$PATH"
script=$1
shift
[ -f "$here/$script" ] && exec bash "$here/$script" "$@"
exec bash "$here/../$script" "$@"
