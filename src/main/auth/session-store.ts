import type { CapturedAuth } from "../../shared/auth";
import type { FileSystemService } from "../platform/services";
import { parseCapturedAuth } from "./capture";

/**
 * Tokens at rest via safeStorage (spec: auth & session) — the codec abstracts
 * encrypt/decrypt so tests run without a Keychain and main injects the real
 * safeStorage-backed one. If the codec fails, no plaintext fallback is ever
 * written: the store stays empty and the user signs in again.
 */
export interface SessionCodec {
  encrypt(plaintext: string): Uint8Array | string;
  decrypt(blob: Uint8Array | string): string;
}

export interface SessionStore {
  load(): CapturedAuth | null;
  save(session: CapturedAuth): void;
  clear(): void;
}

export function createSessionStore(
  filePath: string,
  codec: SessionCodec,
  fileSystem: FileSystemService | LegacyFileSystem,
): SessionStore {
  const readBytes = (target: string): Uint8Array =>
    "readBytes" in fileSystem
      ? fileSystem.readBytes(target)
      : fileSystem.readFileSync(target);
  const writeBytes = (target: string, contents: Uint8Array): void => {
    if ("writeBytes" in fileSystem) fileSystem.writeBytes(target, contents);
    else fileSystem.writeFileSync(target, contents);
  };
  const remove = (target: string): void => {
    if ("remove" in fileSystem) fileSystem.remove(target);
    else fileSystem.rmSync(target);
  };

  function load(): CapturedAuth | null {
    let blob: Uint8Array;
    try {
      blob = readBytes(filePath);
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
    const encrypted = codec.encrypt(JSON.stringify(session));
    writeBytes(
      filePath,
      typeof encrypted === "string" ? new TextEncoder().encode(encrypted) : encrypted,
    );
  }

  function clear(): void {
    try {
      remove(filePath);
    } catch {
      // No file to clear — already the desired state.
    }
  }

  return { load, save, clear };
}

/** Compatibility shape retained for callers that used the old fs test seam. */
interface LegacyFileSystem {
  readFileSync(filePath: string): Uint8Array;
  writeFileSync(filePath: string, contents: Uint8Array | string): void;
  rmSync(filePath: string): void;
}
