// Gets the development Electron bundle ready on macOS: gives it Edunex Plus's
// name and icon, so the Dock, the menu bar and Cmd-Tab show "Edunex Plus Dev"
// and the app's icon instead of Electron's, then re-signs it ad-hoc so OS
// notifications are deliverable (Electron 42+ carve-out; spec #15). Wired as
// package.json postinstall, so it runs on every fresh install. Packaged builds
// are named, given their icon and signed ad-hoc by electron-builder
// (electron-builder.config.mjs).
//
//   node scripts/adhoc-sign-electron.mjs            → node_modules dev bundle
//   node scripts/adhoc-sign-electron.mjs <path.app> → only re-sign any other app bundle
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, utimesSync } from "node:fs";
import path from "node:path";

function sign(appPath) {
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", appPath], {
    stdio: "inherit",
  });
  console.log(`ad-hoc signed ${appPath}`);
}

/** The development bundle's name and icon, the ones the Dock and the menu bar read at launch. */
function dress(appPath) {
  const plist = path.join(appPath, "Contents", "Info.plist");
  for (const key of ["CFBundleName", "CFBundleDisplayName"]) execFileSync("plutil", ["-replace", key, "-string", "Edunex Plus Dev", plist]);
  copyFileSync(path.resolve(import.meta.dirname, "..", "assets", "icon.icns"), path.join(appPath, "Contents", "Resources", "electron.icns"));
  // A newer date tells Finder and the Dock to read the icon again.
  const now = new Date();
  utimesSync(appPath, now, now);
}

if (process.platform !== "darwin") process.exit(0);

const target = process.argv[2];
if (target) {
  sign(path.resolve(target));
  process.exit(0);
}

const devApp = path.resolve(import.meta.dirname, "..", "node_modules", "electron", "dist", "Electron.app");
if (existsSync(devApp)) {
  dress(devApp);
  sign(devApp);
}
