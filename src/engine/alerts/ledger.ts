// The seen-ledger: the id of every alert already raised (or silently taken
// in by a first sync), kept on disk so nothing alerts twice, even across
// restarts. Oldest entries go first once it's full.
import type { Storage } from "../store/storage";

const KEY = "alerts/seen.json";
const FORMAT = 1;
const LIMIT = 5_000;

export class SeenLedger {
  private seen = new Map<string, number>();

  constructor(private readonly storage: Storage) {}

  async load(): Promise<void> {
    try {
      const saved = JSON.parse((await this.storage.read(KEY)) ?? "null");
      if (saved?.format !== FORMAT || typeof saved.seen !== "object") return;
      for (const [id, at] of Object.entries(saved.seen)) if (typeof at === "number") this.seen.set(id, at);
    } catch {
      // Unreadable: start empty. The datasets' own history still keeps old items quiet.
    }
  }

  has(id: string): boolean {
    return this.seen.has(id);
  }

  add(id: string, at: number): void {
    this.seen.set(id, at);
  }

  async save(): Promise<void> {
    if (this.seen.size > LIMIT) this.seen = new Map([...this.seen].sort((a, b) => b[1] - a[1]).slice(0, LIMIT));
    await this.storage.write(KEY, JSON.stringify({ format: FORMAT, seen: Object.fromEntries(this.seen) }));
  }

  async clear(): Promise<void> {
    this.seen.clear();
    await this.storage.remove(KEY);
  }
}
