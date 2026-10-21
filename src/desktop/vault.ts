// Sessions are stored only locked with a key the system keychain keeps. On macOS that's the key
// the app's keychain helper keeps (src/desktop/keychain-helper.ts): each value is sealed with it
// (AES-256-GCM, bound to its name). Elsewhere, and on a Mac build the helper won't answer, it's
// Electron's safeStorage (DPAPI on Windows, the keyring on Linux, the keychain on a Mac). A
// sign-in safeStorage locked before the helper came is read once with it and sealed again.
// When the computer offers no real secure storage (some Linux desktops fall back to
// "basic_text"), nothing is written: sessions live in memory until the app quits, and the
// screens say so.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { safeStorage } from "electron";
import type { Vault } from "../engine/store/storage";
import type { FileStorage } from "./storage";

export type VaultMode = "encrypted" | "memory";

/** A value sealed with the helper's key starts so; safeStorage's are plain base64, which never has a colon. */
const SEALED = "k1:";
const IV = 12;
const TAG = 16;

const fileOf = (name: string) => `${name}.bin`;

/** `value` sealed with `key`, bound to `name` (a value moved to another name doesn't open). */
function seal(key: Buffer, name: string, value: string): string {
  const iv = randomBytes(IV);
  const cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: TAG });
  cipher.setAAD(Buffer.from(name, "utf8"));
  const sealed = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return SEALED + Buffer.concat([iv, cipher.getAuthTag(), sealed]).toString("base64");
}

/** What `seal` sealed, or null: another key, another name, or not whole. */
export function unseal(key: Buffer, name: string, stored: string): string | null {
  const bytes = Buffer.from(stored.slice(SEALED.length), "base64");
  if (bytes.length < IV + TAG) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, bytes.subarray(0, IV), { authTagLength: TAG });
    decipher.setAAD(Buffer.from(name, "utf8"));
    decipher.setAuthTag(bytes.subarray(IV, IV + TAG));
    return Buffer.concat([decipher.update(bytes.subarray(IV + TAG)), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Whether the vault folder still holds a sign-in safeStorage locked (before the helper). It's
 * sealed again on this start, the one time the app still opens safeStorage's keychain entry. When
 * the folder can't be read through, yes: that start keeps safeStorage's entry within reach rather
 * than lose a sign-in it couldn't open.
 */
export function holdsSafeStorage(folder: string): boolean {
  const gone = (error: unknown) => (error as NodeJS.ErrnoException).code === "ENOENT";
  let files: string[];
  try {
    files = readdirSync(folder).filter((file) => file.endsWith(".bin"));
  } catch (error) {
    return !gone(error);
  }
  return files.some((file) => {
    try {
      return !readFileSync(path.join(folder, file), "utf8").startsWith(SEALED);
    } catch (error) {
      // Removed meanwhile (a sign-out): nothing there.
      return !gone(error);
    }
  });
}

/** Opens the vault: sealed with `key` (the helper's, macOS) when there is one, else with safeStorage. */
export async function openVault(files: FileStorage, key: Buffer | null = null): Promise<{ vault: Vault; mode: VaultMode }> {
  if (key) {
    const vault = sealedVault(files, key);
    // Every sign-in safeStorage locked is sealed again now, all in one start (one question from macOS at most), not whenever each is next read.
    for (const file of await files.list("")) if (file.endsWith(".bin")) await vault.get(file.slice(0, -".bin".length));
    return { mode: "encrypted", vault };
  }
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
  const vault: Vault = {
    async get(name) {
      const stored = await files.read(fileOf(name));
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
      await files.write(fileOf(name), encrypted.toString("base64"));
    },
    async delete(name) {
      await files.remove(fileOf(name));
    },
  };
  return { mode: "encrypted", vault };
}

function sealedVault(files: FileStorage, key: Buffer): Vault {
  const vault: Vault = {
    async get(name) {
      const stored = await files.read(fileOf(name));
      if (stored === null) return null;
      if (stored.startsWith(SEALED)) return unseal(key, name, stored);
      // Locked by safeStorage before the helper: read with it this once, then sealed with the key.
      // Unreadable (the Student said no, or another computer's): as good as no session, and gone,
      // so the next start doesn't open safeStorage's entry again.
      let value: string;
      try {
        value = (await safeStorage.decryptStringAsync(Buffer.from(stored, "base64"))).result;
      } catch {
        await files.remove(fileOf(name));
        return null;
      }
      await vault.set(name, value);
      return value;
    },
    async set(name, value) {
      await files.write(fileOf(name), seal(key, name, value));
    },
    async delete(name) {
      await files.remove(fileOf(name));
    },
  };
  return vault;
}
