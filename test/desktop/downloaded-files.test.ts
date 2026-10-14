// "Unduh" on a file the app already downloaded opens that copy instead of
// saving "Notes (2).docx" next to it, as long as it's still there as it was
// and Edunex hasn't got a corrected file under it; a copy "Simpan untuk
// offline" saved opens first. What the app remembers is named by a hash, gone
// on a wipe, and nothing at all while nobody is signed in. Runs the real
// handler with Electron's download and opening stood in for.
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Material } from "../../src/core/models";

const system = vi.hoisted(() => ({ root: "", opened: [] as string[], downloads: 0 }));
vi.mock("electron", () => ({
  app: { getPath: () => system.root, isPackaged: true },
  dialog: {},
  shell: {
    openPath: async (file: string) => {
      system.opened.push(file);
      return "";
    },
  },
}));
// The browser's download manager: saves under a free name in Downloads, as the real one does.
vi.mock("../../src/desktop/downloads", async (original) => ({
  ...(await original<typeof import("../../src/desktop/downloads")>()),
  download: async (_contents: unknown, _url: string, name: string) => {
    system.downloads += 1;
    const folder = path.join(system.root, "Downloads");
    await fs.mkdir(folder, { recursive: true });
    const ext = path.extname(name);
    let file = path.join(folder, name);
    for (let n = 2; await fs.stat(file).catch(() => null); n++) file = path.join(folder, `${name.slice(0, -ext.length)} (${n})${ext}`);
    await fs.writeFile(file, CONTENT);
    return file;
  },
}));

const { coreHandlers } = await import("../../src/desktop/handlers/core");
const { createDownloadedFiles, DOWNLOADED_FILES_FOLDER } = await import("../../src/desktop/downloaded-files");
const { planOfflineFiles } = await import("../../src/core/course-materials");
type Context = Parameters<typeof coreHandlers>[0];

const URL = "https://edunexfixture.blob.core.windows.net/edunex/fixture-notes.docx?sig=pretend";
const CONTENT = "fixture notes";
const course = { code: "PL3002", name: "Fixture Course", edunex: { courseId: 1 } };
const notes = (sizeBytes: number | null): Material => ({
  id: 1,
  courseId: 1,
  moduleId: null,
  title: "Catatan Minggu 1",
  type: "docx",
  content: URL,
  sizeBytes,
  postedAt: null,
  updatedAt: null,
});

beforeEach(async () => {
  system.root = await fs.mkdtemp(path.join(os.tmpdir(), "edunex-downloaded-"));
  system.opened = [];
  system.downloads = 0;
});
afterEach(async () => {
  await fs.rm(system.root, { recursive: true, force: true });
});

/** The app with this material on Edunex; `nim`: who is signed in. */
function app(material: Material | null, nim: string | null = "10000001") {
  const downloadedFiles = createDownloadedFiles(path.join(system.root, DOWNLOADED_FILES_FOLDER), { owner: () => nim });
  const datasets = material
    ? [
        { name: "edunex.courses", value: [course] },
        { name: "edunex.materials", value: { [course.code]: [material] } },
      ]
    : [];
  const context = { engine: { snapshot: () => ({ datasets }) }, window: () => ({ webContents: {} }), downloadedFiles } as unknown as Context;
  const unduh = () => coreHandlers(context)["files.download"]({ url: URL, name: "Notes.docx" });
  return { unduh, downloadedFiles };
}

const inDownloads = (name: string) => path.join(system.root, "Downloads", name);

describe("downloading a file again", () => {
  it("opens the copy downloaded before instead of saving another", async () => {
    const { unduh } = app(notes(CONTENT.length));
    expect(await unduh()).toEqual({ path: inDownloads("Notes.docx"), existing: false });
    expect(await unduh()).toEqual({ path: inDownloads("Notes.docx"), existing: true });
    expect(system.downloads).toBe(1);
    expect(system.opened).toEqual([inDownloads("Notes.docx")]);
    expect(await fs.readdir(path.join(system.root, "Downloads"))).toEqual(["Notes.docx"]);
  });

  it("downloads afresh once the copy was deleted or changed", async () => {
    const { unduh } = app(notes(null));
    await unduh();
    await fs.rm(inDownloads("Notes.docx"));
    expect(await unduh()).toEqual({ path: inDownloads("Notes.docx"), existing: false });
    // The Student wrote in their copy: it stays theirs, and Edunex's file comes down beside it.
    await fs.appendFile(inDownloads("Notes.docx"), " and my own notes");
    expect(await unduh()).toEqual({ path: inDownloads("Notes (2).docx"), existing: false });
    expect(system.downloads).toBe(3);
  });

  it("downloads afresh when Edunex has the file at another size (a corrected upload)", async () => {
    await app(notes(CONTENT.length)).unduh();
    expect(await app(notes(CONTENT.length + 100)).unduh()).toEqual({ path: inDownloads("Notes (2).docx"), existing: false });
  });

  it("opens the copy saved for offline first, when it's this very file", async () => {
    const material = notes(CONTENT.length);
    const plan = planOfflineFiles({ code: course.code, name: course.name, mainCourseId: 1 }, undefined, [material], "id");
    const saved = path.join(system.root, "Edunex Plus", plan.folder, ...plan.files[0].folders, plan.files[0].name);
    await fs.mkdir(path.dirname(saved), { recursive: true });
    await fs.writeFile(saved, CONTENT);
    expect(await app(material).unduh()).toEqual({ path: saved, existing: true });
    expect(system.opened).toEqual([saved]);
    // Edunex's file is another size now: the offline copy is the old one.
    expect(await app(notes(CONTENT.length + 100)).unduh()).toMatchObject({ existing: false });
    expect(system.downloads).toBe(1);
  });

  it("never opens another Student's download", async () => {
    await app(notes(CONTENT.length), "10000001").unduh();
    // Their records not emptied yet (another Student signed in while the app was closed).
    expect(await app(notes(CONTENT.length), "10000002").unduh()).toEqual({ path: inDownloads("Notes (2).docx"), existing: false });
    expect(await app(notes(CONTENT.length), "10000001").unduh()).toMatchObject({ existing: false });
  });

  it("remembers nothing while nobody is signed in", async () => {
    const { unduh } = app(null, null);
    await unduh();
    expect(await unduh()).toMatchObject({ existing: false });
    expect(system.downloads).toBe(2);
    expect(await fs.readdir(path.join(system.root, DOWNLOADED_FILES_FOLDER)).catch(() => [])).toEqual([]);
  });
});

describe("what the app remembers of downloads", () => {
  it("is named by a hash, says nothing of the file in its names, and knows a re-signed address", async () => {
    const { unduh, downloadedFiles } = app(null);
    await unduh();
    const names = await fs.readdir(path.join(system.root, DOWNLOADED_FILES_FOLDER));
    expect(names).toHaveLength(1);
    expect(names[0]).toMatch(/^[0-9a-f]{64}$/);
    expect(await downloadedFiles.find(URL.replace("sig=pretend", "sig=another"))).toBe(inDownloads("Notes.docx"));
  });

  it("is gone after a wipe, and a download that spanned one isn't remembered", async () => {
    const { unduh, downloadedFiles } = app(null);
    await unduh();
    const since = downloadedFiles.generation();
    await downloadedFiles.clear();
    expect(await downloadedFiles.find(URL)).toBeNull();
    await downloadedFiles.record(URL, inDownloads("Notes.docx"), since);
    expect(await downloadedFiles.find(URL)).toBeNull();
  });
});
