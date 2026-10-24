// The update info files (latest.yml, latest-win-arm64.yml…) after the installers were signed
// outside electron-builder. electron-builder writes each file's sha512 as it finishes it; a file
// signed afterwards has other bytes, and the app's own updater (src/desktop/self-update.ts) would
// refuse to install it. This writes the signed files' sha512 (and size, where the file lists one)
// in their place:
//
//   node scripts/update-info.mjs release
//
// It also lists files electron-builder doesn't make, as the smaller Mac update
// (scripts/package-mac-update.mjs, `withFilesListed`).
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

const unquote = (value) => value.trim().replace(/^(['"])(.*)\1$/, "$2");

function checkSha512(name, sha512) {
  if (!/^[A-Za-z0-9+/]{86}==$/.test(sha512)) throw new Error(`Not a sha512 for ${name}: ${sha512}`);
}

/**
 * The file names an update info file lists, in the short, fixed shape electron-builder writes:
 * `files:` with `- url: …` items, then `path:` and `sha512:` for the main file.
 */
export function listedFiles(yml) {
  return [...yml.matchAll(/^\s*-\s+url:\s*(.+)$/gm)].map((match) => unquote(match[1]));
}

/**
 * The update info with each file in `signed` ({ name: { sha512, size } }) given its new sha512, under
 * its `- url:` item and at the top where `path:` names it, and its new size where the item has one.
 * Every other line stays as it was. Throws when the file lists none of them, or a hash is malformed.
 */
export function withSignedFiles(yml, signed) {
  for (const [name, { sha512 }] of Object.entries(signed)) checkSha512(name, sha512);
  const top = /^path:\s*(.+)$/m.exec(yml);
  const main = top ? unquote(top[1]) : null;
  let current = null;
  let changed = 0;
  const lines = yml.split(/(\r?\n)/);
  for (let i = 0; i < lines.length; i += 2) {
    const line = lines[i];
    const item = /^\s*-\s+url:\s*(.+)$/.exec(line);
    if (item) {
      current = unquote(item[1]);
      continue;
    }
    // Anything at the left edge ends the list of files.
    if (/^\S/.test(line)) current = null;
    const file = signed[current ?? (main && /^sha512:/.test(line) ? main : "")];
    if (!file) continue;
    const field = /^(\s*)(sha512|size):\s*.*$/.exec(line);
    if (!field || (field[2] === "size" && file.size == null)) continue;
    lines[i] = `${field[1]}${field[2]}: ${field[2] === "sha512" ? file.sha512 : file.size}`;
    changed++;
  }
  if (!changed) throw new Error(`The update info lists none of ${Object.keys(signed).join(", ")}`);
  return lines.join("");
}

/**
 * The update info with each file in `files` ({ name: { sha512, size } }) listed: one it lists already
 * gets the new sha512 and size, as in withSignedFiles; a new one goes after the files it lists, so an
 * app that knows only those reads them as before. Throws when the file has no `files:` list.
 */
export function withFilesListed(yml, files) {
  const listed = new Set(listedFiles(yml));
  const known = Object.entries(files).filter(([name]) => listed.has(name));
  const added = Object.entries(files).filter(([name]) => !listed.has(name));
  for (const [name, { sha512 }] of added) checkSha512(name, sha512);
  const updated = known.length ? withSignedFiles(yml, Object.fromEntries(known)) : yml;
  if (!added.length) return updated;
  const end = updated.includes("\r\n") ? "\r\n" : "\n";
  const lines = updated.split(end);
  const start = lines.findIndex((line) => /^files:\s*$/.test(line));
  if (start === -1) throw new Error("The update info has no files: list");
  // The list goes on while its lines are indented.
  let after = start + 1;
  while (after < lines.length && /^\s/.test(lines[after])) after++;
  lines.splice(after, 0, ...added.flatMap(([name, { sha512, size }]) => [`  - url: ${name}`, `    sha512: ${sha512}`, `    size: ${size}`]));
  return lines.join(end);
}

/** A file's sha512, base64, as electron-builder writes it. */
export function sha512Of(file) {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha512");
    createReadStream(file)
      .on("data", (chunk) => hash.update(chunk))
      .on("end", () => resolve(hash.digest("base64")))
      .on("error", reject);
  });
}

/** Rewrites every latest*.yml in `folder` for the files it lists that are there now (the signed installers). */
export async function updateInfoIn(folder) {
  const names = (await readdir(folder)).filter((name) => /^latest.*\.yml$/.test(name));
  if (!names.length) throw new Error(`No latest*.yml in ${folder}`);
  for (const name of names) {
    const file = path.join(folder, name);
    const yml = await readFile(file, "utf8");
    const signed = {};
    for (const listed of listedFiles(yml)) {
      const at = path.join(folder, listed);
      const found = await stat(at).catch(() => null);
      if (found?.isFile()) signed[listed] = { sha512: await sha512Of(at), size: found.size };
    }
    if (!Object.keys(signed).length) continue;
    await writeFile(file, withSignedFiles(yml, signed));
    for (const [listed, { sha512 }] of Object.entries(signed)) console.log(`  • update info  file=${name} lists=${listed} sha512=${sha512.slice(0, 16)}…`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const folder = process.argv[2];
  if (!folder) {
    console.error("usage: node scripts/update-info.mjs <folder with the installers and latest*.yml>");
    process.exit(2);
  }
  updateInfoIn(path.resolve(folder)).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
