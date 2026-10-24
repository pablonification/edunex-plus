// How an update is cut into chunks (src/desktop/chunks.ts): the same bytes are always cut at the
// same places, however they come, so the app and the release script agree on every chunk, and a
// change in one place leaves the chunks everywhere else as they were. A chunk map is only taken when
// it adds up and stays inside what it puts together.
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CHUNKER, type Chunk, type ChunkMap, chunker, cutFile, parseChunkMap } from "../../src/desktop/chunks";

/** Made-up bytes, the same on every run: sha256 in counter mode. */
const bytes = (size: number, seed = 1) => {
  const blocks: Buffer[] = [];
  for (let i = 0; i * 32 < size; i++) blocks.push(createHash("sha256").update(`${seed}:${i}`).digest());
  return Buffer.concat(blocks).subarray(0, size);
};

function cut(data: Buffer, piece = data.length): Chunk[] {
  const chunks: Chunk[] = [];
  const cutter = chunker((chunk) => chunks.push(chunk));
  for (let at = 0; at < data.length; at += piece) cutter.push(data.subarray(at, at + piece));
  cutter.end();
  return chunks;
}

const sha256 = (data: Buffer) => createHash("sha256").update(data).digest("base64");
const sha512 = (data: Buffer) => createHash("sha512").update(data).digest("base64");

describe("cutting into chunks", () => {
  const data = bytes(3 * 1024 * 1024);

  it("cuts the same bytes at the same places, however they come", () => {
    const whole = cut(data);
    expect(cut(data, 1000)).toEqual(whole);
    expect(cut(data, 65_537)).toEqual(whole);
    expect(whole.map((chunk) => chunk.sha256)).toEqual(whole.map((chunk) => sha256(data.subarray(chunk.offset, chunk.offset + chunk.size))));
  });

  it("covers every byte once, in chunks of 16 to 256 kB (the last may be smaller)", () => {
    const chunks = cut(data);
    expect(chunks.map((chunk) => chunk.offset)).toEqual(chunks.map((_, i) => chunks.slice(0, i).reduce((sum, chunk) => sum + chunk.size, 0)));
    expect(chunks.reduce((sum, chunk) => sum + chunk.size, 0)).toBe(data.length);
    for (const chunk of chunks.slice(0, -1)) {
      expect(chunk.size).toBeGreaterThanOrEqual(16 * 1024);
      expect(chunk.size).toBeLessThanOrEqual(256 * 1024);
    }
    // Zeros only: no place is a cut, so every chunk is as long as a chunk gets.
    expect(cut(Buffer.alloc(600 * 1024)).map((chunk) => chunk.size)).toEqual([256 * 1024, 256 * 1024, 88 * 1024]);
    expect(cut(Buffer.alloc(0))).toEqual([]);
  });

  it("changes only the chunks around a change, wherever the rest moved to", () => {
    const changed = Buffer.concat([
      data.subarray(0, 1_000_000),
      Buffer.from("a few bytes more"),
      data.subarray(1_000_000, 2_000_000),
      data.subarray(2_100_000),
    ]);
    const before = new Set(cut(data).map((chunk) => chunk.sha256));
    const after = cut(changed);
    const fresh = after.filter((chunk) => !before.has(chunk.sha256));
    expect(fresh.length).toBeLessThanOrEqual(4);
    expect(after.length).toBeGreaterThan(20);
    expect(fresh.reduce((sum, chunk) => sum + chunk.size, 0)).toBeLessThan(changed.length / 5);
  });

  it("cuts a file read a piece at a time as it cuts the same bytes in one go", async () => {
    const folder = fs.mkdtempSync(path.join(os.tmpdir(), "chunks-"));
    try {
      fs.writeFileSync(path.join(folder, "file"), data);
      expect(await cutFile(path.join(folder, "file"))).toEqual(cut(data));
    } finally {
      fs.rmSync(folder, { recursive: true, force: true });
    }
  });
});

describe("a chunk map", () => {
  const one = bytes(40 * 1024, 2);
  const two = bytes(30 * 1024, 3);
  /** An app with a folder, a file of two chunks, and a link beside it. */
  const app = (): ChunkMap => ({
    format: 1,
    chunker: CHUNKER,
    source: { name: "pack", size: one.length + two.length },
    chunks: [
      [sha256(one), one.length],
      [sha256(two), two.length],
    ],
    files: [
      { path: "A.app", type: "dir", mode: 0o755 },
      { path: "A.app/Contents", type: "dir", mode: 0o755 },
      { path: "A.app/Contents/file", type: "file", mode: 0o644, size: one.length + two.length, sha512: sha512(Buffer.concat([one, two])), chunks: [0, 1] },
      { path: "A.app/Contents/Current", type: "link", target: "file" },
    ],
  });
  const parse = (map: unknown) => parseChunkMap(JSON.stringify(map));
  const changed = (change: (map: ChunkMap) => void) => {
    const map = app();
    change(map);
    return () => parse(map);
  };

  it("is taken when it adds up", () => {
    expect(parse(app())).toEqual(app());
  });

  it("is refused when it was cut another way, or its chunks don't fill their source", () => {
    expect(() => parse({ ...app(), chunker: "another" })).toThrow();
    expect(changed((map) => (map.source.size += 1))).toThrow("The chunks fill");
    expect(changed((map) => (map.chunks[0] = [sha256(one), one.length, one.length]))).toThrow("isn't smaller");
  });

  it("is refused when a file isn't the size of its chunks, or names a chunk it doesn't have", () => {
    expect(changed((map) => ((map.files[2] as { size: number }).size += 1))).toThrow("add up to");
    expect(changed((map) => ((map.files[2] as { chunks: number[] }).chunks = [0, 2]))).toThrow("doesn't have");
  });

  it("never puts anything outside its folder, or anywhere through a link", () => {
    for (const bad of ["../escape", "/etc/x", "A.app/../../x", "A.app//x", "A.app/./x", "A.app\\x"]) {
      expect(
        changed((map) => (map.files[1].path = bad)),
        bad,
      ).toThrow();
    }
    expect(changed((map) => (map.files[3] = { path: "A.app/Contents/Current", type: "link", target: "../../../etc" }))).toThrow("links outside");
    expect(changed((map) => (map.files[3] = { path: "A.app/Contents/Current", type: "link", target: "/etc" }))).toThrow("links outside");
    // Through the link: "Current" is a link, not a folder the map made.
    expect(changed((map) => map.files.push({ path: "A.app/Contents/Current/x", type: "dir", mode: 0o755 }))).toThrow("isn't in a folder");
    // A file before its folder, or the same path twice.
    expect(changed((map) => map.files.reverse())).toThrow("isn't in a folder");
    expect(changed((map) => map.files.push(map.files[1]))).toThrow("twice");
  });
});
