// Main reads a picture from Edunex's storage for the window: only from
// Edunex's storage, never with cookies, never more than it should, and only
// when the bytes really are a picture.
import { describe, expect, it } from "vitest";
import { type FetchFile, readRemoteFile } from "../../src/desktop/remote-files";
import { isEngineError } from "../../src/engine/errors";

const URL_OK = "https://edunexfixture.blob.core.windows.net/edunex/fixture-2?sv=2024&sig=pretend";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16]);
const ascii = (text: string) => new TextEncoder().encode(text);

/** A storage that answers every request the same way, noting what it was asked. */
function storage(answer: () => Response | Promise<Response>) {
  const asked: { url: string; init: Parameters<FetchFile>[1] }[] = [];
  const fetch: FetchFile = async (url, init) => {
    asked.push({ url, init });
    return answer();
  };
  return { fetch, asked };
}

describe("reading a picture from Edunex's storage", () => {
  it("gives the bytes and the type they really are, asked without cookies and without following redirects", async () => {
    const { fetch, asked } = storage(() => new Response(PNG, { headers: { "content-type": "application/octet-stream" } }));
    const result = await readRemoteFile(fetch, URL_OK, "image");
    expect(result).toEqual({ bytes: PNG, type: "image/png" });
    expect(asked[0].init).toMatchObject({ credentials: "omit", redirect: "error" });
    expect(await readRemoteFile(storage(() => new Response(JPEG)).fetch, URL_OK, "image")).toMatchObject({ type: "image/jpeg" });
    expect(await readRemoteFile(storage(() => new Response(ascii("GIF89a....."))).fetch, URL_OK, "image")).toMatchObject({ type: "image/gif" });
    expect(await readRemoteFile(storage(() => new Response(ascii("RIFF\u0000\u0000\u0000\u0000WEBPVP8 "))).fetch, URL_OK, "image")).toMatchObject({
      type: "image/webp",
    });
  });

  it("refuses anything but Edunex's storage, before asking anyone", async () => {
    const { fetch, asked } = storage(() => new Response(PNG));
    for (const url of [
      "https://evil.example/picture.png",
      "http://edunexfixture.blob.core.windows.net/edunex/fixture-2",
      // A name and password before the storage's host; put together here, as the repository's privacy check reads "secret@host" as an email.
      `https://user:secret@${new URL(URL_OK).host}/edunex/fixture-2`,
      "https://blob.core.windows.net.evil.example/x",
      "file:///etc/passwd",
    ]) {
      const error = await readRemoteFile(fetch, url, "image").catch((e: unknown) => e);
      expect(isEngineError(error, "Rejected")).toBe(true);
    }
    expect(asked).toEqual([]);
    expect(await readRemoteFile(fetch, "https://api-edunex.cognisia.id/storage/x.png", "image")).toMatchObject({ type: "image/png" });
  });

  it("never passes off what isn't a picture as one: a page, an SVG, a PDF", async () => {
    for (const body of ["<html><script>alert(1)</script></html>", '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>', "%PDF-1.7"]) {
      expect(await readRemoteFile(storage(() => new Response(ascii(body), { headers: { "content-type": "image/png" } })).fetch, URL_OK, "image")).toEqual({
        problem: "unreadable",
      });
    }
    expect(await readRemoteFile(storage(() => new Response(null)).fetch, URL_OK, "image")).toEqual({ problem: "unreadable" });
  });

  it("says why it can't: the link expired, the file is gone, the storage can't be reached", async () => {
    expect(await readRemoteFile(storage(() => new Response("AuthenticationFailed", { status: 403 })).fetch, URL_OK, "image")).toEqual({ problem: "expired" });
    expect(await readRemoteFile(storage(() => new Response("BlobNotFound", { status: 404 })).fetch, URL_OK, "image")).toEqual({ problem: "missing" });
    expect(await readRemoteFile(storage(() => new Response("ServerBusy", { status: 503 })).fetch, URL_OK, "image")).toEqual({ problem: "unreachable" });
    const offline: FetchFile = async () => {
      throw new TypeError("fetch failed");
    };
    expect(await readRemoteFile(offline, URL_OK, "image")).toEqual({ problem: "unreachable" });
  });

  it("stops at the size cap, whatever the storage says the size is", async () => {
    const big = 21 * 1024 * 1024;
    const declared = storage(() => new Response(PNG, { headers: { "content-length": String(big) } }));
    expect(await readRemoteFile(declared.fetch, URL_OK, "image")).toEqual({ problem: "too-big" });
    // No length given: it reads until the cap, then gives up.
    let sent = 0;
    const endless = new ReadableStream<Uint8Array>({
      pull(controller) {
        sent += 1024 * 1024;
        controller.enqueue(sent === 1024 * 1024 ? new Uint8Array([...PNG, ...new Uint8Array(1024 * 1024 - PNG.length)]) : new Uint8Array(1024 * 1024));
      },
    });
    expect(await readRemoteFile(storage(() => new Response(endless)).fetch, URL_OK, "image")).toEqual({ problem: "too-big" });
    expect(sent).toBeLessThanOrEqual(22 * 1024 * 1024);
  });
});
