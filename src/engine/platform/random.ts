// Random bytes for what must not be guessed (a phone-alerts topic). On the phone, Metro picks
// ./random.native.ts instead.
import { randomBytes as nodeRandomBytes } from "node:crypto";

/** `size` bytes from the system's secure random source. */
export function randomBytes(size: number): Uint8Array {
  return nodeRandomBytes(size);
}
