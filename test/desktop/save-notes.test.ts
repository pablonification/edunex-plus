// A file's highlights and notes going out of the app: "Simpan sebagai
// Markdown…" writes them only where the Student chooses in the save dialog
// (Downloads, under the file's name, is offered first), always as a .md file
// and with no folder in its name; "Salin" puts them on the clipboard.
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const system = vi.hoisted(() => ({
  downloads: "",
  choose: null as ((offered: string) => string | null) | null,
  offered: [] as { path: string; extensions: string[] }[],
  clipboard: [] as string[],
}));
vi.mock("electron", () => ({
  app: { getPath: () => system.downloads, isPackaged: true },
  clipboard: { writeText: (text: string) => system.clipboard.push(text) },
  dialog: {
    showSaveDialog: async (_window: unknown, options: { defaultPath: string; filters: { extensions: string[] }[] }) => {
      system.offered.push({ path: options.defaultPath, extensions: options.filters.flatMap((filter) => filter.extensions) });
      const filePath = system.choose?.(options.defaultPath) ?? null;
      return filePath ? { canceled: false, filePath } : { canceled: true, filePath: undefined };
    },
  },
  shell: {},
}));

const { filesHandlers } = await import("../../src/desktop/handlers/files");
type Context = Parameters<typeof filesHandlers>[0];
const handlers = () => filesHandlers({ window: () => ({}) } as unknown as Context);
const MARKDOWN = "# Slide Pengantar Proposal TA.pdf\n\n## Halaman 1\n\n- Poin utama untuk pertemuan ini. _(kuning)_\n";

beforeEach(async () => {
  system.downloads = await fs.mkdtemp(path.join(os.tmpdir(), "edunex-notes-"));
  system.offered = [];
  system.clipboard = [];
});
afterEach(async () => {
  await fs.rm(system.downloads, { recursive: true, force: true });
});

describe("a file's highlights and notes going out", () => {
  it("offers Downloads under the file's name as Markdown, and writes it where the Student chose", async () => {
    system.choose = (offered) => offered;
    const saved = await handlers()["files.saveNotes"]({ name: "Slide Pengantar Proposal TA (catatan)", text: MARKDOWN });
    expect(saved).toEqual({ file: "Slide Pengantar Proposal TA (catatan).md" });
    expect(system.offered).toEqual([{ path: path.join(system.downloads, "Slide Pengantar Proposal TA (catatan).md"), extensions: ["md"] }]);
    expect(await fs.readFile(path.join(system.downloads, "Slide Pengantar Proposal TA (catatan).md"), "utf8")).toBe(MARKDOWN);
  });

  it("keeps it a .md file whatever name the Student types, and its name free of folders", async () => {
    system.choose = () => path.join(system.downloads, "ringkasan");
    expect(await handlers()["files.saveNotes"]({ name: "../a/b:c", text: MARKDOWN })).toEqual({ file: "ringkasan.md" });
    expect(path.dirname(system.offered[0].path)).toBe(system.downloads);
    expect(await fs.readdir(system.downloads)).toEqual(["ringkasan.md"]);
  });

  it("writes nothing when the Student closes the dialog", async () => {
    system.choose = () => null;
    expect(await handlers()["files.saveNotes"]({ name: "Slide (catatan)", text: MARKDOWN })).toEqual({ file: null });
    expect(await fs.readdir(system.downloads)).toEqual([]);
  });

  it("puts them on the clipboard", async () => {
    expect(await handlers()["files.copyNotes"]({ text: MARKDOWN })).toEqual({});
    expect(system.clipboard).toEqual([MARKDOWN]);
  });
});
