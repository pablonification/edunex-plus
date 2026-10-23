// The Windows installers' signature. Release builds are signed by SignPath Foundation (free code
// signing for open-source projects, docs/code-signing.md) on its own servers, from a GitHub Actions
// artifact: electron-builder can't hand it a file halfway through a build. So a signed release is
// built in two passes (scripts/package-win.mjs):
//
// 1. `--to-sign <folder>`: both installers as usual, and in <folder> the project's own programs that
//    must be signed before an installer can be made: each kind of PC's "Edunex Plus.exe" (x64/,
//    arm64/) and the uninstaller electron-builder made for it (uninstallers/). The installer runs the
//    uninstaller it replaces on every update, and Smart App Control stops one that isn't signed.
//    Electron's own DLLs stay as Electron ships them: SignPath's terms don't let a project sign
//    someone else's files. Here, the hook below keeps each uninstaller aside as it's made.
// 2. `--signed <folder>`: the signed programs back in the app folders, and the installers made again
//    from them (electron-builder --prepackaged leaves the folders as they are). electron-builder makes
//    each uninstaller again, and the hook puts the signed one in its place. The installers are then
//    signed themselves, and scripts/update-info.mjs writes their new sha512 into latest*.yml.
//
// Without these variables (local builds, forks, releases before SignPath is set up) there's no hook,
// and electron-builder signs nothing, as before.
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { sha512Of } from "./update-info.mjs";

/**
 * The name each kind of PC's "Edunex Plus.exe" goes to be signed under: no spaces on the way (one
 * project reports SignPath turning them into dots). SignPath's configuration names the same files
 * (.signpath/windows-programs.xml).
 */
export const PROGRAMS_TO_SIGN = { arm64: "Edunex-Plus-arm64.exe", x64: "Edunex-Plus-x64.exe" };

/** The uninstaller electron-builder makes beside an installer, named after it: "<installer>.__uninstaller.exe". */
export const isUninstaller = (file) => path.basename(file).endsWith("__uninstaller.exe");

/** The uninstallers the build makes for installers named `artifactNames` (electron-builder's ${…} names) at `version`. */
export function uninstallerNames(artifactNames, version) {
  // biome-ignore lint/suspicious/noTemplateCurlyInString: electron-builder fills in its own ${…} names
  return artifactNames.map((name) => name.replace("${version}", version).replace("${ext}", "__uninstaller.exe"));
}

/**
 * What the hook does in this build, from the variables scripts/package-win.mjs sets: keep the
 * uninstallers aside (pass 1), put the signed ones in (pass 2), or nothing (null).
 */
export function uninstallerStep(env) {
  const list = env.WINDOWS_UNINSTALLERS_LIST?.trim();
  const keep = env.WINDOWS_KEEP_UNINSTALLERS?.trim();
  const signed = env.WINDOWS_SIGNED_UNINSTALLERS?.trim();
  if (keep && signed) throw new Error("WINDOWS_KEEP_UNINSTALLERS and WINDOWS_SIGNED_UNINSTALLERS are two different passes: set one");
  if (!keep && !signed) return null;
  if (!list) throw new Error("WINDOWS_UNINSTALLERS_LIST names the file that notes each uninstaller's sha512");
  return keep ? { step: "keep", folder: keep, list } : { step: "swap", folder: signed, list };
}

/**
 * The size of a Windows program's Authenticode signature (its certificate table), 0 for none: the
 * security entry of the PE optional header's data directories. Says a file was signed, not that the
 * signature is valid or trusted; the release workflow asks Windows itself for that.
 */
export function signatureSize(pe) {
  if (pe.length < 64 || pe.toString("latin1", 0, 2) !== "MZ") throw new Error("Not a Windows program");
  const header = pe.readUInt32LE(0x3c);
  if (pe.toString("latin1", header, header + 4) !== "PE\0\0") throw new Error("Not a Windows program");
  const optional = header + 24;
  // The data directories follow 96 bytes of optional header in PE32, 112 in PE32+; security is the fifth.
  const security = optional + (pe.readUInt16LE(optional) === 0x20b ? 112 : 96) + 4 * 8;
  return pe.readUInt32LE(security + 4);
}

/** Stops unless the program at `file` carries a signature. */
export async function mustBeSigned(file) {
  if (signatureSize(await readFile(file)) === 0) throw new Error(`${file} came back without a signature`);
}

const readList = async (list) => JSON.parse(await readFile(list, "utf8").catch(() => "{}"));

/** Pass 1: a copy of the uninstaller in `folder`, and its sha512 in `list`. */
export async function keepUninstaller(file, folder, list) {
  const name = path.basename(file);
  await mkdir(folder, { recursive: true });
  await copyFile(file, path.join(folder, name));
  const noted = await readList(list);
  noted[name] = await sha512Of(file);
  await writeFile(list, `${JSON.stringify(noted, null, 2)}\n`);
  console.log(`  • uninstaller kept for signing  file=${name}`);
}

/**
 * Pass 2: the signed copy of this uninstaller, from `folder`, in its place. It's the uninstaller pass 1
 * made for the same installer, from the same script and version. electron-builder may make it again
 * byte for byte, or not: it hands the uninstaller's build the app archive's size and hash too, and
 * those change once the app is signed. Which one it was is said in the log.
 */
export async function swapUninstaller(file, folder, list) {
  const name = path.basename(file);
  const kept = (await readList(list))[name];
  if (!kept) throw new Error(`No uninstaller named ${name} was kept for signing (${list})`);
  const signed = path.join(folder, name);
  await mustBeSigned(signed);
  const same = (await sha512Of(file)) === kept;
  await copyFile(signed, file);
  console.log(`  • signed uninstaller put in  file=${name} madeAgain=${same ? "identical" : "different bytes"}`);
}

/** electron-builder's sign hook (win.signtoolOptions.sign) for this step: it acts on the uninstaller and lets every other file through. */
export function uninstallerHook(step) {
  return async ({ path: file }) => {
    if (!isUninstaller(file)) return;
    if (step.step === "keep") await keepUninstaller(file, step.folder, step.list);
    else await swapUninstaller(file, step.folder, step.list);
  };
}
