// Where the relay keeps what it's sent and what it filed: the storage of one Durable Object in
// production (./worker.ts), a Map in the tests. It's consistent at once, unlike Workers KV, so a
// report always sees the one before it, and two reports a second apart can't both open an issue.

/** The few calls the relay makes: the key-value half of a Durable Object's storage. */
export interface Store {
  get<T>(key: string): Promise<T | undefined>;
  put(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<unknown>;
  /** The keys starting with `prefix`, in order. */
  list<T>(options: { prefix: string; limit?: number }): Promise<Map<string, T>>;
}

/** Characters a piece of a report holds: at most about 1 MB stored, under the 2 MB a Durable Object value can be. */
const PIECE = 500_000;

/** Keeps a report's body as it came, in pieces; how many there are. */
export async function putBody(store: Store, id: string, text: string): Promise<number> {
  const pieces = Math.max(1, Math.ceil(text.length / PIECE));
  for (let i = 0; i < pieces; i++) await store.put(`body:${id}:${i}`, text.slice(i * PIECE, (i + 1) * PIECE));
  return pieces;
}

/** A report's body as it came, or null if a piece of it is gone. */
export async function getBody(store: Store, id: string, pieces: number): Promise<string | null> {
  let text = "";
  for (let i = 0; i < pieces; i++) {
    const piece = await store.get<string>(`body:${id}:${i}`);
    if (piece === undefined) return null;
    text += piece;
  }
  return text;
}

export async function deleteBody(store: Store, id: string, pieces: number): Promise<void> {
  for (let i = 0; i < pieces; i++) await store.delete(`body:${id}:${i}`);
}
