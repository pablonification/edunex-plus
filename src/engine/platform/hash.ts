// Hashing, as Node's crypto does it. The phone has no Node: Metro picks ./hash.native.ts there
// instead (the same digests in plain TypeScript), and the desktop, its tests and its build keep this file.
import { createHash } from "node:crypto";

export type HashName = "sha1" | "sha256" | "sha512";
export type DigestEncoding = "hex" | "base64" | "base64url";

/** The digest of `data` (a string is hashed as its UTF-8 bytes), written as `encoding`. */
export function digest(name: HashName, data: string | Uint8Array, encoding: DigestEncoding): string {
  return createHash(name).update(data).digest(encoding);
}
