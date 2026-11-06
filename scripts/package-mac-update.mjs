// The Mac update, about a third smaller. The app updates itself from one file of a release
// (src/desktop/self-update.ts); on a Mac, up to 0.1.0-alpha.16, from the zip electron-builder makes
// (Edunex-Plus-<version>-<arch>-mac.zip, 118 MB for Apple silicon, 125 MB for Intel). Once
// electron-builder is done, this packs the app in each zip again as
// Edunex-Plus-<version>-<arch>-mac.tar.xz (80 MB, and 90 MB for Intel): tar keeps the links
// and modes Electron's frameworks need, as the zip does, and xz packs it tighter. Each goes into
// latest-mac.yml beside its zip, with its sha512 and size, so the app checks it as it checks the zip.
// The zip stays in every release: copies up to 0.1.0-alpha.16 update only from a file named like it.
//
// It's made from the zip, so it holds the app the zip holds, signature and all (scripts/package-sign.mjs
// signs before electron-builder makes the zip). Then it's unpacked as the app unpacks it and checked as
// macOS checks an app: with a link lost on the way, the update would leave Students an app that
// doesn't open.
//
// Unpacked with macOS's own tools, on every Mac the app runs on (macOS 12 and later): tar (bsdtar)
// reads xz itself. Packed with xz itself where it's installed (the release workflow installs it), on
// every core: in blocks of 64 MB, about 1% bigger than in one, and about three times as fast on three cores.
// Without it, macOS's own tar packs it on one core. Level 9 is all: `-9e` saves 0.1% more, and xz's
// newer filter for arm64 code is too new for macOS 12's tar to read.
//
// Builds that publish nothing (pushes to main, runs by hand) pass --quick: the same packing, unpacking
// and signature check, at level 1, a fifth bigger. Releases leave it out.
//
//   node scripts/package-mac-update.mjs release [--quick]
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { listedFiles, sha512Of, withFilesListed } from "./update-info.mjs";

const run = promisify(execFile);

/** The update's name beside its zip: Edunex-Plus-1.2.3-arm64-mac.zip → Edunex-Plus-1.2.3-arm64-mac.tar.xz. */
export function updateName(zip) {
  if (!zip.endsWith("-mac.zip")) throw new Error(`Not a Mac zip: ${zip}`);
  return `${zip.slice(0, -".zip".length)}.tar.xz`;
}

/**
 * tar's arguments to pack `app` into `out`: its links and modes as they are, and nothing macOS keeps
 * beside a file (extended attributes, ACLs, flags, ._ files), which is no part of the app or its signature.
 * Packed by the xz program at `xz` on every core, or without it by tar on one.
 */
export function packArgs(app, out, { level = 9, xz = null } = {}) {
  const compress = xz ? ["--use-compress-program", `${xz} -${level} --threads=0 --block-size=64MiB`] : ["-J", "--options", `xz:compression-level=${level}`];
  return ["-c", ...compress, "--no-mac-metadata", "--no-xattrs", "--no-acls", "--no-fflags", "-f", out, "-C", path.dirname(app), path.basename(app)];
}

/** Where the xz program is, or null where it isn't installed. */
async function findXz() {
  const { stdout } = await run("/bin/sh", ["-c", "command -v xz"]).catch(() => ({ stdout: "" }));
  return stdout.trim() || null;
}

/** The one app in a folder an archive was unpacked into. */
async function appIn(folder) {
  const apps = (await readdir(folder)).filter((name) => name.endsWith(".app"));
  if (apps.length !== 1) throw new Error(`${folder} holds ${apps.length} apps, not one`);
  return path.join(folder, apps[0]);
}

/**
 * Packs the app in `zip` into `out`, then unpacks `out` as the app does (src/desktop/updater.ts) and
 * checks what comes out as macOS checks an app. Its sha512 and size.
 */
export async function packMacUpdate(zip, out, { level = 9 } = {}) {
  const work = await mkdtemp(path.join(os.tmpdir(), "mac-update-"));
  try {
    const fromZip = path.join(work, "zip");
    await run("/usr/bin/ditto", ["-x", "-k", zip, fromZip]);
    await run("/usr/bin/tar", packArgs(await appIn(fromZip), out, { level, xz: await findXz() }));
    await rm(fromZip, { recursive: true, force: true });
    const fromTar = path.join(work, "tar");
    await mkdir(fromTar);
    await run("/usr/bin/tar", ["-x", "-f", out, "-C", fromTar]);
    const app = await appIn(fromTar);
    await run("/usr/bin/codesign", ["--verify", "--deep", "--strict", app]).catch((error) => {
      throw new Error(`The app unpacked from ${path.basename(out)} isn't the signed app: ${String(error.stderr || error.message).trim()}`);
    });
  } catch (error) {
    await rm(out, { force: true });
    throw error;
  } finally {
    await rm(work, { recursive: true, force: true });
  }
  return { sha512: await sha512Of(out), size: (await stat(out)).size };
}

/** Packs the update beside each Mac zip `folder`'s latest-mac.yml lists, and lists it there too. */
export async function packMacUpdatesIn(folder, { level = 9 } = {}) {
  const info = path.join(folder, "latest-mac.yml");
  const yml = await readFile(info, "utf8");
  const zips = listedFiles(yml).filter((name) => name.endsWith("-mac.zip"));
  if (!zips.length) throw new Error(`${info} lists no Mac zip`);
  // Both kinds of Mac at once, where one build made both: without the xz program, each packs on one core.
  const packed = await Promise.all(
    zips.map(async (zip) => {
      const name = updateName(zip);
      const update = await packMacUpdate(path.join(folder, zip), path.join(folder, name), { level });
      const { size } = await stat(path.join(folder, zip));
      console.log(`  • packed the update smaller  file=${name} size=${update.size} zip=${size} saved=${Math.round((1 - update.size / size) * 100)}%`);
      return [name, update];
    }),
  );
  await writeFile(info, withFilesListed(yml, Object.fromEntries(packed)));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const quick = args.includes("--quick");
  const [folder] = args.filter((arg) => arg !== "--quick");
  if (!folder) {
    console.error("usage: node scripts/package-mac-update.mjs <folder with the Mac zips and latest-mac.yml> [--quick]");
    process.exit(2);
  }
  packMacUpdatesIn(path.resolve(folder), { level: quick ? 1 : 9 }).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
