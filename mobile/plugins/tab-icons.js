// The bottom tabs' icons as the app's own Android drawables (res/drawable/tab_*.xml): Android's
// navigation bar draws them natively, at once, tinted by the bar (app/(tabs)/_layout.tsx names them).
// The XML comes from mobile/assets/tab-icons, made by scripts/make-tab-icons.mjs.
const fs = require("node:fs");
const path = require("node:path");
const { withDangerousMod } = require("expo/config-plugins");

module.exports = function withTabIcons(config) {
  return withDangerousMod(config, [
    "android",
    (mod) => {
      const from = path.join(mod.modRequest.projectRoot, "assets", "tab-icons");
      const to = path.join(mod.modRequest.platformProjectRoot, "app", "src", "main", "res", "drawable");
      fs.mkdirSync(to, { recursive: true });
      for (const file of fs.readdirSync(from)) if (file.endsWith(".xml")) fs.copyFileSync(path.join(from, file), path.join(to, file));
      return mod;
    },
  ]);
};
