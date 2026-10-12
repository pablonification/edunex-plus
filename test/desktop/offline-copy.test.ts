// "Lihat" on a PDF opens the copy "Simpan untuk offline" put in Documents
// only when it is that very file: the copy's place goes by the material's
// title, so a lecturer's corrected upload under the same title must not show
// the old one. Edunex's size for the file has to match; unknown, Edunex's
// storage is asked instead.
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Material } from "../../src/core/models";

const documents = vi.hoisted(() => ({ path: "" }));
vi.mock("electron", () => ({ app: { getPath: () => documents.path, isPackaged: true }, dialog: {}, shell: {} }));

const { filesHandlers } = await import("../../src/desktop/handlers/files");
const { planOfflineFiles } = await import("../../src/core/course-materials");
type Context = Parameters<typeof filesHandlers>[0];

const OLD = "https://edunexfixture.blob.core.windows.net/edunex/fixture-slides-v1.pdf?sig=pretend";
const NEW = "https://edunexfixture.blob.core.windows.net/edunex/fixture-slides-v2.pdf?sig=pretend";
const pdf = (text: string) => new TextEncoder().encode(`%PDF-1.7 ${text}`);
const course = { code: "PL3002", name: "Fixture Course", edunex: { courseId: 1 } };
const slides = (url: string, sizeBytes: number | null): Material => ({
  id: 1,
  courseId: 1,
  moduleId: null,
  title: "Slides Minggu 1",
  type: "pdf",
  content: url,
  sizeBytes,
  postedAt: null,
  updatedAt: null,
});

let root: string;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "edunex-offline-"));
  documents.path = root;
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

/** Reads `material`'s file the way "Lihat" does, with the copy saved earlier already in Documents. */
async function view(material: Material, saved: Uint8Array) {
  const plan = planOfflineFiles({ code: course.code, name: course.name, mainCourseId: 1 }, undefined, [material], "id");
  const target = path.join(root, "Edunex Plus", plan.folder, ...plan.files[0].folders, plan.files[0].name);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, saved);
  const fetched: string[] = [];
  const datasets = [
    { name: "edunex.courses", value: [course] },
    { name: "edunex.materials", value: { [course.code]: [material] } },
  ];
  const context = {
    engine: { snapshot: () => ({ datasets }) },
    fetchFile: async (url: string) => {
      fetched.push(url);
      return new Response(pdf("from Edunex"));
    },
  } as unknown as Context;
  const result = await filesHandlers(context)["files.read"]({ url: material.content!, as: "pdf" });
  return { bytes: "bytes" in result ? new TextDecoder().decode(result.bytes) : null, fetched };
}

describe("a PDF saved for offline reading", () => {
  it("opens from Documents when it's the same file Edunex has", async () => {
    const saved = pdf("saved");
    expect(await view(slides(OLD, saved.byteLength), saved)).toEqual({ bytes: "%PDF-1.7 saved", fetched: [] });
  });

  it("isn't shown once the lecturer replaced it under the same title", async () => {
    const saved = pdf("saved");
    expect(await view(slides(NEW, saved.byteLength + 1000), saved)).toEqual({ bytes: "%PDF-1.7 from Edunex", fetched: [NEW] });
  });

  it("isn't trusted when Edunex doesn't say its size", async () => {
    expect(await view(slides(OLD, null), pdf("saved"))).toEqual({ bytes: "%PDF-1.7 from Edunex", fetched: [OLD] });
  });
});
