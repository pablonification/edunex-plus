// A PDF the Student picked for a hand-in, read back for the app's viewer by
// the id main gave it: only a PDF, only one main still knows, and only bytes
// that really are a PDF. Where the file is never leaves main.
import { describe, expect, it } from "vitest";
import { handInHandlers, type LocalFile } from "../../src/desktop/hand-in";
import type { Engine } from "../../src/engine/engine";
import { isEngineError } from "../../src/engine/errors";

const local = (name: string, content: string | null, size?: number): LocalFile => {
  const bytes = new TextEncoder().encode(content ?? "");
  return {
    name,
    size: size ?? bytes.byteLength,
    type: "",
    read: async () => {
      if (content === null) throw new Error("ENOENT");
      return bytes;
    },
  };
};

async function picked(files: LocalFile[]) {
  const handlers = handInHandlers({} as Engine, async () => files);
  const { files: ids } = await handlers["tasks.pickFiles"]({});
  return { read: (i: number) => handlers["tasks.readPicked"]({ fileId: ids[i]!.id }), handlers };
}

describe("a picked PDF, read back for the viewer", () => {
  it("gives a real PDF's bytes", async () => {
    const { read } = await picked([local("Bab II.pdf", "%PDF-1.7 isi")]);
    const result = await read(0);
    expect("bytes" in result && new TextDecoder().decode(result.bytes)).toBe("%PDF-1.7 isi");
  });

  it("says why instead when the file isn't really a PDF, can't be read any more, or is too big", async () => {
    const { read } = await picked([local("a.pdf", "bukan PDF"), local("b.pdf", null), local("c.pdf", "%PDF-1.7", 101 * 1024 * 1024)]);
    expect(await read(0)).toEqual({ problem: "unreadable" });
    expect(await read(1)).toEqual({ problem: "unreadable" });
    expect(await read(2)).toEqual({ problem: "too-big" });
  });

  it("never reads anything but a PDF, or a file main doesn't know", async () => {
    const { read, handlers } = await picked([local("Bab II.docx", "%PDF-1.7 disguised")]);
    expect(isEngineError(await read(0).catch((e: unknown) => e), "Rejected")).toBe(true);
    expect(isEngineError(await handlers["tasks.readPicked"]({ fileId: "not-a-picked-file" }).catch((e: unknown) => e), "Rejected")).toBe(true);
  });
});
