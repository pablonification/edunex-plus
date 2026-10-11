// The engine's disk: one file per key under the app's data folder, readable
// only by this user. Every write goes to a temporary file first and is then
// renamed over the old one, so a crash mid-write leaves the old value.
import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Storage } from "../engine/store/storage";

const KEY = /^[a-z0-9][a-z0-9._-]*(\/[a-z0-9][a-z0-9._-]*)*$/i;

export class FileStorage implements Storage {
  private readonly queues = new Map<string, Promise<void>>();

  constructor(readonly root: string) {}

  async read(key: string): Promise<string | null> {
    try {
      return await fs.readFile(this.file(key), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  write(key: string, text: string): Promise<void> {
    return this.inOrder(key, async () => {
      const file = this.file(key);
      await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
      const temp = `${file}.${randomBytes(6).toString("hex")}.tmp`;
      await fs.writeFile(temp, text, { mode: 0o600 });
      try {
        await renameWithRetry(temp, file);
      } catch (error) {
        await fs.rm(temp, { force: true });
        throw error;
      }
    });
  }

  remove(key: string): Promise<void> {
    return this.inOrder(key, () => fs.rm(this.file(key), { force: true }));
  }

  async list(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    const walk = async (dir: string, relative: string): Promise<void> => {
      let entries;
      try {
        entries = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (entry.name.endsWith(".tmp")) continue;
        const key = relative ? `${relative}/${entry.name}` : entry.name;
        if (entry.isDirectory()) await walk(path.join(dir, entry.name), key);
        else if (key.startsWith(prefix)) keys.push(key);
      }
    };
    await walk(this.root, "");
    return keys.sort();
  }

  private file(key: string): string {
    if (!KEY.test(key) || key.split("/").includes("..")) throw new Error(`Not a storage key: ${key}`);
    return path.join(this.root, ...key.split("/"));
  }

  /** Changes to one key happen in the order they were asked for, so an older value never lands last. */
  private inOrder(key: string, work: () => Promise<void>): Promise<void> {
    const next = (this.queues.get(key) ?? Promise.resolve()).catch(() => undefined).then(work);
    this.queues.set(key, next);
    void next
      .finally(() => {
        if (this.queues.get(key) === next) this.queues.delete(key);
      })
      .catch(() => undefined);
    return next;
  }
}

/** Windows can briefly lock a file (antivirus, indexer); try again a few times. */
async function renameWithRetry(from: string, to: string): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await fs.rename(from, to);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (attempt >= 4 || (code !== "EPERM" && code !== "EBUSY" && code !== "EACCES")) throw error;
      await new Promise((resolve) => setTimeout(resolve, 25 * 2 ** attempt));
    }
  }
}
