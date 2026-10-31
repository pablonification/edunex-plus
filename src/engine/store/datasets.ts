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

  constructor(
    private readonly storage: Storage,
    private readonly emit: (event: Event) => void,
  ) {}

  /** Loads what was saved; anything unreadable or from an older format is skipped, not trusted. */
  async load(): Promise<void> {
    for (const key of await this.storage.list("datasets/")) {
      try {
        const saved = JSON.parse((await this.storage.read(key)) ?? "null");
        if (saved?.format !== FORMAT || !(saved.name in Datasets)) continue;
        const schema = Datasets[saved.name as DatasetName];
        if (!schema.safeParse(saved.value).success) continue;
        this.sets.set(saved.name, { name: saved.name, value: saved.value, fetchedAt: saved.fetchedAt, hash: saved.hash });
      } catch {
        // A damaged file is ignored; the next sync rewrites it.
      }
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
    await this.storage.write(keyOf(name), JSON.stringify({ format: FORMAT, ...payload }));
    this.emit({ type: "dataset", dataset: payload });
    return true;
  }

  /** Forgets every dataset whose name starts with `prefix` ("edunex." on sign-out). */
  async remove(prefix: string): Promise<void> {
    for (const name of [...this.sets.keys()].filter((n) => n.startsWith(prefix))) {
      this.sets.delete(name);
      await this.storage.remove(keyOf(name));
      this.emit({ type: "dataset.removed", name });
    }
  }

  snapshot(): DatasetPayload[] {
    return [...this.sets.values()];
  }
}
