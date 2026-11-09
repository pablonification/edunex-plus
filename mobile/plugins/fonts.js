// The app's own typeface (Plus Jakarta Sans, for headings and numbers: DESIGN.md "Type") as Android font assets:
// React Native finds `fontFamily: "PlusJakartaSans-Bold"` in assets/fonts/PlusJakartaSans-Bold.ttf, there from the
// first frame, with no font module. The files and their licence are in mobile/assets/fonts.
// On iOS the same files go in the app's bundle and its Info.plist (UIAppFonts), as expo-font's plugin does; iOS finds
// them by their PostScript names, which are the same names.
const fs = require("node:fs");
const path = require("node:path");
const { IOSConfig, withDangerousMod, withInfoPlist, withXcodeProject } = require("expo/config-plugins");

const fontsIn = (projectRoot) => {
  const from = path.join(projectRoot, "assets", "fonts");
  return fs
    .readdirSync(from)
    .filter((file) => file.endsWith(".ttf"))
    .map((file) => path.join(from, file));
};

module.exports = function withFonts(config) {
  config = withDangerousMod(config, [
    "android",
    (mod) => {
      const from = path.join(mod.modRequest.projectRoot, "assets", "fonts");
      const to = path.join(mod.modRequest.platformProjectRoot, "app", "src", "main", "assets", "fonts");
      fs.mkdirSync(to, { recursive: true });
      for (const file of fs.readdirSync(from)) if (file.endsWith(".ttf")) fs.copyFileSync(path.join(from, file), path.join(to, file));
      return mod;
    },
  ]);
  config = withXcodeProject(config, (mod) => {
    const project = mod.modResults;
    IOSConfig.XcodeUtils.ensureGroupRecursively(project, "Resources");
    for (const font of fontsIn(mod.modRequest.projectRoot)) {
      const filepath = path.relative(mod.modRequest.platformProjectRoot, font);
      if (project.hasFile(filepath)) continue;
      IOSConfig.XcodeUtils.addResourceFileToGroup({ filepath, groupName: "Resources", project, isBuildFile: true });
    }
    return mod;
  });
  return withInfoPlist(config, (mod) => {
    const names = fontsIn(mod.modRequest.projectRoot).map((font) => path.basename(font));
    const had = Array.isArray(mod.modResults.UIAppFonts) ? mod.modResults.UIAppFonts : [];
    mod.modResults.UIAppFonts = [...new Set([...had, ...names])];
    return mod;
  });
};
