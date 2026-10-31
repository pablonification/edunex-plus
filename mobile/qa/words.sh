#!/usr/bin/env bash
# Words on the phone's screen right now, above the tabs' bar (round 2's text budget):
#
#   ANDROID_SERIAL=emulator-5562 mobile/qa/words.sh [--list]
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
. "${QA_LAB:-C:/Users/Arqila/edunex-plus/mobile/qa}/env.sh"
tmp=$(mktemp -d)
maestro --device "${ANDROID_SERIAL:?set ANDROID_SERIAL}" hierarchy > "$tmp/hierarchy.json" 2> /dev/null
node "$(cygpath -m "$here")/words.mjs" "$(cygpath -m "$tmp/hierarchy.json" 2> /dev/null || echo "$tmp/hierarchy.json")" "$@"
