// A download keeps a name Android can open it by (W1): Edunex's titles often carry no extension and its
// storage links none either, so the kind comes from the server or the file's first bytes.
import { describe, expect, it } from "vitest";
import { downloadName, extensionOfBytes, extensionOfType, typeOf } from "../../mobile/src/host/file-kind";

const bytes = (...parts: (string | number[])[]) =>
  new Uint8Array(parts.flatMap((part) => (typeof part === "string" ? [...part].map((ch) => ch.charCodeAt(0)) : part)));
/** The start of an Office document: a ZIP whose first parts are [Content_Types].xml, then the program's folder. */
const office = (folder: string) => bytes([0x50, 0x4b, 0x03, 0x04], "\u0014\u0000\u0006\u0000[Content_Types].xml...PK", [3, 4], `${folder}document.xml`);

describe("downloadName", () => {
  it("keeps a title's own extension", () => {
    expect(downloadName("Slide Pengantar.pdf", { contentType: "application/zip" })).toBe("Slide Pengantar.pdf");
  });

  it("takes the server's name, then its Content-Type, then the file's bytes", () => {
    expect(downloadName("Slide Pengantar", { serverName: "abc123.pptx", contentType: "application/pdf" })).toBe("Slide Pengantar.pptx");
    expect(downloadName("Slide Pengantar", { serverName: "fixture-1", contentType: "application/pdf; charset=binary" })).toBe("Slide Pengantar.pdf");
    expect(downloadName("Slide Pengantar", { contentType: "application/octet-stream", head: bytes("%PDF-1.7") })).toBe("Slide Pengantar.pdf");
  });

  it("leaves the title as it is when nothing says the kind", () => {
    expect(downloadName("Catatan", { contentType: "application/octet-stream", head: bytes("hello") })).toBe("Catatan");
  });

  it("doesn't mistake a number in a title for an extension", () => {
    expect(downloadName("Modul v2.1", { head: bytes("%PDF") })).toBe("Modul v2.1.pdf");
  });
});

describe("extensionOfBytes", () => {
  it("knows PDFs, Office documents apart, ZIPs, pictures, video and sound", () => {
    expect(extensionOfBytes(bytes("%PDF-1.4"))).toBe(".pdf");
    expect(extensionOfBytes(office("word/"))).toBe(".docx");
    expect(extensionOfBytes(office("xl/"))).toBe(".xlsx");
    expect(extensionOfBytes(office("ppt/"))).toBe(".pptx");
    expect(extensionOfBytes(bytes([0x50, 0x4b, 0x03, 0x04], "data/readme.txt"))).toBe(".zip");
    expect(extensionOfBytes(bytes([0x89], "PNG"))).toBe(".png");
    expect(extensionOfBytes(bytes([0xff, 0xd8, 0xff, 0xe0]))).toBe(".jpg");
    expect(extensionOfBytes(bytes([0, 0, 0, 0x18], "ftypmp42"))).toBe(".mp4");
    expect(extensionOfBytes(bytes("ID3"))).toBe(".mp3");
    expect(extensionOfBytes(bytes("<html>"))).toBeNull();
  });
});

describe("types to open with", () => {
  it("names the type Android's apps register for each kind", () => {
    expect(typeOf("a.PDF")).toBe("application/pdf");
    expect(typeOf("a.docx")).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(typeOf("a")).toBeNull();
    expect(extensionOfType("image/jpg")).toBe(".jpg");
    expect(extensionOfType("binary/octet-stream")).toBeNull();
  });
});
