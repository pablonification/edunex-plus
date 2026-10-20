// The Windows installers, one per kind of PC (`npm run package:win`): ARM first, under
// WINDOWS_ARM_INSTALLER, its latest.yml renamed WINDOWS_ARM_UPDATE_INFO; then x64 under the
// config's own name, writing the latest.yml 0.1.0-alpha.5 and the x64 app update from. One
// electron-builder run would put both kinds in one installer, twice the size. Each run is its
// own process: electron-builder changes the config it's given as it goes. Nothing is uploaded
// (--publish never), as with every build.
import { execFileSync } from "node:child_process";
import { renameSync } from "node:fs";
import path from "node:path";
import config, { WINDOWS_ARM_INSTALLER, WINDOWS_ARM_UPDATE_INFO } from "../electron-builder.config.mjs";

const out = config.directories.output;
const builder = (...args) =>
  execFileSync(process.execPath, ["node_modules/electron-builder/cli.js", "--config", "electron-builder.config.mjs", "--publish", "never", ...args], {
    stdio: "inherit",
  });

builder("--win", "nsis", "--arm64", `-c.nsis.artifactName=${WINDOWS_ARM_INSTALLER}`);
renameSync(path.join(out, "latest.yml"), path.join(out, WINDOWS_ARM_UPDATE_INFO));
builder("--win", "nsis", "--x64");
