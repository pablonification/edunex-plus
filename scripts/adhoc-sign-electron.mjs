// Re-signs the development Electron bundle ad-hoc so OS notifications are
// deliverable (Electron 42+ carve-out; spec #15). Wired as package.json
// postinstall, so it runs on every fresh install. Packaged builds are signed
// ad-hoc by electron-builder (electron-builder.config.mjs).
//
//   node scripts/adhoc-sign-electron.mjs            → node_modules dev bundle
//   node scripts/adhoc-sign-electron.mjs <path.app> → any other app bundle
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

function sign(appPath) {
  execFileSync("codesign", ["--force", "--deep", "--sign", "-", appPath], {
    stdio: "inherit",
  });
  console.log(`ad-hoc signed ${appPath}`);
}

if (process.platform !== "darwin") process.exit(0);

const target = process.argv[2];
if (target) {
  sign(path.resolve(target));
  process.exit(0);
}

const devApp = path.resolve(import.meta.dirname, "..", "node_modules", "electron", "dist", "Electron.app");
if (existsSync(devApp)) sign(devApp);
