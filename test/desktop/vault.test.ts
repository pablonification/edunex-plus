// The vault (src/desktop/vault.ts): the saved sign-ins, locked. On a Mac, sealed with the key the
// keychain helper keeps (src/desktop/keychain-helper.ts); a sign-in Electron's safeStorage locked
// before is read with it once and sealed again, so the next start finds nothing for safeStorage and
// the app never opens its keychain entry, the one macOS asked the Student's password for after
// every update. Elsewhere, safeStorage as before. Electron's safeStorage is a stand-in here.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const safe = vi.hoisted(() => ({ decrypts: 0, refuse: false, available: true }));

vi.mock("electron", () => ({
  safeStorage: {
    isAsyncEncryptionAvailable: async () => safe.available,
    getSelectedStorageBackend: () => "keychain",
    encryptStringAsync: async (text: string) => Buffer.from(`safe:${text}`),
    decryptStringAsync: async (bytes: Buffer) => {
      safe.decrypts += 1;
      const text = bytes.toString();
      if (safe.refuse || !text.startsWith("safe:")) throw new Error("Error while decrypting the ciphertext provided to safeStorage.decryptString.");
      return { result: text.slice("safe:".length), shouldReEncrypt: false };
    },
  },
}));

const { holdsSafeStorage, openVault, unseal } = await import("../../src/desktop/vault");
const { FileStorage } = await import("../../src/desktop/storage");
const { helperPath, readVaultKey } = await import("../../src/desktop/keychain-helper");

const KEY = Buffer.alloc(32, 7);
let folder: string;

beforeEach(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), "vault-"));
  Object.assign(safe, { decrypts: 0, refuse: false, available: true });
});
afterEach(() => fs.rmSync(folder, { recursive: true, force: true }));

const stored = (name: string) => fs.readFileSync(path.join(folder, `${name}.bin`), "utf8");
/** A sign-in as safeStorage locked it before the helper. */
const lockedBefore = (name: string, value: string) => fs.writeFileSync(path.join(folder, `${name}.bin`), Buffer.from(`safe:${value}`).toString("base64"));

describe("on a Mac, sealed with the keychain helper's key", () => {
  it("keeps a sign-in sealed, never through safeStorage; only the same key, under the same name, opens it", async () => {
    const { vault, mode } = await openVault(new FileStorage(folder), KEY);
    expect(mode).toBe("encrypted");
    await vault.set("edunex.session", '{"token":"pretend-token"}');
    expect(stored("edunex.session")).toMatch(/^k1:/);
    expect(stored("edunex.session")).not.toContain("pretend-token");
    expect(await vault.get("edunex.session")).toBe('{"token":"pretend-token"}');
    expect(unseal(Buffer.alloc(32, 8), "edunex.session", stored("edunex.session"))).toBeNull();
    // Copied under another name, it doesn't open; nor with its tag cut short.
    expect(unseal(KEY, "six.session", stored("edunex.session"))).toBeNull();
    const bytes = Buffer.from(stored("edunex.session").slice("k1:".length), "base64");
    const shortTag = Buffer.concat([bytes.subarray(0, 12 + 4), bytes.subarray(12 + 16)]);
    expect(unseal(KEY, "edunex.session", `k1:${shortTag.toString("base64")}`)).toBeNull();
    expect(safe.decrypts).toBe(0);
    expect(holdsSafeStorage(folder)).toBe(false);
  });

  it("moves every sign-in safeStorage locked over as it opens, all in one start: the next has nothing for safeStorage", async () => {
    lockedBefore("edunex.session", "E");
    lockedBefore("six.session", "S");
    lockedBefore("phone.ntfy", "P");
    expect(holdsSafeStorage(folder)).toBe(true);
    const { vault } = await openVault(new FileStorage(folder), KEY);
    expect(safe.decrypts).toBe(3);
    expect(holdsSafeStorage(folder)).toBe(false);
    expect([await vault.get("edunex.session"), await vault.get("six.session"), await vault.get("phone.ntfy")]).toEqual(["E", "S", "P"]);
    expect(safe.decrypts).toBe(3);
  });

  it("counts a folder it can't read through as still holding one: that start keeps safeStorage's entry within reach", () => {
    expect(holdsSafeStorage(path.join(folder, "never-made"))).toBe(false);
    fs.writeFileSync(path.join(folder, "edunex.session.bin"), "k1:sealed");
    expect(holdsSafeStorage(folder)).toBe(false);
    // A folder where a sign-in should be: it can't be read as one.
    fs.mkdirSync(path.join(folder, "six.session.bin"));
    expect(holdsSafeStorage(folder)).toBe(true);
  });

  it("drops a sign-in safeStorage can't open (the Student said no to macOS): as good as none, and never asked for again", async () => {
    lockedBefore("edunex.session", "E");
    safe.refuse = true;
    const { vault } = await openVault(new FileStorage(folder), KEY);
    expect(await vault.get("edunex.session")).toBeNull();
    expect(fs.existsSync(path.join(folder, "edunex.session.bin"))).toBe(false);
    expect(holdsSafeStorage(folder)).toBe(false);
  });
});

describe("without the helper's key: Windows, Linux, a Mac build the helper won't answer", () => {
  it("locks with safeStorage, as before", async () => {
    const { vault, mode } = await openVault(new FileStorage(folder));
    expect(mode).toBe("encrypted");
    await vault.set("edunex.session", "E");
    expect(Buffer.from(stored("edunex.session"), "base64").toString()).toBe("safe:E");
    expect(await vault.get("edunex.session")).toBe("E");
  });

  it("keeps sign-ins in memory only, with no secure storage on the computer", async () => {
    safe.available = false;
    const { vault, mode } = await openVault(new FileStorage(folder));
    expect(mode).toBe("memory");
    await vault.set("edunex.session", "E");
    expect(fs.readdirSync(folder)).toEqual([]);
    expect(await vault.get("edunex.session")).toBe("E");
  });
});

describe("the key, from the helper", () => {
  it("is its 64 hex digits; anything else it says, or a helper that fails or isn't there, is no key", () => {
    const hex = "ab".repeat(32);
    let asked: string[] = [];
    expect(
      readVaultKey("/helper", (file, args) => {
        asked = [file, ...args];
        return `${hex}\n`;
      }),
    ).toEqual(Buffer.from(hex, "hex"));
    expect(asked).toEqual(["/helper", "key"]);
    expect(readVaultKey("/helper", () => "ab".repeat(16))).toBeNull();
    expect(
      readVaultKey("/helper", () => {
        throw new Error("Command failed: only Edunex Plus may ask");
      }),
    ).toBeNull();
    expect(readVaultKey(path.join(folder, "no-helper"))).toBeNull();
  });

  it("comes from the helper in the app's Contents/Helpers", () => {
    expect(helperPath("/Applications/Edunex Plus.app/Contents/Resources")).toBe("/Applications/Edunex Plus.app/Contents/Helpers/Edunex Plus Keychain");
  });
});
