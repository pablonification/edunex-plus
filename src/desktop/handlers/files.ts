// Bridge handler for reading a file from Edunex into the window (pictures in
// lecturers' notes, PDFs in the viewer). The rules live in ../remote-files.ts;
// here are where copies on this computer live: the app's file cache (the
// signed-in Student's, wiped at sign-out) and the Student's own offline
// copies under Documents.
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Event } from "../../core/contract";
import { planOfflineFiles } from "../../core/course-materials";
import type { DatasetName, DatasetValue } from "../../core/models";
import type { Engine } from "../../engine/engine";
import type { FileCache } from "../file-cache";
import { LIMITS, readFile } from "../remote-files";
import type { DesktopContext, HandlerGroup } from "./context";
import { offlineRoot } from "./course-page";

export const filesHandlers: HandlerGroup<"files.read"> = (context) => ({
  "files.read": ({ url, as }) =>
    readFile({ fetch: context.fetchFile, cache: context.fileCache, offline: as === "pdf" ? (address) => offlineCopy(context, address) : undefined }, url, as),
});

/** Who is signed in to Edunex (their NIM): the files the app keeps are theirs. */
export function edunexNim(engine: Engine): string | null {
  const account = engine.snapshot().datasets.find((d) => d.name === "edunex.account")?.value as DatasetValue<"edunex.account"> | undefined;
  return account?.nim ?? null;
}

/**
 * Follows the engine's events and empties the file cache the moment another
 * Student's Edunex account arrives (one who signed in after the last one's
 * session ran out, with no sign-out between), as the engine forgets the last
 * one's data then. `nim`: who was signed in when the app started.
 */
export function forgetOtherStudentsFiles(cache: FileCache, nim: string | null): (event: Event) => Promise<void> {
  let last = nim;
  return async (event) => {
    if (event.type !== "dataset" || event.dataset.name !== "edunex.account") return;
    // The engine removes the last Student's account before it sets the new one; `last` stays theirs through that.
    const next = (event.dataset.value as DatasetValue<"edunex.account">).nim;
    const other = last !== null && next !== last;
    last = next;
    if (other) await cache.clear().catch(() => undefined);
  };
}

/**
 * The copy "Simpan untuk offline" saved of this file, if it's still in its
 * place (Documents/Edunex Plus/<course>/<module>/) and is this very file: the
 * place goes by title, and a lecturer's corrected upload under the same title
 * would otherwise show the old one. Edunex's size for it must match; unknown,
 * the copy isn't trusted.
 */
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
      if (stat?.isFile() && file.sizeBytes !== null && stat.size === file.sizeBytes && stat.size <= LIMITS.pdf.bytes)
        return new Uint8Array(await fs.readFile(target));
    }
  }
  return null;
}
