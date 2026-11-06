// Random bytes on the phone: the Web Crypto `getRandomValues` the app installs before the engine
// starts (Hermes has no crypto of its own). The desktop uses ./random.ts.

/** `size` bytes from the system's secure random source. */
export function randomBytes(size: number): Uint8Array {
  const random = (globalThis as { crypto?: { getRandomValues?<T extends ArrayBufferView>(array: T): T } }).crypto;
  if (!random?.getRandomValues) throw new Error("crypto.getRandomValues is missing: the app installs it before the engine starts");
  const bytes = new Uint8Array(size);
  // getRandomValues fills at most 65,536 bytes at a time.
  for (let at = 0; at < size; at += 65_536) random.getRandomValues(bytes.subarray(at, Math.min(size, at + 65_536)));
  return bytes;
}
