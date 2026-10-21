// Builds the Mac keychain helper (native/mac-keychain/keychain.c) and signs it with the project's
// certificate, into native/mac-keychain/edunex-plus-keychain: the file every release ships as it
// is (docs/adr/0003-mac-keychain-helper.md). Releases never build or sign it themselves. macOS
// knows the helper by its exact build and lets it back into the keychain without asking only while
// it's that one; built again, even from the same source with another Xcode, it's another build,
// and after updating to the release that carries it every Student is asked for their Mac password
// once more. So run this only when the helper has to change, and say so in that release's notes.
//
//   MAC_SIGNING_KEYCHAIN=<a keychain with the certificate> node scripts/build-keychain-helper.mjs
//
// (The keychain the release workflow makes from the repository's secrets, made the same way from
// the certificate's folder, CONTRIBUTING.md.) It also writes native/mac-keychain/helper.json, what
// the helper is built from and what it is: the tests check the source and the file against it, and
// every Mac build checks the helper's signature (scripts/package-sign.mjs).
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { cdhashIn, KEYCHAIN_HELPER, signingIdentity, signingKeychain, withKeychainSearched } from "./package-sign.mjs";

const run = promisify(execFile);
const root = fileURLToPath(new URL("..", import.meta.url));

export const HELPER_SOURCE = "native/mac-keychain/keychain.c";

/** clang's arguments: one file for both kinds of Mac, for the oldest macOS Electron runs on (12). */
export const CLANG_ARGS = [
  "-Os",
  "-Wall",
  "-Wextra",
  "-Werror",
  "-arch",
  "arm64",
  "-arch",
  "x86_64",
  "-mmacosx-version-min=12.0",
  "-framework",
  "CoreFoundation",
  "-framework",
  "Security",
];

/** codesign's arguments: the certificate, the helper's own name, and nothing else (no entitlements, no flags), so the same file always signs the same. */
export function helperCodesignArgs(identity, keychain, file) {
  return ["--sign", identity, "--keychain", keychain, "--force", "--timestamp=none", "--identifier", KEYCHAIN_HELPER.identifier, file];
}

export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function build(keychain) {
  const { hash, name } = signingIdentity((await run("/usr/bin/security", ["find-identity", "-p", "codesigning", keychain])).stdout, keychain);
  const folder = await mkdtemp(path.join(os.tmpdir(), "keychain-helper-"));
  try {
    const built = path.join(folder, "edunex-plus-keychain");
    await run("/usr/bin/xcrun", ["clang", ...CLANG_ARGS, "-o", built, path.join(root, HELPER_SOURCE)]);
    await withKeychainSearched(keychain, () => run("/usr/bin/codesign", helperCodesignArgs(hash, keychain, built)));
    const cdhash = {};
    for (const arch of ["arm64", "x86_64"]) cdhash[arch] = cdhashIn((await run("/usr/bin/codesign", ["-d", "-vvv", "--arch", arch, built])).stderr);
    const binary = await readFile(built);
    const { stdout: clang } = await run("/usr/bin/xcrun", ["clang", "--version"]);
    const manifest = {
      source: sha256(await readFile(path.join(root, HELPER_SOURCE))),
      file: sha256(binary),
      cdhash,
      builtWith: clang.split("\n")[0],
      signedBy: name,
    };
    await writeFile(path.join(root, KEYCHAIN_HELPER.file), binary, { mode: 0o755 });
    await writeFile(path.join(root, KEYCHAIN_HELPER.manifest), `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(
      `Built ${KEYCHAIN_HELPER.file}, signed by "${name}": ${Object.entries(cdhash)
        .map(([arch, h]) => `${arch}=${h}`)
        .join(" ")}`,
    );
  } finally {
    await rm(folder, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const keychain = signingKeychain(process.env);
  if (process.platform !== "darwin" || !keychain) {
    console.error("Builds on a Mac only, with MAC_SIGNING_KEYCHAIN naming a keychain that holds the project's certificate.");
    process.exit(1);
  }
  await build(keychain);
}
