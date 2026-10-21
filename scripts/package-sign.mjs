// The Mac app's signature, the same in every release. electron-builder signs the app ad-hoc
// (electron-builder.config.mjs), and an ad-hoc signature names only that build's exact bytes.
// Signed with the project's own certificate, every release is "id.edunexplus.desktop, signed by
// that certificate": macOS updates it in place and keeps its notifications. The keychain goes
// further: for a certificate Apple didn't issue, it lets an app back into an entry without asking
// only while it's the exact build the Student allowed, so it would still ask after every update.
// That's what the keychain helper is for (native/mac-keychain, docs/adr/0003-mac-keychain-helper.md):
// signed once with the certificate and committed, it ships as it is in every release, never signed
// again here, and every Mac build checks it's still that one build (`checkKeychainHelper`).
//
// electron-builder calls `afterSign` once it has signed, before it makes the disk image and the
// zip. When MAC_SIGNING_KEYCHAIN names a keychain holding the certificate (the release workflow
// makes one from the repository's secrets), this signs every piece of code in the app again with
// it, the code inside first, and checks the result. Without it the app stays ad-hoc, as local
// builds and forks are (the helper then refuses to answer it: the vault uses Electron's
// safeStorage, as before). The certificate isn't Apple's, so macOS still can't check the app when
// it's first downloaded: the first install still needs the Terminal line (docs/install.md).
// A certificate: node scripts/make-signing-cert.mjs.
import { execFile } from "node:child_process";
import { open, readdir, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { binaryPath } from "./package-fuses.mjs";

const run = promisify(execFile);

/**
 * The keychain helper: the committed file, where it goes in the app (under Contents), the name its
 * signature gives it, and what it's built from and is (written by scripts/build-keychain-helper.mjs).
 */
export const KEYCHAIN_HELPER = {
  file: "native/mac-keychain/edunex-plus-keychain",
  inApp: "Helpers/Edunex Plus Keychain",
  identifier: "id.edunexplus.keychain",
  manifest: "native/mac-keychain/helper.json",
};

/** The cdhash in what `codesign -d -vvv` prints for one architecture, or null. */
export function cdhashIn(printed) {
  return /^CDHash=([0-9a-f]{40})$/m.exec(printed)?.[1] ?? null;
}

/**
 * What's wrong with the keychain helper's cdhash for each architecture against the manifest's: one
 * line per difference, none when it's the one build every release carries.
 */
export function helperProblems(found, expected) {
  return Object.entries(expected)
    .filter(([arch, cdhash]) => found[arch] !== cdhash)
    .map(([arch, cdhash]) => `${arch}: ${found[arch] ?? "no signature"}, should be ${cdhash}`);
}

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

/**
 * The order to sign in: the deepest code first, so each bundle is signed after what it holds, and
 * the app itself last. Not the keychain helper: it keeps the signature it was committed with.
 */
export function signingOrder(app, code) {
  const depth = (file) => file.split("/").length;
  const helper = path.join(app, "Contents", KEYCHAIN_HELPER.inApp);
  return code
    .filter((file) => file !== helper)
    .sort((a, b) => depth(b) - depth(a) || (a < b ? -1 : 1))
    .concat(app);
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
export async function withKeychainSearched(keychain, work) {
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

/**
 * Fails the build unless the app carries the keychain helper exactly as committed, each architecture
 * with the cdhash in the manifest. Any other build of it, and macOS would ask every Student for their
 * password once more after updating (scripts/build-keychain-helper.mjs says when that's worth it).
 */
export async function checkKeychainHelper(app) {
  const file = path.join(app, "Contents", KEYCHAIN_HELPER.inApp);
  const expected = JSON.parse(await readFile(new URL(`../${KEYCHAIN_HELPER.manifest}`, import.meta.url), "utf8")).cdhash;
  const found = {};
  const said = [];
  for (const arch of Object.keys(expected)) {
    const printed = await run("/usr/bin/codesign", ["-d", "-vvv", "--arch", arch, file]).catch((error) => ({ stderr: String(error.stderr || error.message) }));
    found[arch] = cdhashIn(printed.stderr);
    // No cdhash: what codesign said instead (no such file, not signed, …).
    if (!found[arch]) said.push(`codesign (${arch}): ${printed.stderr.trim()}`);
  }
  const problems = [...helperProblems(found, expected), ...said];
  if (problems.length) throw new Error(`The keychain helper in ${app} isn't the committed build (${KEYCHAIN_HELPER.manifest}):\n  ${problems.join("\n  ")}`);
  console.log(
    `  • keychain helper checked  ${Object.entries(found)
      .map(([arch, cdhash]) => `${arch}=${cdhash}`)
      .join(" ")}`,
  );
}

/** electron-builder hook, once it has signed the app ad-hoc: with a certificate, it's signed again with it. Either way, the keychain helper is checked. */
export async function afterSign(context) {
  if (context.electronPlatformName !== "darwin") return;
  const app = binaryPath(context);
  const keychain = signingKeychain(process.env);
  if (keychain) await signWithCertificate(app, context.packager.appInfo.id, keychain);
  else console.log("  • kept the ad-hoc signature  reason=no MAC_SIGNING_KEYCHAIN with the project's certificate");
  await checkKeychainHelper(app);
}
