// Updating by downloading only what changed (docs/adr/0008-download-only-what-changed.md). Next to
// each file the app updates from, the release has a chunk map (./chunks.ts, written by
// scripts/chunk-maps.mjs, listed with its sha512 in the latest*.yml). The app cuts the files it
// already has the same way, downloads only the chunks they don't hold (HTTP ranges, each chunk checked
// by its sha256 as it comes), and puts the new version together from both:
//
// - Windows: the installer that put this version in place (electron-builder keeps a copy of it, see
//   ./updater.ts), and the new installer's chunks, read from the new installer itself.
// - Linux: the AppImage running now, and the new AppImage's chunks, read from the new AppImage.
// - macOS: the app's own files, and the new app's chunks, from the release's chunk pack, where each is
//   packed on its own.
//
// What's put together is checked as strictly as a full download: the installer or AppImage by the
// sha512 its latest*.yml lists, the Mac app file by file by the sha512 its map lists (the map itself
// by the sha512 latest-mac.yml lists), then as an unpacked app is. When anything doesn't line up, or
// most of the file would be downloaded anyway, ./self-update.ts downloads the whole file instead.
import { createHash } from "node:crypto";
import fsp, { type FileHandle } from "node:fs/promises";
import path from "node:path";
import { brotliDecompressSync } from "node:zlib";
import { type ChunkMap, chunkMapName, chunkPackName, cutFile, macAppName, parseChunkMap } from "./chunks";
import { type Arch, isPlainFileName, isReleaseFileUrl, MismatchError, type ReleaseFile, sha512From, type UpdateKind } from "./self-update";

/** Merged into one range when no more than this lies between two missing chunks: one request fewer is worth that much. */
const GAP = 64 * 1024;
/** No range longer than this, so the downloads running at once share the work. */
const MAX_RANGE = 8 * 1024 * 1024;
const AT_ONCE = 4;
/** Downloading more than this share of the whole file, the whole file is simpler, and as quick. */
const WORTH_IT = 0.7;
/** A chunk map is small: about 250 kB for the Mac app. */
const MAX_MAP = 8 * 1024 * 1024;

/** How the release's files are read; ./updater.ts does it with Electron, the tests from memory. */
export interface PartialSource {
  /** A small release file, whole. */
  bytes(file: ReleaseFile): Promise<Buffer>;
  /**
   * Bytes `start` to `end` (not included) of a release file, handed to `onData` as they come; rejects
   * unless exactly those came. When `onData` throws, the download stops and it rejects with that.
   */
  range(file: ReleaseFile, start: number, end: number, onData: (data: Buffer) => void): Promise<void>;
}

export interface PartialUpdate {
  kind: UpdateKind;
  arch: Arch;
  version: string;
  /** The release's files, the file a full download would be, the latest*.yml listing it, and its sha512 there. */
  release: ReleaseFile[];
  file: ReleaseFile;
  yml: string;
  sha512: string;
  /** What this computer already has: the old installer, the AppImage, or the Mac app (a folder). */
  have: string;
  /** An empty folder to put the new version together in. */
  into: string;
  progress(share: number): void;
}

/** A stretch of the source to download: bytes `start` to `end`, chunks `first` to `last`. */
export interface Range {
  start: number;
  end: number;
  first: number;
  last: number;
}

/**
 * Puts the new version together in `update.into`: the path of the new file, or (macOS) of the folder
 * the new app is in, still to be checked as an unpacked one is. Null when the release has no map for
 * it, or most of it would be downloaded anyway. Throws when anything doesn't line up.
 */
export async function downloadPartial(update: PartialUpdate, source: PartialSource): Promise<string | null> {
  const named = chunkMapName(update.kind === "mac" ? macAppName(update.version, update.arch) : update.file.name);
  const listed = sha512From(update.yml, named);
  const mapFile = ownFile(update.release, named);
  if (!listed || !mapFile) return null;
  if (mapFile.size > MAX_MAP) throw new MismatchError(`${named} is too big`);
  const bytes = await source.bytes(mapFile);
  if (createHash("sha512").update(bytes).digest("base64") !== listed) throw new MismatchError(`${named} isn't the map the release lists`);
  const map = parseChunkMap(bytes.toString("utf8"));
  const from = mapSource(map, update);

  const have = await haveChunks(update.kind === "mac" ? await filesIn(update.have) : [update.have]);
  const plan = planDownload(map, (sha256) => have.has(sha256));
  if (plan.bytes > update.file.size * WORTH_IT) return null;

  const store = path.join(update.into, "chunks.part");
  const fetched = await fetchChunks(map, plan, from, source, store, update.progress);
  const reader = chunkReader();
  try {
    await assemble(map, update.into, async (index) => {
      const [sha256, size] = map.chunks[index];
      const at = fetched.get(index);
      const place = at === undefined ? have.get(sha256) : { file: store, offset: at };
      if (!place) throw new Error(`Chunk ${index} is neither here nor downloaded`);
      return reader.read(place.file, place.offset, size);
    });
  } finally {
    await reader.close();
  }
  await fsp.rm(store, { force: true });
  return update.kind === "mac" ? update.into : path.join(update.into, update.file.name);
}

/** A file on this app's own release, by its exact name. */
function ownFile(release: ReleaseFile[], name: string): ReleaseFile | null {
  return release.find((file) => file.name === name && isPlainFileName(file.name) && isReleaseFileUrl(file.url)) ?? null;
}

/**
 * The release file a map's chunks are read from, once the map is the one for this update: the very
 * file the latest*.yml lists (Windows, Linux), or the Mac app for this version and its pack.
 */
export function mapSource(map: ChunkMap, update: Pick<PartialUpdate, "kind" | "arch" | "version" | "release" | "file" | "sha512">): ReleaseFile {
  if (update.kind !== "mac") {
    const [only] = map.files;
    const same =
      map.files.length === 1 &&
      only.type === "file" &&
      only.path === update.file.name &&
      only.size === update.file.size &&
      only.sha512 === update.sha512 &&
      map.source.name === update.file.name &&
      map.source.size === update.file.size;
    if (!same) throw new MismatchError(`The chunk map isn't for ${update.file.name}`);
    return update.file;
  }
  const pack = ownFile(update.release, chunkPackName(macAppName(update.version, update.arch)));
  if (!pack || map.source.name !== pack.name || map.source.size !== pack.size) throw new MismatchError("The release has no chunk pack for this map");
  const [top, ...rest] = map.files;
  if (top.type !== "dir" || !top.path.endsWith(".app") || rest.some((entry) => !entry.path.startsWith(`${top.path}/`))) {
    throw new MismatchError("The chunk map isn't one app");
  }
  return pack;
}

/**
 * What to download: the chunks the files need that `have` lacks, as ranges of the source, chunks
 * that are neighbours (or nearly) in one range, and how many bytes that is.
 */
export function planDownload(map: ChunkMap, have: (sha256: string) => boolean): { missing: Set<number>; ranges: Range[]; bytes: number } {
  const needed = new Set<number>();
  for (const entry of map.files) if (entry.type === "file") for (const index of entry.chunks) needed.add(index);
  const missing = new Set<number>();
  const ranges: Range[] = [];
  let offset = 0;
  map.chunks.forEach(([sha256, size, packed], index) => {
    const end = offset + (packed ?? size);
    if (needed.has(index) && !have(sha256)) {
      missing.add(index);
      const last = ranges.at(-1);
      if (last && offset - last.end <= GAP && end - last.start <= MAX_RANGE) Object.assign(last, { end, last: index });
      else ranges.push({ start: offset, end, first: index, last: index });
    }
    offset = end;
  });
  return { missing, ranges, bytes: ranges.reduce((sum, range) => sum + range.end - range.start, 0) };
}

/** Each chunk the files already here hold, by its sha256: in which file, and where. */
async function haveChunks(files: string[]): Promise<Map<string, { file: string; offset: number }>> {
  const have = new Map<string, { file: string; offset: number }>();
  for (const file of files) {
    for (const chunk of await cutFile(file)) if (!have.has(chunk.sha256)) have.set(chunk.sha256, { file, offset: chunk.offset });
  }
  return have;
}

/** Every file in a folder and the folders in it, never through a link (a framework's Versions/Current would read it all twice). */
async function filesIn(folder: string): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await fsp.readdir(folder, { withFileTypes: true })) {
    const at = path.join(folder, entry.name);
    if (entry.isDirectory()) files.push(...(await filesIn(at)));
    else if (entry.isFile()) files.push(at);
  }
  return files;
}

/**
 * Downloads the missing chunks into `store`, a few ranges at a time, checking each chunk by its
 * sha256 as it comes; a range that fails is tried once more. Where each chunk is in `store`.
 */
async function fetchChunks(
  map: ChunkMap,
  plan: ReturnType<typeof planDownload>,
  from: ReleaseFile,
  source: PartialSource,
  store: string,
  progress: (share: number) => void,
): Promise<Map<number, number>> {
  const at = new Map<number, number>();
  let size = 0;
  for (const index of plan.missing) {
    at.set(index, size);
    size += map.chunks[index][1];
  }
  const out = await fsp.open(store, "w");
  let received = 0;
  // Only ever forward: a range tried again counts from its start, the bar doesn't.
  let shown = 0;
  async function one(range: Range): Promise<void> {
    let index = range.first;
    let pieces: Buffer[] = [];
    let buffered = 0;
    let writing: Promise<unknown> = Promise.resolve();
    let counted = 0;
    try {
      await source.range(from, range.start, range.end, (data) => {
        counted += data.length;
        received += data.length;
        if (received / plan.bytes > shown) progress((shown = received / plan.bytes));
        pieces.push(data);
        buffered += data.length;
        // Each chunk that has come whole: checked, and written where it goes in the store.
        for (let stored = storedSize(map, index); index <= range.last && buffered >= stored; stored = storedSize(map, index)) {
          const all = pieces.length === 1 ? pieces[0] : Buffer.concat(pieces);
          pieces = all.length > stored ? [all.subarray(stored)] : [];
          buffered -= stored;
          if (plan.missing.has(index)) {
            const chunk = unpacked(map, index, all.subarray(0, stored));
            const place = at.get(index) as number;
            writing = writing.then(() => out.write(chunk, 0, chunk.length, place));
          }
          index++;
        }
      });
    } catch (error) {
      // Tried again from the start: what came of it no longer counts.
      received -= counted;
      await writing.catch(() => undefined);
      throw error;
    }
    await writing;
    if (index !== range.last + 1 || buffered) throw new MismatchError(`Bytes ${range.start}-${range.end} of ${from.name} aren't the chunks the map lists`);
  }
  const queue = [...plan.ranges];
  const failed: unknown[] = [];
  async function worker(): Promise<void> {
    for (let range = queue.shift(); range && !failed.length; range = queue.shift()) {
      try {
        await one(range).catch((error) => {
          if (error instanceof MismatchError) throw error;
          return one(range);
        });
      } catch (error) {
        failed.push(error);
      }
    }
  }
  // Every download running has ended before this does, whatever happened: nothing writes to the store after.
  await Promise.all(Array.from({ length: Math.min(AT_ONCE, queue.length) }, worker));
  await out.close();
  if (failed.length) throw failed[0];
  return at;
}

const storedSize = (map: ChunkMap, index: number) => {
  const chunk = map.chunks[index];
  return chunk ? (chunk[2] ?? chunk[1]) : Number.POSITIVE_INFINITY;
};

/** A downloaded chunk as it is, unpacked when it was packed, and only if its sha256 is the map's. */
function unpacked(map: ChunkMap, index: number, stored: Buffer): Buffer {
  const [sha256, size, packed] = map.chunks[index];
  const bytes = packed === undefined ? Buffer.from(stored) : brotliDecompressSync(stored, { maxOutputLength: size });
  if (bytes.length !== size || createHash("sha256").update(bytes).digest("base64") !== sha256)
    throw new MismatchError(`Chunk ${index} isn't the one the map lists`);
  return bytes;
}

/** Reads chunks from files, keeping two open: the store, and the file of this computer's being read now (chunks mostly come from one in a row). */
function chunkReader() {
  const open = new Map<string, FileHandle>();
  return {
    async read(file: string, offset: number, size: number): Promise<Buffer> {
      let handle = open.get(file);
      if (handle) open.delete(file);
      else {
        // The one read longest ago is closed (a Map keeps the order they were set in).
        const oldest = open.size >= 2 ? [...open.keys()][0] : null;
        if (oldest) {
          await open.get(oldest)?.close();
          open.delete(oldest);
        }
        handle = await fsp.open(file, "r");
      }
      open.set(file, handle);
      const bytes = Buffer.alloc(size);
      const { bytesRead } = await handle.read(bytes, 0, size, offset);
      return bytes.subarray(0, bytesRead);
    },
    async close(): Promise<void> {
      const handles = [...open.values()];
      open.clear();
      await Promise.all(handles.map((handle) => handle.close()));
    },
  };
}

/**
 * Makes every folder, file and link of the map in `into`, in order, each file from its chunks
 * (`chunk` reads one), each chunk checked by its sha256 and each file by its sha512. Folders get their
 * mode last, so a read-only one is still filled first.
 */
export async function assemble(map: ChunkMap, into: string, chunk: (index: number) => Promise<Buffer>): Promise<void> {
  for (const entry of map.files) {
    const target = path.join(into, ...entry.path.split("/"));
    if (entry.type === "dir") await fsp.mkdir(target);
    else if (entry.type === "link") await fsp.symlink(entry.target, target);
    else {
      // "wx": a new file, never one that's there already (or a link to elsewhere).
      const out = await fsp.open(target, "wx");
      const sha512 = createHash("sha512");
      try {
        for (const index of entry.chunks) {
          const bytes = await chunk(index);
          const [sha256, size] = map.chunks[index];
          if (bytes.length !== size || createHash("sha256").update(bytes).digest("base64") !== sha256) {
            throw new MismatchError(`Chunk ${index} of ${entry.path} isn't the one the map lists`);
          }
          sha512.update(bytes);
          await out.write(bytes);
        }
      } finally {
        await out.close();
      }
      if (sha512.digest("base64") !== entry.sha512) throw new MismatchError(`${entry.path} isn't the file the map lists`);
      await fsp.chmod(target, entry.mode);
    }
  }
  for (const entry of [...map.files].reverse()) if (entry.type === "dir") await fsp.chmod(path.join(into, ...entry.path.split("/")), entry.mode);
}

/** Whether a 206 answer's Content-Range is exactly bytes `start` to `end` (not included) of a file of `size`. */
export function isRangeAnswer(header: string | undefined, start: number, end: number, size: number): boolean {
  return header === `bytes ${start}-${end - 1}/${size}`;
}
