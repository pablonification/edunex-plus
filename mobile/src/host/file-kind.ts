// What kind of file a download is, so Android can open it (W1 in PROGRESS.md). Edunex names a
// material by the lecturer's title and a rough type ("pdf", "file", "video"); its storage link often
// has no extension. A file saved as "Slide Pengantar" has no type, and Android then has no app to
// open it with. So the kind is asked of the file itself: the title's own extension, then the
// name the server gave it (Content-Disposition, or its Content-Type), then its first bytes.

/** The extensions the phone opens, and the type Android's apps register for each. */
const TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".odt": "application/vnd.oasis.opendocument.text",
  ".ods": "application/vnd.oasis.opendocument.spreadsheet",
  ".odp": "application/vnd.oasis.opendocument.presentation",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".rtf": "application/rtf",
  ".zip": "application/zip",
  ".rar": "application/vnd.rar",
  ".7z": "application/x-7z-compressed",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
  ".ipynb": "application/x-ipynb+json",
};

/** The type to open a file of this extension with; null when the phone doesn't know it. */
export function typeOf(name: string): string | null {
  return TYPES[extensionOf(name) ?? ""] ?? null;
}

/** ".pdf" of "Notes.PDF"; null when the name has none the phone knows. */
export function extensionOf(name: string): string | null {
  const ext = /\.[a-z0-9]{1,5}$/i.exec(name.trim())?.[0]?.toLowerCase();
  return ext && ext in TYPES ? ext : null;
}

const BY_TYPE = Object.fromEntries(Object.entries(TYPES).map(([ext, type]) => [type, ext]));

/** The extension a server's Content-Type names ("application/pdf; charset=…" → ".pdf"); null for a vague one. */
export function extensionOfType(contentType: string | null | undefined): string | null {
  const type = contentType?.split(";")[0]?.trim().toLowerCase();
  if (!type || type === "application/octet-stream" || type === "binary/octet-stream") return null;
  return BY_TYPE[type] ?? (type === "image/jpg" ? ".jpg" : null);
}

const starts = (head: Uint8Array, bytes: readonly number[], at = 0) => bytes.every((byte, i) => head[at + i] === byte);
const ascii = (head: Uint8Array) => String.fromCharCode(...head.subarray(0, Math.min(head.length, 4096)));

/**
 * The extension the file's first bytes say (up to 4 KB of them): a PDF, an Office document (a ZIP whose parts are
 * named word/, xl/ or ppt/), a plain ZIP, a picture, a video, a sound. Null when they say nothing the phone knows.
 */
export function extensionOfBytes(head: Uint8Array): string | null {
  if (starts(head, [0x25, 0x50, 0x44, 0x46])) return ".pdf";
  if (starts(head, [0x50, 0x4b, 0x03, 0x04])) {
    const text = ascii(head);
    if (text.includes("word/")) return ".docx";
    if (text.includes("xl/")) return ".xlsx";
    if (text.includes("ppt/")) return ".pptx";
    if (text.includes("mimetypeapplication/vnd.oasis.opendocument.text")) return ".odt";
    return ".zip";
  }
  if (starts(head, [0x89, 0x50, 0x4e, 0x47])) return ".png";
  if (starts(head, [0xff, 0xd8, 0xff])) return ".jpg";
  if (starts(head, [0x47, 0x49, 0x46, 0x38])) return ".gif";
  if (starts(head, [0x52, 0x49, 0x46, 0x46]) && starts(head, [0x57, 0x45, 0x42, 0x50], 8)) return ".webp";
  if (starts(head, [0x52, 0x49, 0x46, 0x46]) && starts(head, [0x57, 0x41, 0x56, 0x45], 8)) return ".wav";
  if (starts(head, [0x66, 0x74, 0x79, 0x70], 4)) return ascii(head.subarray(8, 12)).startsWith("M4A") ? ".m4a" : ".mp4";
  if (starts(head, [0x49, 0x44, 0x33])) return ".mp3";
  if (starts(head, [0x52, 0x61, 0x72, 0x21])) return ".rar";
  if (starts(head, [0x37, 0x7a, 0xbc, 0xaf])) return ".7z";
  return null;
}

/**
 * The name to keep a download under: the lecturer's title, with the first extension that's known of the title
 * itself, the name the server gave (`serverName`, from its Content-Disposition), the server's Content-Type, then the
 * file's first bytes. Without any, the title as it is.
 */
export function downloadName(title: string, from: { serverName?: string | null; contentType?: string | null; head?: Uint8Array | null }): string {
  const own = extensionOf(title);
  if (own) return title;
  const ext = (from.serverName ? extensionOf(from.serverName) : null) ?? extensionOfType(from.contentType) ?? (from.head ? extensionOfBytes(from.head) : null);
  return ext ? `${title}${ext}` : title;
}
