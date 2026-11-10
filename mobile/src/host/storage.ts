// The engine's disk on the phone: one file per key under the app's own documents folder (no
// other app can read it). Every write goes to a temporary file first and is then moved over
// the old one, so a crash mid-write leaves the old value; stray temporary files are skipped
// and swept a little after the next start (not before its first frame). The desktop's twin is
// src/desktop/storage.ts.
import { Directory, File, Paths } from "expo-file-system";
import type { Storage } from "../../../src/engine/store/storage";

const KEY = /^[a-z0-9][a-z0-9._-]*(\/[a-z0-9][a-z0-9._-]*)*$/i;
const TEMP = ".tmp";
/** How long after the start stray temporary files are swept: well after the first frame. */
const SWEEP_AFTER_MS = 10_000;

export class PhoneStorage implements Storage {
  private readonly queues = new Map<string, Promise<void>>();
  private readonly root: Directory;

  constructor(folder = "engine") {
    this.root = new Directory(Paths.document, folder);
    if (!this.root.exists) this.root.create({ intermediates: true });
    const root = this.root;
    // A write makes its temporary file and moves it in one go on this thread, so a sweep never meets one mid-write.
    setTimeout(() => {
      if (root.exists) sweep(root);
    }, SWEEP_AFTER_MS);
  }

  async read(key: string): Promise<string | null> {
    const file = this.file(key);
    return file.exists ? file.text() : null;
  }

  write(key: string, text: string): Promise<void> {
    return this.inOrder(key, async () => {
      const file = this.file(key);
      const parent = file.parentDirectory;
      if (!parent.exists) parent.create({ intermediates: true });
      const temp = new File(parent, `${file.name}.${Math.random().toString(36).slice(2, 10)}${TEMP}`);
      try {
        // writeSync makes the file; write() is async in SDK 58 and would race the move.
        temp.writeSync(text);
        temp.moveSync(file, { overwrite: true });
      } catch (error) {
        if (temp.exists) temp.delete();
        throw error;
      }
    });
  }

  remove(key: string): Promise<void> {
    return this.inOrder(key, async () => {
      const file = this.file(key);
      if (file.exists) file.delete();
    });
  }

  /** Only the folder `prefix` names is walked ("datasets/": that folder, not every file the engine keeps). */
  async list(prefix: string): Promise<string[]> {
    const keys: string[] = [];
    const folder = prefix.slice(0, prefix.lastIndexOf("/") + 1).replace(/\/$/, "");
    const walk = (dir: Directory, relative: string) => {
      for (const entry of dir.list()) {
        if (entry.name.endsWith(TEMP)) continue;
        const key = relative ? `${relative}/${entry.name}` : entry.name;
        if (entry instanceof Directory) walk(entry, key);
        else if (key.startsWith(prefix)) keys.push(key);
      }
    };
    const start = folder ? new Directory(this.root, ...folder.split("/")) : this.root;
    if (start.exists) walk(start, folder);
    return keys.sort();
  }

  /** Every key the engine ever wrote, gone: signing out of everything. */
  clear(): void {
    if (this.root.exists) this.root.delete();
    this.root.create({ intermediates: true });
  }

  private file(key: string): File {
    if (!KEY.test(key)) throw new Error(`Bad storage key: ${key}`);
    return new File(this.root, ...key.split("/"));
  }

  /** Writes to one key happen one at a time, in the order asked. */
  private inOrder(key: string, run: () => Promise<void>): Promise<void> {
    const before = this.queues.get(key) ?? Promise.resolve();
    const next = before.catch(() => undefined).then(run);
    this.queues.set(key, next);
    void next.finally(() => {
      if (this.queues.get(key) === next) this.queues.delete(key);
    });
    return next;
  }
}

function sweep(dir: Directory): void {
  for (const entry of dir.list()) {
    if (entry instanceof Directory) sweep(entry);
    else if (entry.name.endsWith(TEMP)) entry.delete();
  }
}
