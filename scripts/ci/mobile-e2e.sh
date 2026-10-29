#!/usr/bin/env bash
# Runs the phone app's Maestro flows on the emulator that is already up (the mobile
# workflow's e2e job), and keeps everything a reader needs in one folder: JUnit
# results, screenshots, Maestro's own logs and the emulator's log.
#
#   scripts/ci/mobile-e2e.sh <apk> <out-dir> [glob]
#
# glob: which flows, from mobile/flows (default: all of them, "**/*"). A folder named
# `expected` (inventories, not flows) and Maestro's config.yaml are never run.
set -uo pipefail

apk=$1
out=$(mkdir -p "$2" && cd "$2" && pwd)
pattern=${3:-'**/*'}
root=$(pwd)

adb install -r "$apk" || exit 1
adb logcat -c
adb logcat > "$out/logcat.txt" 2>&1 &
logcat=$!
trap 'kill "$logcat" 2> /dev/null' EXIT

shopt -s globstar nullglob
cd "$root/mobile/flows" || exit 1
flows=()
# shellcheck disable=SC2206 # the glob is meant to expand here
candidates=($pattern)
for flow in "${candidates[@]}"; do
  [[ -f $flow && ($flow == *.yaml || $flow == *.yml) ]] || continue
  name=$(basename "$flow")
  [[ /$flow == */expected/* || $name == config.yaml || $name == config.yml ]] && continue
  flows+=("$PWD/$flow")
done
if [ ${#flows[@]} -eq 0 ]; then
  echo "::error::No flow in mobile/flows matches \"$pattern\"."
  exit 1
fi
printf 'Running %d flow(s):\n' "${#flows[@]}"
printf '  %s\n' "${flows[@]#"$root/"}"

# From inside the output folder, so takeScreenshot's pictures land there too.
cd "$out" || exit 1
maestro test --format junit --output "$out/junit.xml" --test-output-dir "$out/maestro" "${flows[@]}"
