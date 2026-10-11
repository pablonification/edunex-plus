// Sessions are stored only through the OS keychain (Electron safeStorage).
// When the computer offers no real secure storage (some Linux desktops fall
// back to "basic_text"), nothing is written: sessions live in memory until
// the app quits, and the screens say so.
import { safeStorage } from "electron";
import type { Vault } from "../engine/store/storage";
import type { FileStorage } from "./storage";

export type VaultMode = "encrypted" | "memory";

export async function openVault(files: FileStorage): Promise<{ vault: Vault; mode: VaultMode }> {
  const secure =
    (await safeStorage.isAsyncEncryptionAvailable().catch(() => false)) &&
    !(process.platform === "linux" && safeStorage.getSelectedStorageBackend() === "basic_text");
  if (!secure) {
    const memory = new Map<string, string>();
    return {
      mode: "memory",
      vault: {
        get: async (name) => memory.get(name) ?? null,
        set: async (name, value) => void memory.set(name, value),
        delete: async (name) => void memory.delete(name),
      },
    };
  }
  const key = (name: string) => `${name}.bin`;
  const vault: Vault = {
    async get(name) {
      const stored = await files.read(key(name));
      if (stored === null) return null;
      try {
        const { result, shouldReEncrypt } = await safeStorage.decryptStringAsync(Buffer.from(stored, "base64"));
        if (shouldReEncrypt) await vault.set(name, result);
        return result;
      } catch {
        // Encrypted under a key this computer no longer has: as good as no session.
        return null;
      }
    },
    async set(name, value) {
      const encrypted = await safeStorage.encryptStringAsync(value);
      await files.write(key(name), encrypted.toString("base64"));
    },
    async delete(name) {
      await files.remove(key(name));
    },
  };
  return { mode: "encrypted", vault };
}
