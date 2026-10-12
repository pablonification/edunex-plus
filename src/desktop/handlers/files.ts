// Bridge handler for reading a file from Edunex into the window (pictures in
// lecturers' notes, PDFs in the viewer). The rules live in ../remote-files.ts;
// here are where copies on this computer live: the app's file cache (wiped at
// sign-out) and the Student's own offline copies under Documents.
import { promises as fs } from "node:fs";
import path from "node:path";
import { planOfflineFiles } from "../../core/course-materials";
import type { DatasetName, DatasetValue } from "../../core/models";
import { createFileCache, FILE_CACHE_FOLDER } from "../file-cache";
import { LIMITS, readFile } from "../remote-files";
import type { DesktopContext, HandlerGroup } from "./context";
import { offlineRoot } from "./course-page";

export const filesHandlers: HandlerGroup<"files.read"> = (context) => {
  const cache = createFileCache(path.join(context.userData, FILE_CACHE_FOLDER));
  return {
    "files.read": ({ url, as }) =>
      readFile({ fetch: context.fetchFile, cache, offline: as === "pdf" ? (address) => offlineCopy(context, address) : undefined }, url, as),
  };
};

/** The copy "Simpan untuk offline" saved of this file, if it's still in its place (Documents/Edunex Plus/<course>/<module>/). */
async function offlineCopy(context: DesktopContext, url: string): Promise<Uint8Array | null> {
  const datasets = context.engine.snapshot().datasets;
  const dataset = <N extends DatasetName>(name: N) => datasets.find((d) => d.name === name)?.value as DatasetValue<N> | undefined;
  for (const [code, materials] of Object.entries(dataset("edunex.materials") ?? {})) {
    if (!materials.some((m) => m.content?.trim() === url)) continue;
    const course = dataset("edunex.courses")?.find((c) => c.code === code);
    if (!course) continue;
    // The joint class's folder is named in the language the Student saved in.
    for (const lang of ["id", "en"] as const) {
      const plan = planOfflineFiles({ code, name: course.name, mainCourseId: course.edunex.courseId }, dataset("edunex.outline")?.[code], materials, lang);
      const file = plan.files.find((f) => f.url === url);
      if (!file) continue;
      const target = path.join(offlineRoot(), plan.folder, ...file.folders, file.name);
      const stat = await fs.stat(target).catch(() => null);
      if (stat?.isFile() && stat.size <= LIMITS.pdf.bytes) return new Uint8Array(await fs.readFile(target));
    }
  }
  return null;
}
