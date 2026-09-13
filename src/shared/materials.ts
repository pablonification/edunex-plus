/**
 * Download contracts shared by main, preload, and renderer (#30).
 * Downloading is an explicit user action only (read-mostly API stance):
 * nothing in the sync tick or any background path ever downloads a file.
 * The listing itself is a cached feed and reads offline; the file bytes
 * always need the network.
 */

export interface MaterialDownloadRequest {
  /** File URL as listed in the cached material (absolute or vendor-relative). */
  fileUrl: string;
  /** Suggested file name from the cached material. */
  fileName: string;
}

export type MaterialDownloadResult =
  | { ok: true; filePath: string }
  | { ok: false; error: string; cancelled?: boolean };

export function isMaterialDownloadRequest(value: unknown): value is MaterialDownloadRequest {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.fileUrl === "string" && typeof record.fileName === "string";
}
