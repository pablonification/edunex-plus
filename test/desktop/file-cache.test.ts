// Files the window showed are kept so opening one again is instant and works
// offline: named by a hash, the oldest dropped past the size cap, all gone on
// sign-out. Reading prefers a copy on this computer and checks it the same way.
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createFileCache } from "../../src/desktop/file-cache";
import { type FetchFile, readFile } from "../../src/desktop/remote-files";

let root: string;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "edunex-file-cache-"));
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

const URL_A = "https://edunexfixture.blob.core.windows.net/edunex/fixture-1?sig=a";
const URL_B = "https://edunexfixture.blob.core.windows.net/edunex/fixture-2?sig=b";
const URL_C = "https://edunexfixture.blob.core.windows.net/edunex/fixture-3?sig=c";
const pdf = (size: number) => {
  const bytes = new Uint8Array(size);
  bytes.set(new TextEncoder().encode("%PDF-1.7"));
  return bytes;
};

describe("the file cache", () => {
  it("keeps files under names that say nothing about them, and drops the least recently opened past its size", async () => {
    const cache = createFileCache(root, 250);
    await cache.put(URL_A, pdf(100));
    await cache.put(URL_B, pdf(100));
    expect((await fs.readdir(root)).every((name) => /^[0-9a-f]{64}$/.test(name))).toBe(true);
    expect((await fs.readdir(root)).join()).not.toContain("fixture");
    // A was opened again just now, so B is the one to go when C arrives.
    const old = new Date(Date.now() - 60_000);
    for (const name of await fs.readdir(root)) await fs.utimes(path.join(root, name), old, old);
    expect(await cache.get(URL_A)).toEqual(pdf(100));
    await cache.put(URL_C, pdf(100));
    expect(await cache.get(URL_B)).toBeNull();
    expect(await cache.get(URL_A)).not.toBeNull();
    expect(await cache.get(URL_C)).not.toBeNull();
    await cache.clear();
    expect(await cache.get(URL_A)).toBeNull();
  });

  it("reading takes a copy on this computer first, checked like a download, and keeps what it fetched", async () => {
    const cache = createFileCache(root);
    let fetched = 0;
    const fetch: FetchFile = async () => {
      fetched += 1;
      return new Response(pdf(64));
    };
    // The Student's offline copy is used without asking the storage.
    expect(await readFile({ fetch, cache, offline: async () => pdf(32) }, URL_A, "pdf")).toEqual({ bytes: pdf(32), type: "application/pdf" });
    expect(fetched).toBe(0);
    // A copy that isn't a PDF any more is passed over.
    expect(await readFile({ fetch, cache, offline: async () => new TextEncoder().encode("not a pdf") }, URL_B, "pdf")).toMatchObject({
      type: "application/pdf",
    });
    expect(fetched).toBe(1);
    // What was fetched is kept: the second look doesn't ask again.
    expect(await readFile({ fetch, cache }, URL_B, "pdf")).toEqual({ bytes: pdf(64), type: "application/pdf" });
    expect(fetched).toBe(1);
    // A problem isn't kept.
    const gone: FetchFile = async () => new Response("BlobNotFound", { status: 404 });
    expect(await readFile({ fetch: gone, cache }, URL_C, "pdf")).toEqual({ problem: "missing" });
    expect(await cache.get(URL_C)).toBeNull();
  });
});
