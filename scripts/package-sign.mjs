// The Mac app's signature, the same in every release. electron-builder signs the app ad-hoc
// (electron-builder.config.mjs), and an ad-hoc signature names only that build's exact bytes: to
// macOS each update is another app, so it asks the Student for their password before the new
// version may open its keychain item ("Edunex Plus Safe Storage", the key their sign-in is locked
// with). Signed with the project's own certificate, every release is "id.edunexplus.desktop,
// signed by that certificate", and the keychain lets it in without asking.
//
// electron-builder calls `afterSign` once it has signed, before it makes the disk image and the
// zip. When MAC_SIGNING_KEYCHAIN names a keychain holding the certificate (the release workflow
// makes one from the repository's secrets), this signs every piece of code in the app again with
// it, the code inside first, and checks the result. Without it the app stays ad-hoc, as local
// builds and forks are. The certificate isn't Apple's, so macOS still can't check the app when
// it's first downloaded: the first install still needs the Terminal line (docs/install.md).
// A certificate: node scripts/make-signing-cert.mjs.
import { execFile } from "node:child_process";
import { open, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { binaryPath } from "./package-fuses.mjs";

const run = promisify(execFile);

/** The keychain holding the certificate (MAC_SIGNING_KEYCHAIN), or null: the app stays signed ad-hoc. */
export function signingKeychain(env) {
  return env.MAC_SIGNING_KEYCHAIN?.trim() || null;
}

/** The one code-signing certificate in what `security find-identity -p codesigning <keychain>` lists: its SHA-1 and name. */
export function signingIdentity(listed, keychain) {
  const found = new Map();
  for (const [, hash, name] of listed.matchAll(/^\s*\d+\) ([0-9A-F]{40}) "(.*)"/gm)) found.set(hash, name);
  if (found.size === 0) throw new Error(`No code-signing certificate in ${keychain}`);
  if (found.size > 1) throw new Error(`More than one code-signing certificate in ${keychain} (${[...found.values()].join(", ")}): keep only the app's`);
  const [[hash, name]] = found;
  return { hash, name };
}

/** The order to sign in: the deepest code first, so each bundle is signed after what it holds, and the app itself last. */
export function signingOrder(app, code) {
  const depth = (file) => file.split("/").length;
  return [...code].sort((a, b) => depth(b) - depth(a) || (a < b ? -1 : 1)).concat(app);
}

/** codesign's arguments to sign one piece of code with the certificate, keeping the name, entitlements and flags electron-builder gave it. */
export function codesignArgs(identity, keychain, file) {
  return ["--sign", identity, "--keychain", keychain, "--force", "--timestamp=none", "--preserve-metadata=identifier,entitlements,flags", file];
}

/**
 * Whether what `codesign -d -r-` prints says "this app, signed by this certificate", rather than
 * one build's exact bytes (an ad-hoc signature's cdhash). In a chain of one certificate its root
 * is its leaf: codesign names the root when the certificate has an organization (O=).
 */
export function namesCertificate(designated, identifier, sha1) {
  return ["leaf", "root"].some((end) => designated.trim() === `designated => identifier "${identifier}" and certificate ${end} = H"${sha1.toLowerCase()}"`);
}

/** The keychains in what `security list-keychains` prints, one quoted path a line. */
export function keychainList(listed) {
  return listed
    .split("\n")
    .map((line) => line.trim().replace(/^"(.*)"$/, "$1"))
    .filter(Boolean);
}

// The first four bytes of a Mach-O file, one architecture or several, either byte order.
const MACH_O = new Set([0xfeedface, 0xfeedfacf, 0xcefaedfe, 0xcffaedfe, 0xcafebabe, 0xbebafeca]);

async function isMachO(file) {
  const handle = await open(file, "r");
  try {
    const { buffer, bytesRead } = await handle.read(Buffer.alloc(4), 0, 4, 0);
    return bytesRead === 4 && MACH_O.has(buffer.readUInt32BE(0));
  } finally {
    await handle.close();
  }
}

/** Every piece of code under `folder`: Mach-O files and the .app and .framework bundles. Links are skipped: what they point at is in the list itself. */
async function codeIn(folder) {
  const code = [];
  for (const entry of await readdir(folder, { withFileTypes: true })) {
    const file = path.join(folder, entry.name);
    if (entry.isDirectory()) {
      code.push(...(await codeIn(file)));
      if (/\.(app|framework)$/.test(entry.name)) code.push(file);
    } else if (entry.isFile() && (await isMachO(file))) {
      code.push(file);
    }
  }
  return code;
}

/** Runs `work` with the keychain on the user's keychain search list, the only place codesign looks for a certificate; the list is put back as it was. */
async function withKeychainSearched(keychain, work) {
  const before = keychainList((await run("/usr/bin/security", ["list-keychains", "-d", "user"])).stdout);
  if (before.includes(await realpath(keychain))) return work();
  await run("/usr/bin/security", ["list-keychains", "-d", "user", "-s", ...before, keychain]);
  try {
    return await work();
  } finally {
    await run("/usr/bin/security", ["list-keychains", "-d", "user", "-s", ...before]);
  }
}

/** Signs every piece of code in the app with the one certificate in `keychain`, then checks the app as macOS will, and that it's `identifier` signed by the certificate. */
async function signWithCertificate(app, identifier, keychain) {
  const { hash, name } = signingIdentity((await run("/usr/bin/security", ["find-identity", "-p", "codesigning", keychain])).stdout, keychain);
  const order = signingOrder(app, await codeIn(path.join(app, "Contents")));
  await withKeychainSearched(keychain, async () => {
    for (const file of order) await run("/usr/bin/codesign", codesignArgs(hash, keychain, file));
  });
  await run("/usr/bin/codesign", ["--verify", "--deep", "--strict", app]);
  const designated = (await run("/usr/bin/codesign", ["-d", "-r-", app])).stdout.trim();
  if (!namesCertificate(designated, identifier, hash)) throw new Error(`${app} doesn't name the certificate after signing: ${designated}`);
  console.log(`  • signed with the certificate  name="${name}" sha1=${hash} files=${order.length} ${designated}`);
}

/** electron-builder hook, once it has signed the app ad-hoc: with a certificate, it's signed again with it. */
export async function afterSign(context) {
  if (context.electronPlatformName !== "darwin") return;
  const keychain = signingKeychain(process.env);
  if (!keychain) {
    console.log("  • kept the ad-hoc signature  reason=no MAC_SIGNING_KEYCHAIN with the project's certificate");
    return;
  }
  await signWithCertificate(binaryPath(context), context.packager.appInfo.id, keychain);
}
