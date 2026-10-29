// Text and bytes the same way on every platform, in plain TypeScript: a string's UTF-8 bytes, how
// many there are, and bytes written as hex or base64. Node's Buffer does this on the desktop; the
// phone has no Buffer, so the engine uses these on both.

/** How many bytes `text` takes in UTF-8, as Node's Buffer.byteLength counts them (a lone surrogate takes three, as U+FFFD). */
export function utf8Length(text: string): number {
  let length = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) length += 1;
    else if (code < 0x800) length += 2;
    else if (code >= 0xd800 && code <= 0xdbff && isLow(text.charCodeAt(i + 1))) {
      length += 4;
      i++;
    } else length += 3;
  }
  return length;
}

/** `text` as UTF-8 bytes, a lone surrogate as U+FFFD: what Node's Buffer.from(text) and TextEncoder give. */
export function utf8(text: string): Uint8Array {
  const out = new Uint8Array(utf8Length(text));
  let at = 0;
  for (let i = 0; i < text.length; i++) {
    let code = text.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdfff) {
      const next = text.charCodeAt(i + 1);
      if (code <= 0xdbff && isLow(next)) {
        code = 0x10000 + ((code - 0xd800) << 10) + (next - 0xdc00);
        i++;
      } else code = 0xfffd;
    }
    if (code < 0x80) out[at++] = code;
    else if (code < 0x800) {
      out[at++] = 0xc0 | (code >> 6);
      out[at++] = 0x80 | (code & 0x3f);
    } else if (code < 0x10000) {
      out[at++] = 0xe0 | (code >> 12);
      out[at++] = 0x80 | ((code >> 6) & 0x3f);
      out[at++] = 0x80 | (code & 0x3f);
    } else {
      out[at++] = 0xf0 | (code >> 18);
      out[at++] = 0x80 | ((code >> 12) & 0x3f);
      out[at++] = 0x80 | ((code >> 6) & 0x3f);
      out[at++] = 0x80 | (code & 0x3f);
    }
  }
  return out;
}

const isLow = (code: number) => code >= 0xdc00 && code <= 0xdfff;

const HEX = "0123456789abcdef";
const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

/** Bytes as lower-case hex. */
export function hex(bytes: Uint8Array): string {
  let out = "";
  for (const byte of bytes) out += HEX[byte >> 4]! + HEX[byte & 15]!;
  return out;
}

/** Bytes as base64, padded; `url`: base64url without padding (Node's "base64url"). */
export function base64(bytes: Uint8Array, url = false): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const [a, b, c] = [bytes[i]!, bytes[i + 1] ?? 0, bytes[i + 2] ?? 0];
    const chunk = (a << 16) | (b << 8) | c;
    out += BASE64[chunk >> 18]! + BASE64[(chunk >> 12) & 63]!;
    out += i + 1 < bytes.length ? BASE64[(chunk >> 6) & 63]! : "=";
    out += i + 2 < bytes.length ? BASE64[chunk & 63]! : "=";
  }
  return url ? out.replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_") : out;
}
