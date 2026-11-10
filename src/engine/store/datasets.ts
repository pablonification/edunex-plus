// The engine's memory: every dataset as { value, fetchedAt, hash }, saved to
// disk, and announced to the screens only when its content really changed.
import type { DatasetPayload, Event } from "../../core/contract";
import { type DatasetName, Datasets, type DatasetValue } from "../../core/models";
import type { Storage } from "./storage";

const FORMAT = 1;
const keyOf = (name: string) => `datasets/${name}.json`;

/**
 * Same content, same hash: object keys are sorted first. Cheap enough for a phone's JS thread, where it runs on
 * every read of every page: the sorted text comes from the JSON writer itself (handed every key, sorted, it writes
 * each object's keys in that order), and the hash is a 53-bit one over that text (cyrb53), not a cryptographic one.
 * It tells content apart; nothing relies on it being hard to forge.
 */
export function hashOf(value: unknown): string {
  const keys = new Set<string>();
  const collect = (v: unknown): void => {
    if (Array.isArray(v)) for (const item of v) collect(item);
    else if (v && typeof v === "object")
      for (const key in v) {
        keys.add(key);
        collect((v as Record<string, unknown>)[key]);
      }
  };
  collect(value);
  const text = JSON.stringify(value, [...keys].sort()) ?? "undefined";
  return `${text.length.toString(36)}-${cyrb53(text)}`;
}

/** cyrb53 (bryc's public-domain string hash): 53 well-mixed bits, as a base-36 string. */
function cyrb53(text: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export class DatasetStore {
  private readonly sets = new Map<string, DatasetPayload>();
  /** Datasets loaded from a file saved under other shapes (or none) and checked against this build's: stamped later. */
  private readonly unstamped = new Set<string>();

  /**
   * `shapes`: this build's stamp of the datasets' schemas (EngineDeps.shapes). Every file is saved with it, and a file
   * saved with the same stamp loads without its schema being checked again: it was written by this very build.
   */
  constructor(
    private readonly storage: Storage,
    private readonly emit: (event: Event) => void,
    private readonly shapes?: string,
  ) {}

  /**
   * Loads what was saved; anything unreadable or from an older format is skipped, not trusted. The files are read all
   * at once: on the phone each read is a trip to the native side, and the first frame waits for the last one. A file
   * this build saved isn't checked against its schema again (on the phone, checking them all was most of the start's
   * wait); any other is, as before.
   */
  async load(): Promise<void> {
    const keys = await this.storage.list("datasets/");
    const texts = await Promise.all(keys.map((key) => this.storage.read(key).catch(() => null)));
    for (const text of texts) {
      try {
        const saved = JSON.parse(text ?? "null");
        if (saved?.format !== FORMAT || !(saved.name in Datasets)) continue;
        const ours = this.shapes !== undefined && saved.shapes === this.shapes;
        if (!ours) {
          const schema = Datasets[saved.name as DatasetName];
          if (!schema.safeParse(saved.value).success) continue;
          if (this.shapes !== undefined) this.unstamped.add(saved.name);
        }
        this.sets.set(saved.name, { name: saved.name, value: saved.value, fetchedAt: saved.fetchedAt, hash: saved.hash });
      } catch {
        // A damaged file is ignored; the next sync rewrites it.
      }
    }
  }

  /**
   * Saves again, with this build's stamp, each dataset that loaded from a file saved under other shapes and passed
   * this build's check (the first start after an update): the next start takes it as is. Unchanged datasets are never
   * written otherwise. Called once the screens are up, not before the first frame.
   */
  async restamp(breathe?: () => Promise<void>): Promise<void> {
    const names = [...this.unstamped];
    this.unstamped.clear();
    for (const name of names) {
      const payload = this.sets.get(name);
      if (payload) await this.save(payload);
      // The screens' turn between two files (the phone, where they share this thread).
      await breathe?.();
    }
  }

  get<N extends DatasetName>(name: N): DatasetValue<N> | undefined {
    return this.sets.get(name)?.value as DatasetValue<N> | undefined;
  }

  /** When the dataset was last read from its source, changed or not. */
  fetchedAt(name: DatasetName): number | null {
    return this.sets.get(name)?.fetchedAt ?? null;
  }

  /** Stores a fresh value. Returns true when the content changed (and the screens were told). */
  async set<N extends DatasetName>(name: N, value: DatasetValue<N>, fetchedAt: number): Promise<boolean> {
    const hash = hashOf(value);
    const previous = this.sets.get(name);
    if (previous?.hash === hash) {
      previous.fetchedAt = fetchedAt;
      return false;
    }
    const payload: DatasetPayload = { name, value, fetchedAt, hash };
    this.sets.set(name, payload);
    this.unstamped.delete(name);
    await this.save(payload);
    this.emit({ type: "dataset", dataset: payload });
    return true;
  }

  /** Forgets every dataset whose name starts with `prefix` ("edunex." on sign-out). */
  async remove(prefix: string): Promise<void> {
    for (const name of [...this.sets.keys()].filter((n) => n.startsWith(prefix))) {
      this.sets.delete(name);
      this.unstamped.delete(name);
      await this.storage.remove(keyOf(name));
      this.emit({ type: "dataset.removed", name });
    }
  }

  snapshot(): DatasetPayload[] {
    return [...this.sets.values()];
  }

  private save(payload: DatasetPayload): Promise<void> {
    const stamp = this.shapes === undefined ? {} : { shapes: this.shapes };
    return this.storage.write(keyOf(payload.name), JSON.stringify({ format: FORMAT, ...stamp, ...payload }));
  }
}
