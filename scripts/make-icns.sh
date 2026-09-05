#!/bin/sh
# Rebuilds assets/icon.icns from assets/icon.png (macOS packaged-app icon).
# The PNG itself is rendered once through the app's own canvas (real Inter
# glyph) — see the #32 shell slice; regenerate the icns after changing it:
#   ./scripts/make-icns.sh
set -e
cd "$(dirname "$0")/.."
rm -rf /tmp/icon.iconset
mkdir -p /tmp/icon.iconset
for s in 16 32 128 256 512; do
  sips -z $s $s assets/icon.png --out /tmp/icon.iconset/icon_${s}x${s}.png >/dev/null
  sips -z $((s*2)) $((s*2)) assets/icon.png --out /tmp/icon.iconset/icon_${s}x${s}@2x.png >/dev/null
done
iconutil -c icns /tmp/icon.iconset -o assets/icon.icns
echo "wrote assets/icon.icns"
