// Re-signs Electron bundles ad-hoc so OS notifications are deliverable
// (Electron 42+ carve-out; spec #15). Wired as package.json postinstall —
// runs on every fresh install — and again in package:mac on the packaged app.
//
//   node scripts/adhoc-sign-electron.mjs            → node_modules dev bundle
//   node scripts/adhoc-sign-electron.mjs <path.app> → a packaged app bundle
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { readdirSync } from "node:fs";

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

// No target given but a packaged app dir exists (fresh `npm install` after a
// package run): re-sign those too so they're never left linker-signed.
const root = path.resolve(import.meta.dirname, "..");
for (const entry of readdirSync(root)) {
  if (entry.startsWith("Edunex Plus-darwin-")) {
    const app = path.join(root, entry, "Edunex Plus.app");
    if (existsSync(app)) sign(app);
  }
}
