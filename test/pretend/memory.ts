// In-memory stand-ins for the disk and the OS keychain.
import type { Storage, Vault } from "../../src/engine/store/storage";

export class MemoryStorage implements Storage {
  readonly files = new Map<string, string>();
  async read(key: string) {
    return this.files.get(key) ?? null;
  }
  async write(key: string, text: string) {
    this.files.set(key, text);
  }
  async remove(key: string) {
    this.files.delete(key);
  }
  async list(prefix: string) {
    return [...this.files.keys()].filter((k) => k.startsWith(prefix));
  }
}

export class MemoryVault implements Vault {
  readonly secrets = new Map<string, string>();
  async get(name: string) {
    return this.secrets.get(name) ?? null;
  }
  async set(name: string, value: string) {
    this.secrets.set(name, value);
  }
  async delete(name: string) {
    this.secrets.delete(name);
  }
}
