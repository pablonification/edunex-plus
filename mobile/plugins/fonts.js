// The app's own typeface (Plus Jakarta Sans, for headings and numbers: DESIGN.md "Type") as Android font assets:
// React Native finds `fontFamily: "PlusJakartaSans-Bold"` in assets/fonts/PlusJakartaSans-Bold.ttf, there from the
// first frame, with no font module. The files and their licence are in mobile/assets/fonts.
const fs = require("node:fs");
const path = require("node:path");
const { withDangerousMod } = require("expo/config-plugins");

module.exports = function withFonts(config) {
  return withDangerousMod(config, [
    "android",
    (mod) => {
      const from = path.join(mod.modRequest.projectRoot, "assets", "fonts");
      const to = path.join(mod.modRequest.platformProjectRoot, "app", "src", "main", "assets", "fonts");
      fs.mkdirSync(to, { recursive: true });
      for (const file of fs.readdirSync(from)) if (file.endsWith(".ttf")) fs.copyFileSync(path.join(from, file), path.join(to, file));
      return mod;
    },
  ]);
};
