// The engine's memory: every dataset as { value, fetchedAt, hash }, saved to
// disk, and announced to the screens only when its content really changed.
import crypto from "node:crypto";
import type { DatasetPayload, Event } from "../../core/contract";
import { type DatasetName, type DatasetValue, Datasets } from "../../core/models";
import type { Storage } from "./storage";

const FORMAT = 1;
const keyOf = (name: string) => `datasets/${name}.json`;

/** Same content, same hash: object keys are sorted first. */
export function hashOf(value: unknown): string {
  const stable = (v: unknown): unknown =>
    Array.isArray(v) ? v.map(stable) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable((v as Record<string, unknown>)[k])])) : v;
  return crypto.createHash("sha1").update(JSON.stringify(stable(value))).digest("hex");
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
