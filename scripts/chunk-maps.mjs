// The chunk maps that let an update download only what the computer doesn't have yet
// (docs/adr/0008-download-only-what-changed.md, src/desktop/partial-update.ts). For each file the app
// updates from (the Windows installers, the AppImages), a map of its chunks; for each Mac app, a map
// of its folders, files and links, and a pack of their chunks, each packed on its own. Each map is
// listed in the latest*.yml beside its file with its sha512, so the app trusts it as it trusts the
// file. The chunks are cut as the app cuts them (src/desktop/chunks.ts, loaded as it is).
//
// Run last, once the files are final (signed, and their sha512 written by scripts/update-info.mjs):
//
//   node scripts/chunk-maps.mjs release
import { createHash } from "node:crypto";
import { once } from "node:events";
import { createReadStream, createWriteStream } from "node:fs";
import { lstat, readdir, readFile, readlink, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { brotliCompressSync, constants } from "node:zlib";
import { CHUNKER, chunker, chunkMapName, chunkPackName, macAppName, parseChunkMap } from "../src/desktop/chunks.ts";
import { listedFiles, sha512Of, withSignedFiles } from "./update-info.mjs";

/** The files the app updates from: the Windows installers and the AppImages (the Mac updates from its app's map). */
const isUpdateFile = (name) => /\.(exe|AppImage)$/.test(name);
/** Where electron-builder leaves each Mac app, and which Mac it's for. */
const MAC_APPS = { "mac-arm64": "arm64", mac: "x64" };
/** Packed as small as it's worth: quality 11 saves 7% more and takes a minute for every 30 MB. */
const BROTLI = { params: { [constants.BROTLI_PARAM_QUALITY]: 9, [constants.BROTLI_PARAM_LGWIN]: 18 } };

/** The map of one release file: its chunks, read from the file itself. */
export async function fileMap(file) {
  const chunks = [];
  const cutter = chunker((chunk) => chunks.push([chunk.sha256, chunk.size]));
  const sha512 = createHash("sha512");
  for await (const piece of createReadStream(file, { highWaterMark: 1024 * 1024 })) {
    cutter.push(piece);
    sha512.update(piece);
  }
  cutter.end();
  const { size, mode } = await stat(file);
  const name = path.basename(file);
  return {
    format: 1,
    chunker: CHUNKER,
    source: { name, size },
    chunks,
    files: [{ path: name, type: "file", mode: mode & 0o777, size, sha512: sha512.digest("base64"), chunks: chunks.map((_, index) => index) }],
  };
}

/** Everything in `folder` under `under`, a folder before what's in it, in a fixed order. */
async function* walk(folder, under) {
  const names = (await readdir(path.join(folder, under))).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  for (const name of names) {
    const relative = `${under}/${name}`;
    const found = await lstat(path.join(folder, relative));
    if (!found.isSymbolicLink() && !found.isFile() && !found.isDirectory()) throw new Error(`${relative} is neither a file, a folder nor a link`);
    yield { relative, found };
    if (found.isDirectory()) yield* walk(folder, relative);
  }
}

/**
 * The map of a Mac app, with its chunk pack written to `pack`: each chunk once, in the order the app
 * first has it, packed on its own where that makes it smaller.
 */
export async function appMap(app, pack) {
  const out = createWriteStream(pack);
  const written = new Promise((resolve, reject) => out.on("finish", resolve).on("error", reject));
  const chunks = [];
  const numbers = new Map();
  let packed = 0;
  const root = path.basename(app);
  const files = [{ path: root, type: "dir", mode: (await stat(app)).mode & 0o777 }];
  for await (const { relative, found } of walk(path.dirname(app), root)) {
    const entry = { path: relative, mode: found.mode & 0o777 };
    if (found.isSymbolicLink()) files.push({ path: relative, type: "link", target: await readlink(path.join(path.dirname(app), relative)) });
    else if (found.isDirectory()) files.push({ ...entry, type: "dir" });
    else {
      const bytes = await readFile(path.join(path.dirname(app), relative));
      const list = [];
      const fresh = [];
      const cutter = chunker((chunk) => {
        let number = numbers.get(chunk.sha256);
        if (number === undefined) {
          const raw = bytes.subarray(chunk.offset, chunk.offset + chunk.size);
          const smaller = brotliCompressSync(raw, BROTLI);
          const stored = smaller.length < raw.length ? smaller : raw;
          fresh.push(stored);
          packed += stored.length;
          chunks.push(stored === raw ? [chunk.sha256, chunk.size] : [chunk.sha256, chunk.size, stored.length]);
          numbers.set(chunk.sha256, (number = chunks.length - 1));
        }
        list.push(number);
      });
      cutter.push(bytes);
      cutter.end();
      for (const stored of fresh) if (!out.write(stored)) await once(out, "drain");
      files.push({ ...entry, type: "file", size: bytes.length, sha512: createHash("sha512").update(bytes).digest("base64"), chunks: list });
    }
  }
  out.end();
  await written;
  return { format: 1, chunker: CHUNKER, source: { name: path.basename(pack), size: packed }, chunks, files };
}

/** The update info with `name` listed under `files:` (after the last item), or given its new sha512 and size where it is. */
export function withListedFile(yml, name, { sha512, size }) {
  if (listedFiles(yml).includes(name)) return withSignedFiles(yml, { [name]: { sha512, size } });
  const newline = yml.includes("\r\n") ? "\r\n" : "\n";
  const lines = yml.split(/\r?\n/);
  const start = lines.findIndex((line) => /^files:\s*$/.test(line));
  if (start < 0) throw new Error("The update info has no files: list");
  let end = start + 1;
  while (end < lines.length && (/^\s/.test(lines[end]) || lines[end] === "")) end++;
  while (end > start + 1 && lines[end - 1] === "") end--;
  lines.splice(end, 0, `  - url: ${name}`, `    sha512: ${sha512}`, `    size: ${size}`);
  return lines.join(newline);
}

/** Writes `map` to `folder` under `name`, read back as the app reads it, and lists it in the update info `yml`. */
async function publish(folder, yml, name, map) {
  const text = JSON.stringify(map);
  parseChunkMap(text);
  const file = path.join(folder, name);
  await writeFile(file, text);
  const info = path.join(folder, yml);
  await writeFile(info, withListedFile(await readFile(info, "utf8"), name, { sha512: await sha512Of(file), size: Buffer.byteLength(text) }));
}

/** Writes the maps for every update file in `folder` that a latest*.yml lists, and for every Mac app there. */
export async function chunkMapsIn(folder) {
  const ymls = (await readdir(folder)).filter((name) => /^latest.*\.yml$/.test(name));
  if (!ymls.length) throw new Error(`No latest*.yml in ${folder}`);
  for (const yml of ymls) {
    const text = await readFile(path.join(folder, yml), "utf8");
    for (const name of listedFiles(text).filter(isUpdateFile)) {
      const file = path.join(folder, name);
      if (!(await stat(file).catch(() => null))?.isFile()) continue;
      const map = await fileMap(file);
      // The map is of the very file the update info lists, signed and its sha512 written: writing that sha512 changes nothing.
      if (withSignedFiles(text, { [name]: { sha512: map.files[0].sha512 } }) !== text)
        throw new Error(`${yml} doesn't list ${name} as it is now: run scripts/update-info.mjs first`);
      await publish(folder, yml, chunkMapName(name), map);
      console.log(`  • chunk map  file=${name} chunks=${map.chunks.length}`);
    }
    if (yml !== "latest-mac.yml") continue;
    const version = /^version:\s*(.+)$/m.exec(text)?.[1].trim();
    if (!version) throw new Error(`${yml} has no version`);
    for (const [where, arch] of Object.entries(MAC_APPS)) {
      const apps = await readdir(path.join(folder, where)).catch(() => []);
      const app = apps.find((name) => name.endsWith(".app"));
      if (!app) continue;
      const named = macAppName(version, arch);
      const map = await appMap(path.join(folder, where, app), path.join(folder, chunkPackName(named)));
      await publish(folder, yml, chunkMapName(named), map);
      console.log(`  • chunk map  app=${where}/${app} files=${map.files.length} chunks=${map.chunks.length} pack=${map.source.size}`);
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const folder = process.argv[2];
  if (!folder) {
    console.error("usage: node scripts/chunk-maps.mjs <folder with the update files and latest*.yml>");
    process.exit(2);
  }
  chunkMapsIn(path.resolve(folder)).catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
