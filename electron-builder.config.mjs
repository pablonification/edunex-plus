// Packaged builds: macOS dmg + zip (ad-hoc signed), Windows NSIS installer,
// Linux AppImage + deb. The app archive holds only the built window
// (dist/app), the bundled main process and preload (dist/desktop) and the
// tray icons; everything they use is already bundled, so no node_modules.
// The fuses are flipped and checked in scripts/package-fuses.mjs.
import { afterPack } from "./scripts/package-fuses.mjs";

export default {
  // Matches app.setAppUserModelId in src/desktop/main.ts (Windows notifications).
  appId: "id.edunexplus.desktop",
  productName: "Edunex Plus",
  copyright: "Copyright © 2026 Edunex Plus contributors",
  directories: { output: "release" },
  files: ["package.json", "dist/desktop/*.cjs", "dist/app/**/*", "assets/tray*.png", "!node_modules/**/*"],
  asar: true,
  // Nothing native to rebuild: the main process is one bundled file.
  npmRebuild: false,
  afterPack,
  mac: {
    // Apple silicon only for now; add "x64" here for Intel Macs.
    target: [
      { target: "dmg", arch: ["arm64"] },
      { target: "zip", arch: ["arm64"] },
    ],
    icon: "assets/icon.icns",
    category: "public.app-category.education",
    // Ad-hoc: no Apple certificate, but signed, so macOS delivers notifications.
    // Hardened runtime would refuse Electron's own frameworks under an ad-hoc signature.
    identity: "-",
    hardenedRuntime: false,
    notarize: false,
  },
  dmg: { writeUpdateInfo: false },
  win: {
    target: [{ target: "nsis", arch: ["x64", "arm64"] }],
    icon: "assets/icon.png",
  },
  nsis: {
    oneClick: false,
    perMachine: false,
    allowToChangeInstallationDirectory: true,
    differentialPackage: false,
  },
  linux: {
    target: [
      { target: "AppImage", arch: ["x64", "arm64"] },
      { target: "deb", arch: ["x64", "arm64"] },
    ],
    // Lets the desktop link the running window to its menu entry.
    syncDesktopName: true,
    icon: "assets/icon.png",
    category: "Education",
    synopsis: "EduNex and SIX in one calm desktop app",
    maintainer: "Edunex Plus contributors <https://github.com/pablonification/edunex-plus>",
  },
  // No auto-update feed: the app only checks GitHub Releases and links there.
  publish: null,
};
