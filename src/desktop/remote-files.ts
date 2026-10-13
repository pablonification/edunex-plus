// Files from Edunex's storage read into memory for the window to show (a
// picture in a lecturer's note, a PDF in the viewer). No Electron here, so
// tests run it as it is; the handler plugs in the engine session's fetch, the
// file cache and the Student's offline copies. Only Edunex's storage, no
// cookies, a size cap, and the bytes must really be the kind asked for: the
// window gets them as data and never loads anything remote itself.
import type { FileProblem } from "../core/actions/files";
import { isStorageFile } from "../core/links";
import { EngineError } from "../engine/errors";
import type { FileCache } from "./file-cache";

/** The part of the Fetch API this needs: Electron's session.fetch in the app, the pretend storage in tests. */
export type FetchFile = (url: string, init: { signal: AbortSignal; credentials: "omit"; redirect: "error" }) => Promise<Response>;

export type ReadAs = "image" | "pdf";
export type ReadResult = { bytes: Uint8Array; type: string } | { problem: FileProblem };

const MB = 1024 * 1024;
/** The most read in, and how long the storage may go quiet before it counts as unreachable. */
export const LIMITS: Record<ReadAs, { bytes: number; quietMs: number }> = {
  image: { bytes: 20 * MB, quietMs: 30_000 },
  pdf: { bytes: 100 * MB, quietMs: 30_000 },
};

/** Where a file can come from besides the storage: copies already on this computer. */
export interface FileSources {
  fetch: FetchFile;
  /** Files read before (wiped at sign-out). */
  cache?: Pick<FileCache, "get" | "put" | "generation">;
  /** The Student's own copy, saved for offline reading. */
  offline?: (url: string) => Promise<Uint8Array | null>;
}

/** A copy on this computer first (one read before, or saved for offline), else Edunex's storage; whatever comes back is checked the same way. */
export async function readFile(sources: FileSources, url: string, as: ReadAs): Promise<ReadResult> {
  if (!isStorageFile(url)) throw new EngineError("Rejected", "Only Edunex's files are read into the app");
  // A sign-out any time after this wipes the cache; what this reads isn't kept then.
  const since = sources.cache?.generation();
  for (const local of [sources.cache?.get(url), sources.offline?.(url)]) {
    const bytes = await local?.catch(() => null);
    const type = bytes && bytes.byteLength <= LIMITS[as].bytes ? sniff(bytes, as) : null;
    if (bytes && type) return { bytes, type };
  }
  const result = await readRemoteFile(sources.fetch, url, as);
  if ("bytes" in result) await sources.cache?.put(url, result.bytes, since).catch(() => undefined);
  return result;
}

export async function readRemoteFile(fetch: FetchFile, url: string, as: ReadAs): Promise<ReadResult> {
  if (!isStorageFile(url)) throw new EngineError("Rejected", "Only Edunex's files are read into the app");
  const limit = LIMITS[as];
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const quiet = () => {
    clearTimeout(timer);
    timer = setTimeout(() => controller.abort(), limit.quietMs);
  };
  quiet();
  try {
    let response: Response;
    try {
      response = await fetch(url, { signal: controller.signal, credentials: "omit", redirect: "error" });
    } catch {
      return { problem: "unreachable" };
    }
    // Azure answers an expired or revoked storage link with 403.
    if (response.status === 401 || response.status === 403) return dropped(response, "expired");
    if (response.status === 404 || response.status === 410) return dropped(response, "missing");
    if (!response.ok) return dropped(response, "unreachable");
    if (!response.body) return { problem: "unreadable" };
    if (Number(response.headers.get("content-length")) > limit.bytes) return dropped(response, "too-big");
    let bytes: Uint8Array | null;
    try {
      bytes = await readUpTo(response.body, limit.bytes, quiet);
    } catch {
      return { problem: "unreachable" };
    }
    if (!bytes) return { problem: "too-big" };
    const type = sniff(bytes, as);
    return type ? { bytes, type } : { problem: "unreadable" };
  } finally {
    clearTimeout(timer);
  }
}

function dropped(response: Response, problem: FileProblem): ReadResult {
  void response.body?.cancel().catch(() => undefined);
  return { problem };
}

/** The whole body, or null as soon as it passes `max` bytes (whatever the server said its length was). */
async function readUpTo(body: ReadableStream<Uint8Array>, max: number, onData: () => void): Promise<Uint8Array | null> {
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    onData();
    size += value.byteLength;
    if (size > max) {
      await reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  return bytes;
}

const startsWith = (bytes: Uint8Array, signature: readonly number[], offset = 0) => signature.every((byte, i) => bytes[offset + i] === byte);
const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));
const PDF_HEADER = ascii("%PDF-");

/**
 * What the bytes are by their first bytes, never by what the server says:
 * for pictures, only formats a page shows without running anything; for a
 * PDF, its header (within the first kilobyte, where readers accept it).
 */
export function sniff(bytes: Uint8Array, as: ReadAs): string | null {
  if (as === "image") {
    if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
    if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
    if (startsWith(bytes, ascii("GIF87a")) || startsWith(bytes, ascii("GIF89a"))) return "image/gif";
    if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) return "image/webp";
    return null;
  }
  for (let at = 0; at <= Math.min(1024, bytes.length - PDF_HEADER.length); at++) if (startsWith(bytes, PDF_HEADER, at)) return "application/pdf";
  return null;
}
