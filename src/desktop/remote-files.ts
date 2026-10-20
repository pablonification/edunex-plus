// Files from Edunex's storage read into memory for the window to show (a
// picture in a lecturer's note; a PDF, Word document, spreadsheet, PowerPoint
// slides, text file or old Office file in the viewer). No Electron here, so
// tests run it as it is; the handler plugs in the engine session's fetch, the
// file cache and the Student's offline copies. Only Edunex's storage, no
// cookies, a size cap for each kind, and the bytes must really be the kind
// asked for: the window gets them as data and never loads anything remote
// itself.
import type { FileProblem, ReadAs } from "../core/actions/files";
import { readCompoundFile } from "../core/compound-file";
import { isStorageFile } from "../core/links";
import { EngineError } from "../engine/errors";
import type { FileCache } from "./file-cache";

/** The part of the Fetch API this needs: Electron's session.fetch in the app, the pretend storage in tests. */
export type FetchFile = (url: string, init: { signal: AbortSignal; credentials: "omit"; redirect: "error" }) => Promise<Response>;

export type ReadResult = { bytes: Uint8Array; type: string } | { problem: FileProblem };

const MB = 1024 * 1024;
/** The most read in, and how long the storage may go quiet before it counts as unreachable. */
export const LIMITS: Record<ReadAs, { bytes: number; quietMs: number }> = {
  image: { bytes: 20 * MB, quietMs: 30_000 },
  pdf: { bytes: 100 * MB, quietMs: 30_000 },
  docx: { bytes: 50 * MB, quietMs: 30_000 },
  xlsx: { bytes: 20 * MB, quietMs: 30_000 },
  pptx: { bytes: 100 * MB, quietMs: 30_000 },
  text: { bytes: 5 * MB, quietMs: 30_000 },
  doc: { bytes: 50 * MB, quietMs: 30_000 },
  xls: { bytes: 20 * MB, quietMs: 30_000 },
  ppt: { bytes: 100 * MB, quietMs: 30_000 },
};
/** The most a Word document, workbook or presentation may unpack to: the window unpacks it whole to show it. */
export const UNPACKED_MAX = 200 * MB;

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

/** A Word document, an Excel workbook and a PowerPoint presentation are ZIPs holding these parts. */
const OFFICE_PARTS = {
  docx: { part: "word/document.xml", type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
  xlsx: { part: "xl/workbook.xml", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" },
  pptx: { part: "ppt/presentation.xml", type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
} as const;

/** An old Word, Excel (97 and later, not 95's "Book") or PowerPoint file is a compound file holding this stream. */
const COMPOUND_STREAMS = {
  doc: { stream: "WordDocument", type: "application/msword" },
  xls: { stream: "Workbook", type: "application/vnd.ms-excel" },
  ppt: { stream: "PowerPoint Document", type: "application/vnd.ms-powerpoint" },
} as const;

/**
 * Edunex keeps an upload under a link without its extension, and its label
 * for one can name the other generation of the same app (a .pptx labelled
 * "ppt"), so the name the app gives it can too: a Word, Excel or PowerPoint
 * file asked for as one generation is taken as the other as well, and checked
 * as that one. Never as another app's.
 */
const OTHER_GENERATION: Partial<Record<ReadAs, ReadAs>> = { doc: "docx", docx: "doc", xls: "xlsx", xlsx: "xls", ppt: "pptx", pptx: "ppt" };

/**
 * What the bytes are, never by what the server says: for pictures, by their
 * first bytes, and only formats a page shows without running anything; for a
 * PDF, its header (within the first kilobyte, where readers accept it); a Word
 * document, workbook or presentation is a whole ZIP with its main part
 * inside, unpacking to no more than UNPACKED_MAX; an old Word, Excel or
 * PowerPoint file is a compound file with its main stream at its root (either
 * generation for either name, OTHER_GENERATION); text is valid UTF-8 with no
 * control characters but tabs and line breaks (which binary files have).
 */
export function sniff(bytes: Uint8Array, as: ReadAs): string | null {
  const other = OTHER_GENERATION[as];
  return sniffAs(bytes, as) ?? (other ? sniffAs(bytes, other) : null);
}

function sniffAs(bytes: Uint8Array, as: ReadAs): string | null {
  if (as === "image") {
    if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
    if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
    if (startsWith(bytes, ascii("GIF87a")) || startsWith(bytes, ascii("GIF89a"))) return "image/gif";
    if (startsWith(bytes, ascii("RIFF")) && startsWith(bytes, ascii("WEBP"), 8)) return "image/webp";
    return null;
  }
  if (as === "docx" || as === "xlsx" || as === "pptx") {
    const zip = zipContents(bytes);
    const { part, type } = OFFICE_PARTS[as];
    return zip?.names.has("[Content_Types].xml") && zip.names.has(part) && zip.unpacked <= UNPACKED_MAX ? type : null;
  }
  if (as === "doc" || as === "xls" || as === "ppt") return hasStream(bytes, COMPOUND_STREAMS[as].stream) ? COMPOUND_STREAMS[as].type : null;
  if (as === "text") return isText(bytes) ? "text/plain" : null;
  for (let at = 0; at <= Math.min(1024, bytes.length - PDF_HEADER.length); at++) if (startsWith(bytes, PDF_HEADER, at)) return "application/pdf";
  return null;
}

/** Whether the bytes are a compound file with this stream at its root; a broken or hostile one isn't. */
function hasStream(bytes: Uint8Array, name: string): boolean {
  try {
    return readCompoundFile(bytes).has(name);
  } catch {
    return false;
  }
}

/** Anything below a space but tab, line feed, form feed and carriage return, and DEL. */
const CONTROL = /[\u0000-\u0008\u000b\u000e-\u001f\u007f]/;

function isText(bytes: Uint8Array): boolean {
  try {
    return !CONTROL.test(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    return false;
  }
}

/**
 * The names of the files in a ZIP and what they unpack to together, from its
 * central directory (the list at its end); null when it isn't a ZIP, is cut
 * short, or is a ZIP64 (over 4 GB, far past any limit here).
 */
export function zipContents(bytes: Uint8Array): { names: Set<string>; unpacked: number } | null {
  if (!startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) || bytes.length < 22) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  // The record that ends it is its last 22 bytes, or up to 64 kB earlier when the ZIP has a comment.
  for (let end = bytes.length - 22; end >= Math.max(0, bytes.length - 22 - 0xffff); end--) {
    if (view.getUint32(end, true) !== 0x06054b50) continue;
    const count = view.getUint16(end + 10, true);
    let at = view.getUint32(end + 16, true);
    const names = new Set<string>();
    let unpacked = 0;
    for (let i = 0; i < count; i++) {
      if (at + 46 > bytes.length || view.getUint32(at, true) !== 0x02014b50) return null;
      const nameLength = view.getUint16(at + 28, true);
      if (at + 46 + nameLength > bytes.length) return null;
      unpacked += view.getUint32(at + 24, true);
      names.add(new TextDecoder().decode(bytes.subarray(at + 46, at + 46 + nameLength)));
      at += 46 + nameLength + view.getUint16(at + 30, true) + view.getUint16(at + 32, true);
    }
    return { names, unpacked };
  }
  return null;
}
