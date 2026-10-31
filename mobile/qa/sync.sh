#!/usr/bin/env bash
# What an update from SIX/Edunex reads and how long it takes (PROGRESS.md W2), from a demo build's "[sync]" lines
# (src/perf.ts perfSync: each request to the pretend Edunex and SIX, each changed dataset, each source's state):
#
#   mobile/qa/sync.sh [--quiet 20] [--wait 0]
#
# 1. first run: the demo cleared and started (everything is read);
# 2. saved data: force-stopped and started again from what it saved, after --wait seconds (0: at once; the engine
#    reads only the feeds that are due, 39b9a51);
# 3. pull to refresh on Beranda (everything is read again).
# Each phase ends when no [sync] line came for --quiet seconds. sync-summary.mjs prints, per phase: requests (by
# system), datasets changed, and the time from the start (Android's START) or the pull to the last request answered
# and to the last source live. Raw logcat in C:\qa\runs\<time>-sync-<avd>\.
set -euo pipefail
here=$(cygpath -m "$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)")
. "$here/env.sh"
. "$here/lib.sh"

quiet=20 wait=0
while [ $# -gt 0 ]; do
  case $1 in
    --quiet) quiet=$2; shift 2 ;;
    --wait) wait=$2; shift 2 ;;
    *) sed -n '2,15p' "$0"; exit 2 ;;
  esac
done
out=$(qa_run_dir sync)
echo "Sync on $AVD ($S) → $out"

# Waits until the log has had no [sync] line for $quiet seconds (at most 10 minutes).
settle() {
  local file=$1 last=-1 still=0 n
  for _ in $(seq 600); do
    n=$(grep -c '\[sync\]' "$file" 2> /dev/null || true)
    if [ "$n" = "$last" ]; then still=$((still + 1)); else still=0; last=$n; fi
    [ $still -ge "$quiet" ] && [ "$n" -gt 0 ] && return 0
    sleep 1
  done
}
mark() { dsh log -t qa-sync "$1"; }

dsh am force-stop dev.mobile.maestro > /dev/null 2>&1 || true
dsh cmd uimode night no > /dev/null

qa_logcat_start "$out/first.txt"
dsh pm clear "$QA_APP" > /dev/null
mark start
qa_open "$(qa_link 0)"
settle "$out/first.txt"
qa_logcat_stop

dsh am force-stop "$QA_APP"
sleep "$wait"
qa_logcat_start "$out/saved.txt"
mark start
qa_open "$(qa_link 1)"
settle "$out/saved.txt"
qa_logcat_stop

# Beranda's top, pulled down far enough for the refresh.
qa_logcat_start "$out/pull.txt"
sleep 1
mark pull
dsh input swipe 540 500 540 1600 400
settle "$out/pull.txt"
qa_logcat_stop

node "$here/sync-summary.mjs" "$out/first.txt" "$out/saved.txt" "$out/pull.txt" | tee "$out/summary.md"
