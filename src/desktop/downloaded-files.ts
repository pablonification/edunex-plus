// Files from Edunex the app downloaded for the Student ("Unduh"), so opening
// one again opens the copy already in Downloads instead of saving
// "Notes (2).docx" next to it. For each file it keeps where the copy went and
// its size and time when the download finished: a copy the Student deleted,
// moved or changed since, or one Edunex now has at another size (a lecturer's
// corrected upload), downloads again. One small record per file in the app's
// data folder, named by a hash of the file's address, so nothing about the
// files shows in a file name. Like the file cache, the records belong to the
// Student who downloaded: each names them, so another Student never opens
// their copy; signing out removes them (and a download still on its way isn't
// recorded after), another Student signing in empties them (files.ts), and
// with nobody signed in nothing is remembered.
// No Electron here, so tests run it as it is.
import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { z } from "zod";

export const DOWNLOADED_FILES_FOLDER = "downloaded-files";

export interface DownloadedFiles {
  /** Where the copy downloaded before is, while it's still there as it was; `sizeBytes`: Edunex's size for the file, when known. */
  find(url: string, sizeBytes?: number | null): Promise<string | null>;
  /** Remembers a finished download; `since`: generation() when it began, so a download that spanned a wipe isn't remembered. */
  record(url: string, file: string, since?: number): Promise<void>;
  /** Counts the wipes so far. */
  generation(): number;
  clear(): Promise<void>;
}

const Download = z.object({ owner: z.string().nullable(), file: z.string(), size: z.number(), modifiedMs: z.number() });

/**
 * What names a file on Edunex's storage. Azure's address carries a signature
 * after "?" that can be signed again while the file stays the same, so there
 * the address without it; elsewhere the whole address.
 */
function fileKey(url: string): string {
  const parsed = new URL(url);
  return parsed.hostname.endsWith(".blob.core.windows.net") ? `${parsed.origin}${parsed.pathname}` : parsed.href;
}

/** `owner`: who is signed in (their NIM), or null when nobody is; without it, the records aren't tied to anyone. */
export function createDownloadedFiles(folder: string, options: { owner?: () => string | null } = {}): DownloadedFiles {
  const recordOf = (url: string) => path.join(folder, createHash("sha256").update(fileKey(url)).digest("hex"));
  /** Who is signed in: null when nobody is, and then nothing is found or remembered. */
  const owner = () => options.owner?.();
  let generation = 0;

  return {
    async find(url, sizeBytes) {
      const who = owner();
      if (who === null) return null;
      const record = await fs
        .readFile(recordOf(url), "utf8")
        .then((json) => Download.parse(JSON.parse(json)))
        .catch(() => null);
      // Another Student's download: never theirs to open, even before the records are emptied.
      if (!record || record.owner !== (who ?? null)) return null;
      const stat = await fs.stat(record.file).catch(() => null);
      const unchanged = stat?.isFile() && stat.size === record.size && stat.mtimeMs === record.modifiedMs;
      // Edunex has it at another size: the lecturer uploaded a corrected file.
      if (!unchanged || (sizeBytes != null && sizeBytes !== record.size)) return null;
      return record.file;
    },
    async record(url, file, since = generation) {
      const who = owner();
      if (since !== generation || who === null) return;
      const stat = await fs.stat(file);
      await fs.mkdir(folder, { recursive: true, mode: 0o700 });
      const target = recordOf(url);
      // Written whole, then moved into place: a crash never leaves half a record under the real name.
      const temp = `${target}.${process.pid}.tmp`;
      try {
        await fs.writeFile(temp, JSON.stringify({ owner: who ?? null, file, size: stat.size, modifiedMs: stat.mtimeMs }), { mode: 0o600 });
        await fs.rename(temp, target);
      } catch (error) {
        await fs.rm(temp, { force: true });
        throw error;
      }
      // Wiped while this was being written (a sign-out): nothing it wrote may stay.
      if (since !== generation) await fs.rm(folder, { recursive: true, force: true });
    },
    generation: () => generation,
    async clear() {
      generation += 1;
      await fs.rm(folder, { recursive: true, force: true });
    },
  };
}
