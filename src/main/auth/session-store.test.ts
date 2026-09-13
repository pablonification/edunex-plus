import { describe, expect, it, vi, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createSessionStore } from "./session-store";
import type { CapturedAuth } from "../../shared/auth";

const session: CapturedAuth = {
  accessToken: "eyJ0eXAiOiJK.abc.def",
  refreshToken: "def50200b172",
  expirationDate: "2069-12-07T00:00:00.000Z",
  verified: true,
  accounts: { "0": { id: 190136 } },
};

/** Round-trip codec standing in for safeStorage — same contract, no Keychain.
 * Base64 so the no-plaintext assertion below is real, not vacuous. */
const codec = {
  encrypt: (plain: string) => Buffer.from(plain, "utf8").toString("base64"),
  decrypt: (blob: Buffer) => Buffer.from(blob.toString("utf8"), "base64").toString("utf8"),
};

function tmpFile() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "edunex-auth-")), "session.bin");
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("session store", () => {
  it("round-trips a session through the encrypting codec", () => {
    const file = tmpFile();
    const store = createSessionStore(file, codec);

    store.save(session);

    // Never plaintext on disk: the file must not contain the raw token.
    expect(fs.readFileSync(file, "utf8")).not.toContain("eyJ0eXAiOiJK");
    expect(store.load()).toEqual(session);
  });

  it("loads null when nothing is stored", () => {
    expect(createSessionStore(tmpFile(), codec).load()).toBeNull();
  });

  it("loads null from an undecryptable file instead of crashing startup", () => {
    const file = tmpFile();
    fs.writeFileSync(file, Buffer.from("garbage"));
    expect(createSessionStore(file, codec).load()).toBeNull();
  });

  it("loads null from a file holding non-auth JSON", () => {
    const file = tmpFile();
    const store = createSessionStore(file, codec);
    fs.writeFileSync(file, codec.encrypt(JSON.stringify({ nope: true })));
    expect(store.load()).toBeNull();
  });

  it("clear removes the stored session", () => {
    const file = tmpFile();
    const store = createSessionStore(file, codec);
    store.save(session);

    store.clear();

    expect(store.load()).toBeNull();
    expect(fs.existsSync(file)).toBe(false);
  });

  it("clear tolerates a missing file", () => {
    const store = createSessionStore(tmpFile(), codec);
    expect(() => store.clear()).not.toThrow();
  });
});
