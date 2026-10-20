// Electron's security switches ("fuses") for packaged builds. electron-builder
// calls `afterPack` for every platform before signing: it flips the fuses on
// the packaged Electron binary, reads them back and fails the build if any is
// wrong. Also a check for a finished build:
//
//   node scripts/package-fuses.mjs "release/mac-arm64/Edunex Plus.app"   (Intel: release/mac)
//   node scripts/package-fuses.mjs "release/win-unpacked/Edunex Plus.exe"
//   node scripts/package-fuses.mjs release/linux-unpacked/edunex-plus
import path from "node:path";
import { pathToFileURL } from "node:url";
import { FuseState, FuseV1Options, FuseVersion, flipFuses, getCurrentFuseWire } from "@electron/fuses";

/** What every packaged build must have: no Node mode, no inspector or NODE_OPTIONS, encrypted cookies, only the checked app archive. */
export const FUSES = {
  RunAsNode: false,
  EnableNodeOptionsEnvironmentVariable: false,
  EnableNodeCliInspectArguments: false,
  EnableCookieEncryption: true,
  EnableEmbeddedAsarIntegrityValidation: true,
  OnlyLoadAppFromAsar: true,
};

/** The wire read back from a binary ({ [fuse index]: FuseState }) against FUSES: one line per wrong fuse. */
export function fuseProblems(wire) {
  const problems = [];
  for (const [name, wanted] of Object.entries(FUSES)) {
    const state = wire[FuseV1Options[name]];
    const want = wanted ? FuseState.ENABLE : FuseState.DISABLE;
    if (state !== want) problems.push(`${name} is ${describe(state)}, should be ${wanted ? "on" : "off"}`);
  }
  return problems;
}

function describe(state) {
  if (state === FuseState.ENABLE) return "on";
  if (state === FuseState.DISABLE) return "off";
  if (state === FuseState.REMOVED) return "removed";
  return "missing";
}

/** The packaged Electron binary inside electron-builder's output folder. */
export function binaryPath(context) {
  const { appOutDir, electronPlatformName, packager } = context;
  if (electronPlatformName === "darwin" || electronPlatformName === "mas") return path.join(appOutDir, `${packager.appInfo.productFilename}.app`);
  if (electronPlatformName === "win32") return path.join(appOutDir, `${packager.appInfo.productFilename}.exe`);
  return path.join(appOutDir, packager.executableName);
}

export async function verifyFuses(binary) {
  const problems = fuseProblems(await getCurrentFuseWire(binary));
  if (problems.length) throw new Error(`Electron fuses are wrong in ${binary}:\n  ${problems.join("\n  ")}`);
  console.log(
    `  • fuses checked  ${Object.entries(FUSES)
      .map(([name, on]) => `${name}=${on ? "on" : "off"}`)
      .join(" ")}`,
  );
}

/** electron-builder hook: flip, then read back. The build stops here if a fuse didn't take. */
export async function afterPack(context) {
  const binary = binaryPath(context);
  const config = { version: FuseVersion.V1 };
  for (const [name, on] of Object.entries(FUSES)) config[FuseV1Options[name]] = on;
  await flipFuses(binary, config);
  await verifyFuses(binary);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const target = process.argv[2];
  if (!target) {
    console.error("usage: node scripts/package-fuses.mjs <packaged app or binary>");
    process.exit(2);
  }
  verifyFuses(path.resolve(target)).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
