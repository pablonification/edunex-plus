// Packaged builds: macOS dmg + zip for Apple silicon and Intel (ad-hoc signed), one-click Windows
// installers (NSIS) for x64 and ARM PCs, Linux AppImage + deb. The app archive holds only the built
// window (dist/app), the bundled main process and preload (dist/desktop) and
// the tray icons (assets/tray*); everything they use is already bundled, so no node_modules.
// The fuses are flipped and checked in scripts/package-fuses.mjs; the disk image is packed
// smaller in scripts/package-dmg.mjs.
import { artifactBuildCompleted } from "./scripts/package-dmg.mjs";
import { afterPack } from "./scripts/package-fuses.mjs";

// The Windows installer for ARM PCs (Snapdragon and the like). Each kind of PC has its own, half
// the size of one carrying both; scripts/package-win.mjs builds this one, then the x64 one under
// nsis.artifactName. Not "Setup" in its name: 0.1.0-alpha.5 updates itself to any file of that
// name, and an ARM build doesn't start on an Intel or AMD PC (the x64 one runs on ARM, emulated).
// biome-ignore lint/suspicious/noTemplateCurlyInString: electron-builder fills in its own ${…} names
export const WINDOWS_ARM_INSTALLER = "Edunex-Plus-${version}-arm64.${ext}";
/** The ARM installer's update info: electron-builder names it latest.yml too, so it's renamed. */
export const WINDOWS_ARM_UPDATE_INFO = "latest-win-arm64.yml";

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
  artifactBuildCompleted,
  // Chromium's own words (its few menus and messages) only in the two languages the app speaks,
  // not the 55 it ships: about 10 MB less to download. A computer set to another language gets
  // Chromium's English; the app's own words are its own (src/core/strings).
  electronLanguages: ["en-US", "id"],
  mac: {
    // One download per kind of Mac (not one "universal" app twice the size): arm64 for
    // Apple silicon, x64 for Intel.
    target: [
      { target: "dmg", arch: ["arm64", "x64"] },
      { target: "zip", arch: ["arm64", "x64"] },
    ],
    // The zip's name says which Mac it's for too (the disk image's own name is under dmg). No
    // spaces in any file name: GitHub would turn them into dots, and then the latest*.yml the app
    // checks a download against (it lists files by name) wouldn't name the file on the release.
    // biome-ignore lint/suspicious/noTemplateCurlyInString: electron-builder fills in its own ${…} names
    artifactName: "Edunex-Plus-${version}-${arch}-mac.${ext}",
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
  // The disk image's window: the app on the left, a link to Applications on the right, and
  // under them a link to Terminal beside the one line that lets macOS open the app, on a
  // background that says what to do (assets/dmg-background.svg; its pictures are made by
  // scripts/make-dmg-background.mjs). The window takes the picture's size, 640×480 with
  // Finder's title bar, so the picture's bottom 32 px never show.
  dmg: {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: electron-builder fills in its own ${…} names
    title: "${productName} ${version}",
    icon: "assets/icon.icns",
    background: "assets/dmg-background.png",
    iconSize: 100,
    contents: [
      { x: 170, y: 150, type: "file" },
      { x: 470, y: 150, type: "link", path: "/Applications" },
      // Where Terminal is on every Mac the app runs on, Intel or Apple silicon (macOS 10.15 and
      // later; Electron needs macOS 12).
      { x: 118, y: 350, type: "link", path: "/System/Applications/Utilities/Terminal.app", name: "Terminal" },
    ],
    // Every disk image's name says which Mac it's for, Intel too (electron-builder leaves x64 out).
    // biome-ignore lint/suspicious/noTemplateCurlyInString: electron-builder fills in its own ${…} names
    artifactName: "Edunex-Plus-${version}-${arch}.${ext}",
    // The app updates itself from the zip; the disk image is only for a first install.
    writeUpdateInfo: false,
  },
  win: {
    // Intel and AMD PCs; the ARM installer is built beside it (WINDOWS_ARM_INSTALLER above).
    target: [{ target: "nsis", arch: ["x64"] }],
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
    // Intel and AMD PCs, under the name 0.1.0-alpha.5 looks for when it updates itself.
    // biome-ignore lint/suspicious/noTemplateCurlyInString: electron-builder fills in its own ${…} names
    artifactName: "Edunex-Plus-Setup-${version}.${ext}",
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
  appImage: {
    // biome-ignore lint/suspicious/noTemplateCurlyInString: electron-builder fills in its own ${…} names
    artifactName: "Edunex-Plus-${version}-${arch}.${ext}",
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
  // Where the app's updates come from (src/desktop/self-update.ts). With this, every build writes
  // the update info files beside its installers (latest-mac.yml, latest.yml, latest-linux.yml,
  // latest-linux-arm64.yml), each with the sha512 of the files the app may download; the release
  // workflow puts them on the release. Builds never upload anything themselves (--publish never).
  publish: { provider: "github", owner: "pablonification", repo: "edunex-plus", releaseType: "draft" },
  // Always "latest*.yml", an alpha's too: the app picks the release itself, by the rule in
  // src/engine/updates.ts, and only reads the file from it.
  detectUpdateChannel: false,
};
