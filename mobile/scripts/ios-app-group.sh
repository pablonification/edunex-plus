#!/bin/bash
# Says the App Group inside an unsigned iPhone app, so the tool that signs it later asks Apple for it.
#
# CI builds the .ipa unsigned (nobody's certificate is in CI), and unsigned code carries no entitlements. Sideloadly
# and AltStore sign with what the app carries: without the App Group the app and its widgets got a store each, and
# every widget and the Live Activity stayed empty on a sideloaded iPhone. So the app and the widget extension are
# signed ad hoc ("-": no certificate, trusted by nothing) with that one entitlement; the re-signer replaces the
# signature and keeps the request. The group's name is the one the build wrote in Info.plist.
#
# Usage: ios-app-group.sh <path to the .app>
set -euo pipefail

app=${1:?the .app to mark}
appex="$app/PlugIns/ExpoWidgetsTarget.appex"
test -d "$appex" || { echo "No widget extension in $app" >&2; exit 1; }

group=$(/usr/libexec/PlistBuddy -c "Print :ExpoWidgetsAppGroupIdentifier" "$app/Info.plist")
test "$group" = "$(/usr/libexec/PlistBuddy -c "Print :ExpoWidgetsAppGroupIdentifier" "$appex/Info.plist")" ||
  { echo "The app and its widgets name different App Groups" >&2; exit 1; }

entitlements=$(mktemp)
trap 'rm -f "$entitlements"' EXIT
cat >"$entitlements" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.application-groups</key>
  <array>
    <string>$group</string>
  </array>
</dict>
</plist>
EOF

# Inside out: codesign refuses a bundle whose nested code is unsigned.
find "$app" \( -name "*.framework" -o -name "*.dylib" \) -print0 | xargs -0 -n 1 codesign --force --sign -
codesign --force --sign - --entitlements "$entitlements" "$appex"
codesign --force --sign - --entitlements "$entitlements" "$app"

for bundle in "$app" "$appex"; do
  codesign -d --entitlements - "$bundle" 2>/dev/null | grep -q "$group" || { echo "$bundle doesn't carry $group" >&2; exit 1; }
done
echo "App Group $group is in the app and its widgets."
