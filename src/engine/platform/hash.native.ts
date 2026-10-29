// Hashing on the phone: SHA-1, SHA-256 and SHA-512 in plain TypeScript, synchronous and with no
// dependency, giving the bytes Node's crypto gives (./hash.ts, which the desktop keeps using). Metro
// picks this file on Android; test/engine/platform.test.ts checks the two agree over many inputs.
import { base64, hex, utf8 } from "./bytes";
import type { DigestEncoding, HashName } from "./hash";

/** The digest of `data` (a string is hashed as its UTF-8 bytes), written as `encoding`. */
export function digest(name: HashName, data: string | Uint8Array, encoding: DigestEncoding): string {
  const bytes = typeof data === "string" ? utf8(data) : data;
  const sum = name === "sha1" ? sha1(bytes) : name === "sha256" ? sha256(bytes) : sha512(bytes);
  return encoding === "hex" ? hex(sum) : base64(sum, encoding === "base64url");
}

/** The message, a 1 bit, zeros, and its length in bits at the end (big-endian): whole blocks. */
function padded(bytes: Uint8Array, block: number, lengthSize: number): DataView {
  const total = Math.ceil((bytes.length + 1 + lengthSize) / block) * block;
  const out = new Uint8Array(total);
  out.set(bytes);
  out[bytes.length] = 0x80;
  const view = new DataView(out.buffer);
  const bits = bytes.length * 8;
  view.setUint32(total - 4, bits >>> 0);
  view.setUint32(total - 8, Math.floor(bits / 0x1_0000_0000));
  return view;
}

const words = (state: ArrayLike<number>): Uint8Array => {
  const out = new DataView(new ArrayBuffer(state.length * 4));
  for (let i = 0; i < state.length; i++) out.setInt32(i * 4, state[i]!);
  return new Uint8Array(out.buffer);
};

const rotl = (x: number, n: number) => (x << n) | (x >>> (32 - n));
const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));

function sha1(bytes: Uint8Array): Uint8Array {
  const view = padded(bytes, 64, 8);
  const h = Int32Array.from([0x6745_2301, 0xefcd_ab89, 0x98ba_dcfe, 0x1032_5476, 0xc3d2_e1f0]);
  const w = new Int32Array(80);
  for (let block = 0; block < view.byteLength; block += 64) {
    for (let t = 0; t < 16; t++) w[t] = view.getInt32(block + t * 4);
    for (let t = 16; t < 80; t++) w[t] = rotl(w[t - 3]! ^ w[t - 8]! ^ w[t - 14]! ^ w[t - 16]!, 1);
    let [a, b, c, d, e] = h as unknown as [number, number, number, number, number];
    for (let t = 0; t < 80; t++) {
      const f = t < 20 ? (b & c) | (~b & d) : t < 40 ? b ^ c ^ d : t < 60 ? (b & c) | (b & d) | (c & d) : b ^ c ^ d;
      const k = t < 20 ? 0x5a827999 : t < 40 ? 0x6ed9eba1 : t < 60 ? 0x8f1bbcdc : 0xca62c1d6;
      const next = (rotl(a, 5) + f + e + k + w[t]!) | 0;
      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = next;
    }
    h[0] = h[0]! + a;
    h[1] = h[1]! + b;
    h[2] = h[2]! + c;
    h[3] = h[3]! + d;
    h[4] = h[4]! + e;
  }
  return words(h);
}

/** SHA-256's round constants and start, the first 32 bits of the fractional parts of the first primes' cube and square roots. */
const K256 = Int32Array.from([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74,
  0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d,
  0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e,
  0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const H256 = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

function sha256(bytes: Uint8Array): Uint8Array {
  const view = padded(bytes, 64, 8);
  const h = Int32Array.from(H256);
  const w = new Int32Array(64);
  for (let block = 0; block < view.byteLength; block += 64) {
    for (let t = 0; t < 16; t++) w[t] = view.getInt32(block + t * 4);
    for (let t = 16; t < 64; t++) {
      const [x, y] = [w[t - 15]!, w[t - 2]!];
      const s0 = rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3);
      const s1 = rotr(y, 17) ^ rotr(y, 19) ^ (y >>> 10);
      w[t] = w[t - 16]! + s0 + w[t - 7]! + s1;
    }
    let [a, b, c, d, e, f, g, hh] = h as unknown as number[] as [number, number, number, number, number, number, number, number];
    for (let t = 0; t < 64; t++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K256[t]! + w[t]!) | 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      hh = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    const round = [a, b, c, d, e, f, g, hh];
    for (let i = 0; i < 8; i++) h[i] = h[i]! + round[i]!;
  }
  return words(h);
}

/** SHA-512's round constants and start, 64 bits each as a high and a low half (from the first primes' cube and square roots). */
const K512 = Int32Array.from([
  0x428a2f98, 0xd728ae22, 0x71374491, 0x23ef65cd, 0xb5c0fbcf, 0xec4d3b2f, 0xe9b5dba5, 0x8189dbbc, 0x3956c25b, 0xf348b538, 0x59f111f1, 0xb605d019, 0x923f82a4,
  0xaf194f9b, 0xab1c5ed5, 0xda6d8118, 0xd807aa98, 0xa3030242, 0x12835b01, 0x45706fbe, 0x243185be, 0x4ee4b28c, 0x550c7dc3, 0xd5ffb4e2, 0x72be5d74, 0xf27b896f,
  0x80deb1fe, 0x3b1696b1, 0x9bdc06a7, 0x25c71235, 0xc19bf174, 0xcf692694, 0xe49b69c1, 0x9ef14ad2, 0xefbe4786, 0x384f25e3, 0x0fc19dc6, 0x8b8cd5b5, 0x240ca1cc,
  0x77ac9c65, 0x2de92c6f, 0x592b0275, 0x4a7484aa, 0x6ea6e483, 0x5cb0a9dc, 0xbd41fbd4, 0x76f988da, 0x831153b5, 0x983e5152, 0xee66dfab, 0xa831c66d, 0x2db43210,
  0xb00327c8, 0x98fb213f, 0xbf597fc7, 0xbeef0ee4, 0xc6e00bf3, 0x3da88fc2, 0xd5a79147, 0x930aa725, 0x06ca6351, 0xe003826f, 0x14292967, 0x0a0e6e70, 0x27b70a85,
  0x46d22ffc, 0x2e1b2138, 0x5c26c926, 0x4d2c6dfc, 0x5ac42aed, 0x53380d13, 0x9d95b3df, 0x650a7354, 0x8baf63de, 0x766a0abb, 0x3c77b2a8, 0x81c2c92e, 0x47edaee6,
  0x92722c85, 0x1482353b, 0xa2bfe8a1, 0x4cf10364, 0xa81a664b, 0xbc423001, 0xc24b8b70, 0xd0f89791, 0xc76c51a3, 0x0654be30, 0xd192e819, 0xd6ef5218, 0xd6990624,
  0x5565a910, 0xf40e3585, 0x5771202a, 0x106aa070, 0x32bbd1b8, 0x19a4c116, 0xb8d2d0c8, 0x1e376c08, 0x5141ab53, 0x2748774c, 0xdf8eeb99, 0x34b0bcb5, 0xe19b48a8,
  0x391c0cb3, 0xc5c95a63, 0x4ed8aa4a, 0xe3418acb, 0x5b9cca4f, 0x7763e373, 0x682e6ff3, 0xd6b2b8a3, 0x748f82ee, 0x5defb2fc, 0x78a5636f, 0x43172f60, 0x84c87814,
  0xa1f0ab72, 0x8cc70208, 0x1a6439ec, 0x90befffa, 0x23631e28, 0xa4506ceb, 0xde82bde9, 0xbef9a3f7, 0xb2c67915, 0xc67178f2, 0xe372532b, 0xca273ece, 0xea26619c,
  0xd186b8c7, 0x21c0c207, 0xeada7dd6, 0xcde0eb1e, 0xf57d4f7f, 0xee6ed178, 0x06f067aa, 0x72176fba, 0x0a637dc5, 0xa2c898a6, 0x113f9804, 0xbef90dae, 0x1b710b35,
  0x131c471b, 0x28db77f5, 0x23047d84, 0x32caab7b, 0x40c72493, 0x3c9ebe0a, 0x15c9bebc, 0x431d67c4, 0x9c100d4c, 0x4cc5d4be, 0xcb3e42b6, 0x597f299c, 0xfc657e2a,
  0x5fcb6fab, 0x3ad6faec, 0x6c44198c, 0x4a475817,
]);
const H512 = [
  0x6a09e667, 0xf3bcc908, 0xbb67ae85, 0x84caa73b, 0x3c6ef372, 0xfe94f82b, 0xa54ff53a, 0x5f1d36f1, 0x510e527f, 0xade682d1, 0x9b05688c, 0x2b3e6c1f, 0x1f83d9ab,
  0xfb41bd6b, 0x5be0cd19, 0x137e2179,
];

// A 64-bit word is a pair of 32-bit halves (high, low): rotations and shifts move bits across them.
const rotrHigh = (high: number, low: number, n: number) => (n < 32 ? (high >>> n) | (low << (32 - n)) : (low >>> (n - 32)) | (high << (64 - n)));
const rotrLow = (high: number, low: number, n: number) => (n < 32 ? (low >>> n) | (high << (32 - n)) : (high >>> (n - 32)) | (low << (64 - n)));
const shrLow = (high: number, low: number, n: number) => (low >>> n) | (high << (32 - n));
const TWO_32 = 0x1_0000_0000;

function sha512(bytes: Uint8Array): Uint8Array {
  const view = padded(bytes, 128, 16);
  const h = Int32Array.from(H512);
  const w = new Int32Array(160);
  for (let block = 0; block < view.byteLength; block += 128) {
    for (let t = 0; t < 32; t++) w[t] = view.getInt32(block + t * 4);
    for (let t = 16; t < 80; t++) {
      const [xh, xl] = [w[2 * (t - 15)]!, w[2 * (t - 15) + 1]!];
      const [yh, yl] = [w[2 * (t - 2)]!, w[2 * (t - 2) + 1]!];
      const s0h = rotrHigh(xh, xl, 1) ^ rotrHigh(xh, xl, 8) ^ (xh >>> 7);
      const s0l = rotrLow(xh, xl, 1) ^ rotrLow(xh, xl, 8) ^ shrLow(xh, xl, 7);
      const s1h = rotrHigh(yh, yl, 19) ^ rotrHigh(yh, yl, 61) ^ (yh >>> 6);
      const s1l = rotrLow(yh, yl, 19) ^ rotrLow(yh, yl, 61) ^ shrLow(yh, yl, 6);
      const low = (w[2 * (t - 16) + 1]! >>> 0) + (s0l >>> 0) + (w[2 * (t - 7) + 1]! >>> 0) + (s1l >>> 0);
      w[2 * t] = w[2 * (t - 16)]! + s0h + w[2 * (t - 7)]! + s1h + Math.floor(low / TWO_32);
      w[2 * t + 1] = low;
    }
    const s = Array.from(h);
    for (let t = 0; t < 80; t++) {
      const [ah, al, bh, bl, ch, cl, dh, dl, eh, el, fh, fl, gh, gl, hh, hl] = s as [
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
        number,
      ];
      const sum1h = rotrHigh(eh, el, 14) ^ rotrHigh(eh, el, 18) ^ rotrHigh(eh, el, 41);
      const sum1l = rotrLow(eh, el, 14) ^ rotrLow(eh, el, 18) ^ rotrLow(eh, el, 41);
      const chooseH = (eh & fh) ^ (~eh & gh);
      const chooseL = (el & fl) ^ (~el & gl);
      const t1l = (hl >>> 0) + (sum1l >>> 0) + (chooseL >>> 0) + (K512[2 * t + 1]! >>> 0) + (w[2 * t + 1]! >>> 0);
      const t1h = (hh + sum1h + chooseH + K512[2 * t]! + w[2 * t]! + Math.floor(t1l / TWO_32)) | 0;
      const sum0h = rotrHigh(ah, al, 28) ^ rotrHigh(ah, al, 34) ^ rotrHigh(ah, al, 39);
      const sum0l = rotrLow(ah, al, 28) ^ rotrLow(ah, al, 34) ^ rotrLow(ah, al, 39);
      const majorityH = (ah & bh) ^ (ah & ch) ^ (bh & ch);
      const majorityL = (al & bl) ^ (al & cl) ^ (bl & cl);
      const t2l = (sum0l >>> 0) + (majorityL >>> 0);
      const t2h = (sum0h + majorityH + Math.floor(t2l / TWO_32)) | 0;
      const el2 = (dl >>> 0) + (t1l % TWO_32);
      const al2 = (t1l % TWO_32) + (t2l % TWO_32);
      s.splice(
        0,
        16,
        (t1h + t2h + Math.floor(al2 / TWO_32)) | 0,
        al2 | 0,
        ah,
        al,
        bh,
        bl,
        ch,
        cl,
        (dh + t1h + Math.floor(el2 / TWO_32)) | 0,
        el2 | 0,
        eh,
        el,
        fh,
        fl,
        gh,
        gl,
      );
    }
    for (let i = 0; i < 16; i += 2) {
      const low = (h[i + 1]! >>> 0) + (s[i + 1]! >>> 0);
      h[i] = h[i]! + s[i]! + Math.floor(low / TWO_32);
      h[i + 1] = low;
    }
  }
  return words(h);
}
