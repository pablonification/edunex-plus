// "Simpan salinan" in the PDF viewer: the filled-in PDF is written only where
// the Student chooses in the save dialog (Downloads, under the copy's name,
// is offered first), always as a .pdf, and only if it really is a PDF.
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isEngineError } from "../../src/engine/errors";

const system = vi.hoisted(() => ({ downloads: "", choose: null as ((offered: string) => string | null) | null, offered: [] as string[] }));
vi.mock("electron", () => ({
  app: { getPath: () => system.downloads, isPackaged: true },
  dialog: {
    showSaveDialog: async (_window: unknown, options: { defaultPath: string }) => {
      system.offered.push(options.defaultPath);
      const filePath = system.choose?.(options.defaultPath) ?? null;
      return filePath ? { canceled: false, filePath } : { canceled: true, filePath: undefined };
    },
  },
  shell: {},
}));

const { filesHandlers } = await import("../../src/desktop/handlers/files");
type Context = Parameters<typeof filesHandlers>[0];
const handlers = () => filesHandlers({ window: () => ({}) } as unknown as Context);
const pdf = new TextEncoder().encode("%PDF-1.7 diisi");

beforeEach(async () => {
  system.downloads = await fs.mkdtemp(path.join(os.tmpdir(), "edunex-copy-"));
  system.offered = [];
});
afterEach(async () => {
  await fs.rm(system.downloads, { recursive: true, force: true });
});

describe("saving a filled-in PDF", () => {
  it("offers Downloads under the copy's name, and writes it where the Student chose", async () => {
    system.choose = (offered) => offered;
    expect(await handlers()["files.saveCopy"]({ name: "Formulir KP (diisi).pdf", bytes: pdf })).toEqual({ file: "Formulir KP (diisi).pdf" });
    expect(system.offered).toEqual([path.join(system.downloads, "Formulir KP (diisi).pdf")]);
    expect(await fs.readFile(path.join(system.downloads, "Formulir KP (diisi).pdf"), "utf8")).toBe("%PDF-1.7 diisi");
  });

  it("keeps it a PDF when the Student types a name without .pdf, and its name free of folders", async () => {
    system.choose = () => path.join(system.downloads, "punyaku");
    expect(await handlers()["files.saveCopy"]({ name: "../a/b:c.pdf", bytes: pdf })).toEqual({ file: "punyaku.pdf" });
    expect(path.dirname(system.offered[0])).toBe(system.downloads);
    expect(await fs.readdir(system.downloads)).toEqual(["punyaku.pdf"]);
  });

  it("writes nothing when the Student closes the dialog, or when it isn't a PDF", async () => {
    system.choose = () => null;
    expect(await handlers()["files.saveCopy"]({ name: "Formulir.pdf", bytes: pdf })).toEqual({ file: null });
    system.choose = (offered) => offered;
    const error = await handlers()
      ["files.saveCopy"]({ name: "Formulir.pdf", bytes: new TextEncoder().encode("<html>") })
      .catch((e: unknown) => e);
    expect(isEngineError(error, "Rejected")).toBe(true);
    expect(await fs.readdir(system.downloads)).toEqual([]);
  });
});
