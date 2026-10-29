// The engine's platform swaps (src/engine/platform): what the phone runs instead of Node's crypto
// and Buffer gives the same bytes, checked against Node over many inputs, Unicode included.
import { createHash, randomBytes as nodeRandomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { base64, hex, utf8, utf8Length } from "../../src/engine/platform/bytes";
import { digest as nodeDigest } from "../../src/engine/platform/hash";
import { digest as phoneDigest } from "../../src/engine/platform/hash.native";
import { randomBytes as phoneRandomBytes } from "../../src/engine/platform/random.native";

const NAMES = ["sha1", "sha256", "sha512"] as const;
const ENCODINGS = ["hex", "base64", "base64url"] as const;

/** A random string over every kind of character: ASCII, Latin, Indonesian and CJK text, emoji, and lone surrogates. */
function anyText(random: () => number, length: number): string {
  const pick = [
    () => String.fromCharCode(32 + Math.floor(random() * 95)),
    () => String.fromCharCode(0x80 + Math.floor(random() * 0x780)),
    () => String.fromCharCode(0x800 + Math.floor(random() * 0xd000)),
    () => String.fromCodePoint(0x10000 + Math.floor(random() * 0xfffff)),
    () => String.fromCharCode(0xd800 + Math.floor(random() * 0x800)),
    () => ["é", "ß", "💩", "👩🏽‍💻", "日本語", "Tugas Besar ✓", "\u0000", "\n", "￿", "﻿"][Math.floor(random() * 10)]!,
  ];
  let text = "";
  while (text.length < length) text += pick[Math.floor(random() * pick.length)]!();
  return text;
}

/** A small seeded generator, so a failure names an input that comes back. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 0x1_0000_0000;
  };
}

describe("hashing on the phone", () => {
  it("gives Node's digest for bytes of every length around the block edges", () => {
    for (let length = 0; length <= 300; length++) {
      const bytes = nodeRandomBytes(length);
      for (const name of NAMES)
        for (const encoding of ENCODINGS)
          expect(phoneDigest(name, bytes, encoding), `${name} ${encoding} of ${length} bytes`).toBe(nodeDigest(name, bytes, encoding));
    }
  });

  it("gives Node's digest for text, Unicode and lone surrogates included", () => {
    const random = seeded(2026);
    const texts = ["", "a", "abc", "Hari ini kuliah II2240 jam 07.00", "\uD800", "a\uDC00b", "􏿿", "💩".repeat(40)];
    for (let i = 0; i < 400; i++) texts.push(anyText(random, Math.floor(random() * 600)));
    for (const text of texts)
      for (const name of NAMES)
        for (const encoding of ENCODINGS)
          expect(phoneDigest(name, text, encoding), `${name} ${encoding} of ${JSON.stringify(text)}`).toBe(nodeDigest(name, text, encoding));
  });

  it("matches the published test vectors and a long input", () => {
    expect(phoneDigest("sha1", "abc", "hex")).toBe("a9993e364706816aba3e25717850c26c9cd0d89d");
    expect(phoneDigest("sha256", "abc", "hex")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(phoneDigest("sha512", "abc", "hex")).toBe(
      "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f",
    );
    const long = nodeRandomBytes(1_000_003);
    for (const name of NAMES) expect(phoneDigest(name, long, "hex")).toBe(createHash(name).update(long).digest("hex"));
  });
});

describe("text and bytes without Buffer", () => {
  it("encodes UTF-8 as Buffer does, and counts its bytes as Buffer.byteLength does", () => {
    const random = seeded(7);
    for (let i = 0; i < 500; i++) {
      const text = anyText(random, Math.floor(random() * 200));
      expect([...utf8(text)], JSON.stringify(text)).toEqual([...Buffer.from(text, "utf8")]);
      expect(utf8Length(text), JSON.stringify(text)).toBe(Buffer.byteLength(text));
    }
  });

  it("writes bytes as hex and base64 as Buffer does", () => {
    for (let length = 0; length < 70; length++) {
      const bytes = nodeRandomBytes(length);
      expect(hex(bytes)).toBe(Buffer.from(bytes).toString("hex"));
      expect(base64(bytes)).toBe(Buffer.from(bytes).toString("base64"));
      expect(base64(bytes, true)).toBe(Buffer.from(bytes).toString("base64url"));
    }
  });
});

describe("random bytes on the phone", () => {
  it("come from crypto.getRandomValues, in pieces it accepts", () => {
    const bytes = phoneRandomBytes(100_000);
    expect(bytes).toHaveLength(100_000);
    expect(new Set(bytes).size).toBeGreaterThan(200);
  });

  it("say so when the app didn't install crypto.getRandomValues", () => {
    const crypto = Object.getOwnPropertyDescriptor(globalThis, "crypto")!;
    Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true });
    try {
      expect(() => phoneRandomBytes(4)).toThrow(/getRandomValues/);
    } finally {
      Object.defineProperty(globalThis, "crypto", crypto);
    }
  });
});
