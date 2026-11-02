// How an update is cut into chunks, the same at release time (scripts/chunk-maps.mjs writes each
// release file's chunk map) and in the app (./partial-update.ts cuts the files this computer already
// has), so both cut the same bytes at the same places and an update downloads only the chunks the
// computer lacks (docs/adr/0008-download-only-what-changed.md).
//
// Where a chunk ends depends only on the bytes just before it (a rolling "gear" hash, as FastCDC
// cuts), not on where they are in the file: bytes added or taken out in one place change the chunks
// there, and every other chunk stays as it was, wherever it moved to.
//
// Node's own modules and zod only, and only TypeScript Node can strip without a build (no enums, no
// constructor parameter properties): the script loads this file as it is.
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import path from "node:path";
import { z } from "zod";

/** The chunker's name, in every chunk map: a map cut any other way is never used. A new name with any change below. */
export const CHUNKER = "gear-16k-64k-256k";
const MIN = 16 * 1024;
const AVERAGE = 64 * 1024;
const MAX = 256 * 1024;
// Before the average size a cut needs two more of the hash's top bits at zero, after it two fewer,
// so chunk sizes bunch around the average (FastCDC's "normalized chunking").
const STRICT = 0xffffc000 | 0;
const LOOSE = 0xfffc0000 | 0;

/** One number per byte value, from sha256: fixed forever, or no map made before would cut the same. */
const GEAR = Int32Array.from({ length: 256 }, (_, byte) => createHash("sha256").update(`edunex-plus gear ${byte}`).digest().readInt32LE(0));

/** A chunk: where it starts, its size, and its bytes' sha256 (base64). */
export interface Chunk {
  offset: number;
  size: number;
  sha256: string;
}

/** Cuts bytes into chunks as they come: `push` each piece in order, then `end`. */
export function chunker(onChunk: (chunk: Chunk) => void) {
  let offset = 0;
  let size = 0;
  let fingerprint = 0;
  let hash = createHash("sha256");
  const cut = () => {
    onChunk({ offset, size, sha256: hash.digest("base64") });
    offset += size;
    size = 0;
    fingerprint = 0;
    hash = createHash("sha256");
  };
  return {
    push(data: Uint8Array) {
      // Where the chunk being cut starts in this piece.
      let start = 0;
      for (let i = 0; i < data.length; ) {
        // The first bytes of a chunk are never a cut, so they're skipped, not hashed.
        if (size < MIN) {
          const skip = Math.min(MIN - size, data.length - i);
          size += skip;
          i += skip;
          continue;
        }
        const until = Math.min(data.length, i + MAX - size);
        let at = -1;
        for (; i < until; i++) {
          fingerprint = ((fingerprint << 1) + GEAR[data[i]]) | 0;
          size++;
          if ((fingerprint & (size <= AVERAGE ? STRICT : LOOSE)) === 0 || size === MAX) {
            at = i;
            break;
          }
        }
        // The piece ended first: the chunk goes on in the next one.
        if (at < 0) break;
        hash.update(data.subarray(start, at + 1));
        cut();
        start = i = at + 1;
      }
      if (start < data.length) hash.update(data.subarray(start));
    },
    end() {
      if (size) cut();
    },
  };
}

/**
 * Every chunk of a file on disk, read a piece at a time: the main process stays free in between. `read`
 * opens it (the app passes original-fs's, so an app.asar is read as the file it is).
 */
export async function cutFile(file: string, read: typeof createReadStream = createReadStream): Promise<Chunk[]> {
  const chunks: Chunk[] = [];
  const cutter = chunker((chunk) => chunks.push(chunk));
  for await (const piece of read(file, { highWaterMark: 1024 * 1024 })) cutter.push(piece as Buffer);
  cutter.end();
  return chunks;
}

/** A release file's chunk map, and the Mac app's (its chunk pack beside it), as published on the release. */
export const chunkMapName = (of: string) => `${of}.chunks.json`;
export const chunkPackName = (of: string) => `${of}.chunks.pack`;
/** What the Mac app's map and pack are named after: the app for one kind of Mac at one version. */
export const macAppName = (version: string, arch: string) => `Edunex-Plus-${version}-${arch}-mac.app`;

const SHA256 = /^[A-Za-z0-9+/]{43}=$/;
const SHA512 = /^[A-Za-z0-9+/]{86}==$/;
const count = z.number().int().nonnegative();
/** A path inside what's put together: plain names joined by "/", none of them "." or "..". */
const relative = z
  .string()
  .max(1024)
  .refine((value) => value.split("/").every((part) => part !== "" && part !== "." && part !== ".." && !/[\\\0]/.test(part)));

/**
 * A chunk map (format 1). `source` is the release file the chunks are read from: the release file
 * itself (Windows, Linux) or the Mac app's chunk pack. `chunks` are in the order they are in it, each
 * [sha256, size] as it is, or [sha256, size, packed] when it's stored packed smaller (brotli).
 * `files` is what's put together from them, in order: one release file, or every folder, file and
 * link in the Mac app, a folder before what's in it. A file is the list of its chunks, by number.
 */
const ChunkMapShape = z.object({
  format: z.literal(1),
  chunker: z.literal(CHUNKER),
  source: z.object({ name: z.string(), size: count }),
  chunks: z.array(z.tuple([z.string().regex(SHA256), count.min(1).max(MAX), count.min(1).optional()])).max(1_000_000),
  files: z
    .array(
      z.discriminatedUnion("type", [
        z.object({
          path: relative,
          type: z.literal("file"),
          mode: count.max(0o777),
          size: count,
          sha512: z.string().regex(SHA512),
          chunks: z.array(count),
        }),
        z.object({ path: relative, type: z.literal("dir"), mode: count.max(0o777) }),
        z.object({ path: relative, type: z.literal("link"), target: z.string().min(1).max(1024) }),
      ]),
    )
    .min(1)
    .max(100_000),
});
export type ChunkMap = z.infer<typeof ChunkMapShape>;

/** Never put more than this together from one map. */
const MAX_TOTAL = 4 * 1024 ** 3;

/**
 * A chunk map as published, checked to add up: chunks that fill their source exactly, files the
 * size of their chunks, each path once and inside a folder the map makes first (never through a
 * link), and links that stay inside what's put together. Throws when anything doesn't.
 */
export function parseChunkMap(text: string): ChunkMap {
  const map = ChunkMapShape.parse(JSON.parse(text));
  const stored = map.chunks.reduce((sum, [, size, packed]) => {
    if (packed !== undefined && packed >= size) throw new Error("A packed chunk isn't smaller");
    return sum + (packed ?? size);
  }, 0);
  if (stored !== map.source.size) throw new Error(`The chunks fill ${stored} bytes of ${map.source.name}, not ${map.source.size}`);
  const kinds = new Map<string, string>();
  let total = 0;
  for (const entry of map.files) {
    const parent = path.posix.dirname(entry.path);
    if (kinds.has(entry.path)) throw new Error(`${entry.path} is in the map twice`);
    if (parent !== "." && kinds.get(parent) !== "dir") throw new Error(`${entry.path} isn't in a folder the map makes first`);
    kinds.set(entry.path, entry.type);
    if (entry.type === "link") {
      const to = path.posix.normalize(path.posix.join(parent, entry.target));
      if (entry.target.startsWith("/") || to === ".." || to.startsWith("../") || entry.target.includes("\0")) throw new Error(`${entry.path} links outside`);
    } else if (entry.type === "file") {
      let size = 0;
      for (const index of entry.chunks) {
        const chunk = map.chunks[index];
        if (!chunk) throw new Error(`${entry.path} names a chunk the map doesn't have`);
        size += chunk[1];
      }
      if (size !== entry.size) throw new Error(`${entry.path}'s chunks add up to ${size} bytes, not ${entry.size}`);
      if ((total += size) > MAX_TOTAL) throw new Error("The map puts together too much");
    }
  }
  return map;
}
