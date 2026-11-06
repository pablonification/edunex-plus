// The Mac's update info, whole again. The release workflow builds the app for each kind of Mac on a
// Mac of its own, at the same time; each build's latest-mac.yml lists only its own files, and is kept
// as latest-mac-<arch>.yml so the two don't overwrite each other. Before the release is published, this
// writes the one latest-mac.yml the app reads (src/desktop/self-update.ts): Intel's, as electron-builder
// wrote it when one build made both (its zip at the top, under `path:`), then Apple silicon's files
// after Intel's. The two halves go.
//
//   node scripts/join-mac-update-info.mjs installers
import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { listedFiles, withFilesListed } from "./update-info.mjs";

/** The kinds of Mac, in the order the joined update info lists their files. */
export const MAC_ARCHS = ["x64", "arm64"];

/** Each file an update info lists, with its sha512 and size. */
export function listedItems(yml) {
  const items = {};
  let current = null;
  for (const line of yml.split(/\r?\n/)) {
    const item = /^\s*-\s+url:\s*(.+)$/.exec(line);
    if (item) {
      current = item[1].trim();
      items[current] = {};
      continue;
    }
    // Anything at the left edge ends the list of files.
    if (/^\S/.test(line)) current = null;
    const field = current && /^\s+(sha512|size):\s*(.+)$/.exec(line);
    if (field) items[current][field[1]] = field[1] === "size" ? Number(field[2]) : field[2].trim();
  }
  for (const [name, { sha512, size }] of Object.entries(items))
    if (!sha512 || !Number.isFinite(size)) throw new Error(`The update info lists ${name} without its sha512 and size`);
  return items;
}

/** One update info from the halves `ymls` ({ x64, arm64 }): the first's, with the other's files after its own. */
export function joinedUpdateInfo(ymls) {
  const [first, ...others] = MAC_ARCHS.map((arch) => {
    if (!ymls[arch]) throw new Error(`No update info for the ${arch} Mac`);
    return ymls[arch];
  });
  const version = (yml) => /^version:\s*(.+)$/m.exec(yml)?.[1].trim();
  let joined = first;
  for (const other of others) {
    if (version(other) !== version(first)) throw new Error(`The Macs' update info is for two versions: ${version(first)} and ${version(other)}`);
    const twice = listedFiles(other).filter((name) => listedFiles(joined).includes(name));
    if (twice.length) throw new Error(`Both Macs' update info list ${twice.join(", ")}`);
    joined = withFilesListed(joined, listedItems(other));
  }
  return joined;
}

/** Joins latest-mac-<arch>.yml in `folder` into latest-mac.yml, and removes the halves. */
export async function joinMacUpdateInfoIn(folder) {
  const halves = Object.fromEntries(MAC_ARCHS.map((arch) => [arch, path.join(folder, `latest-mac-${arch}.yml`)]));
  const ymls = {};
  for (const [arch, file] of Object.entries(halves))
    ymls[arch] = await readFile(file, "utf8").catch(() => {
      throw new Error(`No ${path.basename(file)} in ${folder}: did the ${arch} Mac build finish?`);
    });
  const joined = joinedUpdateInfo(ymls);
  await writeFile(path.join(folder, "latest-mac.yml"), joined);
  for (const file of Object.values(halves)) await rm(file);
  console.log(`  • joined the Macs' update info  files=${listedFiles(joined).length}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const folder = process.argv[2];
  if (!folder) {
    console.error("usage: node scripts/join-mac-update-info.mjs <folder with latest-mac-x64.yml and latest-mac-arm64.yml>");
    process.exit(2);
  }
  joinMacUpdateInfoIn(path.resolve(folder)).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
