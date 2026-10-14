// Main reads a picture from Edunex's storage for the window: only from
// Edunex's storage, never with cookies, never more than it should, and only
// when the bytes really are a picture. And the same for a PDF, a Word
// document, an Excel workbook and text, each checked for what it claims to be.
import { describe, expect, it } from "vitest";
import { type FetchFile, readRemoteFile, sniff, UNPACKED_MAX, zipContents } from "../../src/desktop/remote-files";
import { isEngineError } from "../../src/engine/errors";
import { aDocx, anXlsx, aZip } from "../kit/office-files";

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

  it("a PDF is one when it starts like one (within its first kilobyte), up to 100 MB", async () => {
    expect(await readRemoteFile(storage(() => new Response(ascii("%PDF-1.7\n…"))).fetch, URL_OK, "pdf")).toMatchObject({ type: "application/pdf" });
    expect(await readRemoteFile(storage(() => new Response(ascii(`${" ".repeat(300)}%PDF-1.4`))).fetch, URL_OK, "pdf")).toMatchObject({
      type: "application/pdf",
    });
    expect(await readRemoteFile(storage(() => new Response(PNG)).fetch, URL_OK, "pdf")).toEqual({ problem: "unreadable" });
    expect(await readRemoteFile(storage(() => new Response(ascii("<html>%PDF-1.4"))).fetch, URL_OK, "image")).toEqual({ problem: "unreadable" });
    const big = storage(() => new Response(ascii("%PDF-1.7"), { headers: { "content-length": String(101 * 1024 * 1024) } }));
    expect(await readRemoteFile(big.fetch, URL_OK, "pdf")).toEqual({ problem: "too-big" });
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

describe("reading a Word document, a workbook or text", () => {
  const read = (bytes: Uint8Array, as: Parameters<typeof readRemoteFile>[2]) =>
    readRemoteFile(storage(() => new Response(new Uint8Array(bytes))).fetch, URL_OK, as);

  it("a Word document or a workbook is a whole ZIP with its own main part inside", async () => {
    const docx = await aDocx({ lines: ["Notulen"] });
    const xlsx = await anXlsx({ Lembar1: [["a"]] });
    expect(await read(docx, "docx")).toMatchObject({ type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
    expect(await read(xlsx, "xlsx")).toMatchObject({ type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    // Each is only what it is: a workbook isn't a Word document, nor the other way round.
    expect(await read(xlsx, "docx")).toEqual({ problem: "unreadable" });
    expect(await read(docx, "xlsx")).toEqual({ problem: "unreadable" });
    // A ZIP without the part, one cut short, and a page passed off as one.
    expect(await read(await aZip({ "[Content_Types].xml": "<Types/>", "README.txt": "hai" }), "docx")).toEqual({ problem: "unreadable" });
    expect(await read(docx.subarray(0, docx.length - 30), "docx")).toEqual({ problem: "unreadable" });
    expect(await read(ascii("PK\u0003\u0004<html><script>alert(1)</script>"), "docx")).toEqual({ problem: "unreadable" });
  });

  it("a ZIP that would unpack to more than the window can hold isn't read in", async () => {
    const docx = await aDocx({ lines: ["Notulen"] });
    expect(zipContents(docx)?.names).toContain("word/document.xml");
    // The central directory's record for a part says it unpacks to just past the cap.
    const bomb = docx.slice();
    const view = new DataView(bomb.buffer);
    for (let at = 0; at < bomb.length - 4; at++)
      if (view.getUint32(at, true) === 0x02014b50) {
        view.setUint32(at + 24, UNPACKED_MAX + 1, true);
        break;
      }
    expect(zipContents(bomb)?.unpacked).toBeGreaterThan(UNPACKED_MAX);
    expect(sniff(bomb, "docx")).toBeNull();
  });

  it("text is UTF-8 with no control characters but tabs and line breaks", async () => {
    expect(await read(ascii("def halo():\n\tprint('Halo, ITB')\r\n"), "text")).toEqual({
      bytes: ascii("def halo():\n\tprint('Halo, ITB')\r\n"),
      type: "text/plain",
    });
    expect(await read(ascii("Catatan: énergie, ±5 °C, 日本語"), "text")).toMatchObject({ type: "text/plain" });
    expect(await read(new Uint8Array(), "text")).toMatchObject({ type: "text/plain" });
    // Not UTF-8 (Latin-1's é), and binary files: a picture, a ZIP, a NUL.
    expect(await read(new Uint8Array([0x63, 0x61, 0x66, 0xe9]), "text")).toEqual({ problem: "unreadable" });
    expect(await read(PNG, "text")).toEqual({ problem: "unreadable" });
    expect(await read(await aZip({ "a.txt": "a" }), "text")).toEqual({ problem: "unreadable" });
    expect(await read(ascii("teks\u0000biner"), "text")).toEqual({ problem: "unreadable" });
  });

  it("each kind has its own size cap: Word 50 MB, Excel 20 MB, text 5 MB", async () => {
    const sized = (mb: number) => storage(() => new Response(ascii("a"), { headers: { "content-length": String(mb * 1024 * 1024) } })).fetch;
    expect(await readRemoteFile(sized(51), URL_OK, "docx")).toEqual({ problem: "too-big" });
    expect(await readRemoteFile(sized(21), URL_OK, "xlsx")).toEqual({ problem: "too-big" });
    expect(await readRemoteFile(sized(6), URL_OK, "text")).toEqual({ problem: "too-big" });
    expect(await readRemoteFile(sized(4), URL_OK, "text")).toMatchObject({ type: "text/plain" });
  });
});
