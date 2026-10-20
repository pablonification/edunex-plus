// Bridge handler for reading a file from Edunex into the window (pictures in
// lecturers' notes; PDFs, Word documents, spreadsheets, PowerPoint slides,
// text and old Office files in the viewer). The rules live in
// ../remote-files.ts; here are where copies on this computer live: the app's
// file cache (the signed-in Student's, wiped at sign-out), the Student's own
// offline copies under Documents, for every kind, and the files the app
// downloaded for them, which "Unduh" opens again instead of downloading twice.
// And saving a PDF filled in the app, only where the Student chooses in the
// save dialog; and opening a copy on this computer in the app they pick, or
// showing it in its folder.
import { promises as fs } from "node:fs";
import path from "node:path";
import { app, dialog, shell } from "electron";
import type { Event } from "../../core/contract";
import { planOfflineFiles } from "../../core/course-materials";
import type { DatasetName, DatasetValue } from "../../core/models";
import type { Engine } from "../../engine/engine";
import { EngineError } from "../../engine/errors";
import type { DownloadedFiles } from "../downloaded-files";
import { isDownloadable, safeName } from "../downloads";
import type { FileCache } from "../file-cache";
import { appsFor, openFile } from "../open-with";
import { LIMITS, readFile, sniff } from "../remote-files";
import type { DesktopContext, HandlerGroup } from "./context";
import { offlineRoot } from "./course-page";

export const filesHandlers: HandlerGroup<"files.read" | "files.saveCopy" | "files.local" | "files.open" | "files.reveal"> = (context) => ({
  "files.read": ({ url, as }) =>
    readFile({ fetch: context.fetchFile, cache: context.fileCache, offline: (address) => offlineCopy(context, address, LIMITS[as].bytes) }, url, as),
  "files.saveCopy": async ({ name, bytes }) => {
    if (!sniff(bytes, "pdf")) throw new EngineError("Rejected", "Only a PDF is saved from the viewer");
    const window = context.window();
    if (!window) throw new EngineError("Failed", "The window is closed");
    // The dialog asks before it replaces a file that's already there.
    const chosen = await dialog.showSaveDialog(window, {
      defaultPath: path.join(app.getPath("downloads"), pdfName(safeName(name))),
      filters: [{ name: "PDF", extensions: ["pdf"] }],
    });
    if (chosen.canceled || !chosen.filePath) return { file: null };
    const file = pdfName(chosen.filePath);
    await fs.writeFile(file, bytes);
    return { file: path.basename(file) };
  },
  "files.local": async ({ url }) => {
    const file = isDownloadable(url) ? await copyOnThisComputer(context, url) : null;
    if (!file) return null;
    const { apps, own, chooser } = await appsFor(file);
    const last = context.engine.snapshot().settings.openWith[kindOf(file)];
    const preferred = apps.some((found) => found.id === last) ? last : (own ?? apps[0]?.id ?? null);
    return { name: path.basename(file), apps, preferred, chooser };
  },
  "files.open": async ({ url, app: appId, choose }) => {
    const file = await localCopy(context, url);
    await openFile(file, { appId, choose });
    // The next file of its kind opens there too.
    const settings = context.engine.snapshot().settings;
    const kind = kindOf(file);
    if (appId && kind && settings.openWith[kind] !== appId) await context.engine.updateSettings({ openWith: { ...settings.openWith, [kind]: appId } });
    return {};
  },
  "files.reveal": async ({ url }) => {
    shell.showItemInFolder(await localCopy(context, url));
    return {};
  },
});

/** The copy of an Edunex file on this computer, or a refusal: the window never names a place itself. */
async function localCopy(context: DesktopContext, url: string): Promise<string> {
  const file = isDownloadable(url) ? await copyOnThisComputer(context, url) : null;
  if (!file) throw new EngineError("Rejected", "That file isn't on this computer");
  return file;
}

/** What `openWith` remembers an app by: the file's extension, lowercase (".pdf"); "" without one. */
const kindOf = (file: string) => path.extname(file).toLowerCase().slice(0, 16);

/** A file name that ends in ".pdf", whatever the Student typed. */
export const pdfName = (name: string) => (/\.pdf$/i.test(name) ? name : `${name}.pdf`);

/** Who is signed in to Edunex (their NIM): the files the app keeps are theirs. */
export function edunexNim(engine: Engine): string | null {
  const account = engine.snapshot().datasets.find((d) => d.name === "edunex.account")?.value as DatasetValue<"edunex.account"> | undefined;
  return account?.nim ?? null;
}

/**
 * Follows the engine's events and empties the file cache and the record of
 * downloads the moment another Student's Edunex account arrives (one who
 * signed in after the last one's session ran out, with no sign-out between),
 * as the engine forgets the last one's data then. `nim`: who was signed in
 * when the app started.
 */
export function forgetOtherStudentsFiles(kept: Pick<FileCache | DownloadedFiles, "clear">[], nim: string | null): (event: Event) => Promise<void> {
  let last = nim;
  return async (event) => {
    if (event.type !== "dataset" || event.dataset.name !== "edunex.account") return;
    // The engine removes the last Student's account before it sets the new one; `last` stays theirs through that.
    const next = (event.dataset.value as DatasetValue<"edunex.account">).nim;
    const other = last !== null && next !== last;
    last = next;
    if (other) await Promise.all(kept.map((files) => files.clear().catch(() => undefined)));
  };
}

/**
 * The copy of this file already on this computer, for "Unduh" to open instead
 * of downloading it again: the one "Simpan untuk offline" saved, else the one
 * the app downloaded before, while it's unchanged and Edunex's size for the
 * file (when known) still matches. Only places the app planned or recorded
 * itself, never one the window names.
 */
export async function copyOnThisComputer(context: DesktopContext, url: string): Promise<string | null> {
  const offline = await offlineFile(context, url);
  if (offline) return offline.file;
  // A lecturer's file on a Task isn't a material: its copy is checked without Edunex's size.
  const materials = context.engine.snapshot().datasets.find((d) => d.name === "edunex.materials")?.value as DatasetValue<"edunex.materials"> | undefined;
  const material = Object.values(materials ?? {})
    .flat()
    .find((m) => m.content?.trim() === url);
  return context.downloadedFiles.find(url, material?.sizeBytes);
}

/** The offline copy's bytes, for the viewer to read instead of Edunex's storage; `max`: the most its kind may be. */
async function offlineCopy(context: DesktopContext, url: string, max: number): Promise<Uint8Array | null> {
  const copy = await offlineFile(context, url);
  return copy && copy.size <= max ? new Uint8Array(await fs.readFile(copy.file)) : null;
}

/**
 * The copy "Simpan untuk offline" saved of this file, if it's still in its
 * place (Documents/Edunex Plus/<course>/<module>/) and is this very file: the
 * place goes by title, and a lecturer's corrected upload under the same title
 * would otherwise show the old one. Edunex's size for it must match; unknown,
 * the copy isn't trusted.
 */
async function offlineFile(context: DesktopContext, url: string): Promise<{ file: string; size: number } | null> {
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
      if (stat?.isFile() && file.sizeBytes !== null && stat.size === file.sizeBytes) return { file: target, size: stat.size };
    }
  }
  return null;
}
