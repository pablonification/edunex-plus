// Packaged builds: macOS dmg + zip (ad-hoc signed), a one-click Windows
// installer (NSIS), Linux AppImage + deb. The app archive holds only the built
// window (dist/app), the bundled main process and preload (dist/desktop) and
// the tray icons (assets/tray*); everything they use is already bundled, so no node_modules.
// The fuses are flipped and checked in scripts/package-fuses.mjs.
import { afterPack } from "./scripts/package-fuses.mjs";

export default {
  // Matches app.setAppUserModelId in src/desktop/main.ts (Windows notifications).
  appId: "id.edunexplus.desktop",
  productName: "Edunex Plus",
  copyright: "Copyright © 2026 Edunex Plus contributors",
  directories: { output: "release" },
  files: ["package.json", "dist/desktop/*.cjs", "dist/app/**/*", "assets/tray*", "!node_modules/**/*"],
  // Beside the app, where anyone can read them: its own licence, and the licences of the
  // open-source packages it includes (written by `npm run build`, scripts/third-party-notices.mjs).
  extraResources: [
    { from: "LICENSE", to: "LICENSE.txt" },
    { from: "dist/third-party-notices.txt", to: "third-party-notices.txt" },
  ],
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
    // Windows and Linux builds carry Electron's and Chromium's licences beside the app; macOS gets them here.
    extraResources: [
      { from: "node_modules/electron/dist/LICENSE", to: "LICENSE.electron.txt" },
      { from: "node_modules/electron/dist/LICENSES.chromium.html", to: "LICENSES.chromium.html" },
    ],
    // Ad-hoc: no Apple certificate, but signed, so macOS delivers notifications.
    // Hardened runtime would refuse Electron's own frameworks under an ad-hoc signature.
    identity: "-",
    hardenedRuntime: false,
    notarize: false,
  },
  // The disk image's window: the app on the left, a link to Applications on the right, on a
  // background that says what to do (assets/dmg-background.svg; its pictures are made by
  // scripts/make-dmg-background.mjs). The window takes the picture's size, 640×432 with
  // Finder's title bar, so the picture's bottom 32 px never show.
  dmg: {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: electron-builder fills in its own ${…} names
    title: "${productName} ${version}",
    icon: "assets/icon.icns",
    background: "assets/dmg-background.png",
    iconSize: 120,
    contents: [
      { x: 170, y: 190, type: "file" },
      { x: 470, y: 190, type: "link", path: "/Applications" },
    ],
    writeUpdateInfo: false,
  },
  win: {
    target: [{ target: "nsis", arch: ["x64", "arm64"] }],
    // Every size Windows shows, each drawn for its size (scripts/make-icons.mjs). The installer
    // and the uninstaller wear it too.
    icon: "assets/icon.ico",
  },
  // One click, no questions: installs for this Windows user only (in %LOCALAPPDATA%\Programs,
  // no administrator password), adds "Edunex Plus" to the Start menu and the desktop, and opens
  // the app. A copy 0.1.0-alpha.1's step-by-step installer put there "only for me" is replaced
  // where it is, so its shortcuts keep working (the installer finds it by appId: keep appId as
  // it is); one it put there for everyone is handled in assets/installer.nsh.
  nsis: {
    oneClick: true,
    perMachine: false,
    runAfterFinish: true,
    // Uninstalling keeps the Student's data; "Keluar & hapus data" in Settings is how to remove it.
    deleteAppDataOnUninstall: false,
    // The one-click window shows it above its progress bar.
    installerHeaderIcon: "assets/icon.ico",
    include: "assets/installer.nsh",
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
    synopsis: "Edunex and SIX in one calm desktop app",
    maintainer: "Edunex Plus contributors <https://github.com/pablonification/edunex-plus>",
  },
  deb: {
    // electron-builder's list, plus two libraries the app loads at start that
    // it leaves out: without the sound library (libasound2t64 since Ubuntu
    // 24.04) a fresh install doesn't open at all.
    depends: [
      "libgtk-3-0",
      "libnotify4",
      "libnss3",
      "libxss1",
      "libxtst6",
      "xdg-utils",
      "libatspi2.0-0",
      "libuuid1",
      "libsecret-1-0",
      "libgbm1",
      "libasound2t64 | libasound2",
    ],
  },
  // No auto-update feed: the app only checks GitHub Releases and links there.
  publish: null,
};
