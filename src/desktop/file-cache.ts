// Files from Edunex the window showed (PDFs, pictures), kept in the app's data
// folder so opening one again is instant and works offline. Named by a hash
// of their address, so nothing about them shows in a file name; the oldest go
// once they pass a size, and signing out removes the whole folder (traces.ts).
// No Electron here, so tests run it as it is.
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

export const FILE_CACHE_FOLDER = "file-cache";
const DEFAULT_MAX_BYTES = 300 * 1024 * 1024;

export interface FileCache {
  get(url: string): Promise<Uint8Array | null>;
  put(url: string, bytes: Uint8Array): Promise<void>;
  clear(): Promise<void>;
}

export function createFileCache(folder: string, maxBytes = DEFAULT_MAX_BYTES): FileCache {
  const fileOf = (url: string) => path.join(folder, createHash("sha256").update(url).digest("hex"));

  /** Removes the least recently used files until the rest fit. */
  async function trim(): Promise<void> {
    const names = await fs.readdir(folder).catch(() => [] as string[]);
    const files = (
      await Promise.all(
        names
          .filter((name) => /^[0-9a-f]{64}$/.test(name))
          .map(async (name) => {
            const file = path.join(folder, name);
            const stat = await fs.stat(file).catch(() => null);
            return stat ? { file, size: stat.size, used: stat.mtimeMs } : null;
          }),
      )
    ).filter((entry) => entry !== null);
    let total = files.reduce((sum, entry) => sum + entry.size, 0);
    for (const entry of files.sort((a, b) => a.used - b.used)) {
      if (total <= maxBytes) break;
      await fs.rm(entry.file, { force: true });
      total -= entry.size;
    }
  }

  return {
    async get(url) {
      const file = fileOf(url);
      try {
        const bytes = new Uint8Array(await fs.readFile(file));
        // Opened again: the newest to keep.
        const now = new Date();
        await fs.utimes(file, now, now).catch(() => undefined);
        return bytes;
      } catch {
        return null;
      }
    },
    async put(url, bytes) {
      if (bytes.byteLength > maxBytes) return;
      await fs.mkdir(folder, { recursive: true });
      const file = fileOf(url);
      // Written whole, then moved into place: a crash never leaves half a file under the real name.
      const temp = `${file}.${process.pid}.tmp`;
      await fs.writeFile(temp, bytes);
      await fs.rename(temp, file);
      await trim();
    },
    async clear() {
      await fs.rm(folder, { recursive: true, force: true });
    },
  };
}
