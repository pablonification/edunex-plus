// Where the engine keeps things on disk. Production writes files under the
// app's data folder (atomically); tests keep them in memory.

export interface Storage {
  read(key: string): Promise<string | null>;
  /** Replaces the whole value at once: a crash mid-write leaves the old value. */
  write(key: string, text: string): Promise<void>;
  remove(key: string): Promise<void>;
  list(prefix: string): Promise<string[]>;
}

/** Secrets (sessions), encrypted by the OS keychain in production. */
export interface Vault {
  get(name: string): Promise<string | null>;
  set(name: string, value: string): Promise<void>;
  delete(name: string): Promise<void>;
}
