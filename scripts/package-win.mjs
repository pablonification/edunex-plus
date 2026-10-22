// The Windows installers, one per kind of PC (`npm run package:win`): ARM first, under
// WINDOWS_ARM_INSTALLER, its latest.yml renamed WINDOWS_ARM_UPDATE_INFO; then x64 under the
// config's own name, writing the latest.yml 0.1.0-alpha.5 and the x64 app update from. One
// electron-builder run would put both kinds in one installer, twice the size. Each run is its
// own process: electron-builder changes the config it's given as it goes. Nothing is uploaded
// (--publish never), as with every build.
//
// The release workflow builds in two passes, so SignPath can sign in between (scripts/package-sign-win.mjs):
//
//   node scripts/package-win.mjs --to-sign <folder>   both installers, and in <folder> what's signed
//                                                     first: each app's "Edunex Plus.exe" (under
//                                                     PROGRAMS_TO_SIGN's names) and each uninstaller
//   node scripts/package-win.mjs --signed <folder>    those back from <folder>, signed, and both
//                                                     installers made again from them
import { execFileSync } from "node:child_process";
import { copyFile, mkdir, readFile, rename, rm } from "node:fs/promises";
import path from "node:path";
import config, { WINDOWS_ARM_INSTALLER, WINDOWS_ARM_UPDATE_INFO } from "../electron-builder.config.mjs";
import { mustBeSigned, PROGRAMS_TO_SIGN, uninstallerNames } from "./package-sign-win.mjs";

const out = config.directories.output;
/** Where pass 1 notes each uninstaller's sha512, outside what goes to be signed. */
const UNINSTALLERS_LIST = path.join(out, "uninstallers.json");
/** Each kind of PC's app folder, as electron-builder names it, and the name its program goes to be signed under. */
const APPS = [
  { arch: "arm64", folder: path.join(out, "win-arm64-unpacked"), staged: PROGRAMS_TO_SIGN.arm64 },
  { arch: "x64", folder: path.join(out, "win-unpacked"), staged: PROGRAMS_TO_SIGN.x64 },
];
const EXE = `${config.productName}.exe`;

const builder = (env, ...args) =>
  execFileSync(process.execPath, ["node_modules/electron-builder/cli.js", "--config", "electron-builder.config.mjs", "--publish", "never", ...args], {
    stdio: "inherit",
    env: { ...process.env, ...env },
  });

/** Both installers, ARM first; `prepackaged` makes them from the app folders as they are (pass 2). */
async function installers(env, prepackaged = false) {
  const from = (arch) => (prepackaged ? ["--prepackaged", APPS.find((app) => app.arch === arch).folder] : []);
  builder(env, "--win", "nsis", "--arm64", ...from("arm64"), `-c.nsis.artifactName=${WINDOWS_ARM_INSTALLER}`);
  await rename(path.join(out, "latest.yml"), path.join(out, WINDOWS_ARM_UPDATE_INFO));
  builder(env, "--win", "nsis", "--x64", ...from("x64"));
}

const [mode, folder] = process.argv.slice(2);
if (!mode) {
  await installers({});
} else if (mode === "--to-sign" && folder) {
  await rm(folder, { recursive: true, force: true });
  await rm(UNINSTALLERS_LIST, { force: true });
  await mkdir(folder, { recursive: true });
  await installers({ WINDOWS_KEEP_UNINSTALLERS: folder, WINDOWS_UNINSTALLERS_LIST: UNINSTALLERS_LIST });
  // Both uninstallers, or the build stops: without one, its installer would ship it unsigned.
  const { version } = JSON.parse(await readFile("package.json", "utf8"));
  const wanted = uninstallerNames([config.nsis.artifactName, WINDOWS_ARM_INSTALLER], version).sort();
  const kept = Object.keys(JSON.parse(await readFile(UNINSTALLERS_LIST, "utf8").catch(() => "{}"))).sort();
  if (kept.join() !== wanted.join()) throw new Error(`Kept ${kept.join(", ") || "no uninstaller"} for signing, not ${wanted.join(", ")}`);
  // Each app's own program as it went into the installer: fuses set, resources written, not yet signed.
  for (const { folder: app, staged } of APPS) await copyFile(path.join(app, EXE), path.join(folder, staged));
} else if (mode === "--signed" && folder) {
  for (const { folder: app, staged } of APPS) {
    await mustBeSigned(path.join(folder, staged));
    await copyFile(path.join(folder, staged), path.join(app, EXE));
  }
  await installers({ WINDOWS_SIGNED_UNINSTALLERS: folder, WINDOWS_UNINSTALLERS_LIST: UNINSTALLERS_LIST }, true);
} else {
  console.error("usage: node scripts/package-win.mjs [--to-sign <folder> | --signed <folder>]");
  process.exit(2);
}
