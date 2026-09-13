import fs from "node:fs";
import type { CapturedAuth } from "../../shared/auth";
import { parseCapturedAuth } from "./capture";

/**
 * Tokens at rest via safeStorage (spec: auth & session) — the codec abstracts
 * encrypt/decrypt so tests run without a Keychain and main injects the real
 * safeStorage-backed one. If the codec fails, no plaintext fallback is ever
 * written: the store stays empty and the user signs in again.
 */
export interface SessionCodec {
  encrypt(plaintext: string): Buffer;
  decrypt(blob: Buffer): string;
}

export interface SessionStore {
  load(): CapturedAuth | null;
  save(session: CapturedAuth): void;
  clear(): void;
}

export function createSessionStore(
  filePath: string,
  codec: SessionCodec,
  fsLike: Pick<typeof fs, "readFileSync" | "writeFileSync" | "rmSync" | "existsSync"> = fs,
): SessionStore {
  function load(): CapturedAuth | null {
    let blob: Buffer;
    try {
      blob = fsLike.readFileSync(filePath);
    } catch {
      return null;
    }
    let raw: unknown;
    try {
      raw = JSON.parse(codec.decrypt(blob));
    } catch {
      return null;
    }
    return parseCapturedAuth(raw);
  }

  function save(session: CapturedAuth): void {
    fsLike.writeFileSync(filePath, codec.encrypt(JSON.stringify(session)));
  }

  function clear(): void {
    try {
      fsLike.rmSync(filePath);
    } catch {
      // No file to clear — already the desired state.
    }
  }

  return { load, save, clear };
}
