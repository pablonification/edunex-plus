// The Live Activity's layout, bundled inside the widget extension (src/widget-ios/live.tsx, IOS.md).
//
// expo-widgets keeps a Live Activity's layout only in the store the app and the extension share. On an iPhone
// signed without an App Group (Sideloadly on a free Apple ID) that store is the keychain, and a Live Activity is
// drawn in a sandbox the keychain is closed to: it came up empty. So the build puts the layout in the extension's
// own bundle, the way a widget's first layout is: this adds the Live Activities to the list expo-widgets' build
// script reads (patches/expo-widgets+*.patch teaches that script and the extension the rest).
//
// Listed before "expo-widgets" in app.config.ts's plugins: Expo runs the mods of a later plugin first, so this runs
// after expo-widgets has written the list.
const fs = require("node:fs");
const path = require("node:path");
const { withDangerousMod } = require("expo/config-plugins");

/** The list with the Live Activities in it. */
function withActivities(config, activities) {
  return { ...config, liveActivities: activities.map(({ name, layout }) => ({ name, layout })) };
}

/** `activities`: { name, layout }[], `layout` a file relative to the project root that calls createLiveActivity(name, …). */
function withLiveActivityLayout(config, { activities }) {
  return withDangerousMod(config, [
    "ios",
    (mod) => {
      const file = path.join(mod.modRequest.platformProjectRoot, "ExpoWidgetsTarget", "ExpoWidgetsLayoutRegistry.config.json");
      if (!fs.existsSync(file)) throw new Error(`live-activity-layout: ${file} wasn't written; list this plugin before expo-widgets`);
      for (const { layout } of activities) {
        if (!fs.existsSync(path.join(mod.modRequest.projectRoot, layout))) throw new Error(`live-activity-layout: no file ${layout}`);
      }
      fs.writeFileSync(file, `${JSON.stringify(withActivities(JSON.parse(fs.readFileSync(file, "utf8")), activities), null, 2)}\n`);
      return mod;
    },
  ]);
}

module.exports = withLiveActivityLayout;
module.exports.withActivities = withActivities;
