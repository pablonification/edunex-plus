// How each Edunex material is offered on the course page (#74), the way
// Edunex's own course page shows it: a note drawn right on the page, a file
// to download, an online class to join, a picture, a lecturer's link to open
// in the browser, or Edunex itself when the app can't do better. Also how a
// course's files are laid out when the Student saves them for offline
// reading: Edunex Plus/<course>/<module>/<file>.
import { EDUNEX_WEB, edunexCourseUrl, isOfficialUrl, isWebLink } from "./links";
import type { CourseModule, CourseOutline, Material } from "./models";
import { type Lang, translate } from "./strings";

export type MaterialKind = "pdf" | "vicon" | "note" | "video" | "audio" | "link" | "file" | "image" | "page" | "interactive" | "other";

/** Edunex's online-class (Vicon) types and the service each one is. */
export const VICON_PROVIDERS: Readonly<Record<string, string>> = {
  "ms-teams": "Microsoft Teams",
  zoom: "Zoom",
  "google-meet": "Google Meet",
  cloudx: "CloudX",
  webex: "Webex",
};

/** Edunex's own content types, as its website's course page reads them (`contentReaders`, checked 2026-10-12). */
const KINDS: Readonly<Record<string, MaterialKind>> = {
  pdf: "pdf",
  text: "note",
  video: "video",
  audio: "audio",
  url: "link",
  file: "file",
  // A whiteboard: Edunex shows it as a picture.
  board: "image",
  // A web page Edunex shows inside its own page.
  html: "page",
  scorm: "interactive",
  h5p: "interactive",
};
/** Edunex labels other uploads by their extension: "zip", "ppt", "docx"… */
const UPLOAD_TYPE = /^[a-z0-9]{2,5}$/;

export function materialKind(type: string): MaterialKind {
  if (Object.hasOwn(VICON_PROVIDERS, type)) return "vicon";
  if (Object.hasOwn(KINDS, type)) return KINDS[type];
  return UPLOAD_TYPE.test(type) ? "file" : "other";
}

/** An upload's extension as Edunex's type names it (".zip"); null for Edunex's own kinds. */
export function uploadExtension(type: string): string | null {
  return materialKind(type) === "file" && type !== "file" ? `.${type}` : null;
}

/** Where Edunex keeps files: its storage on Azure, its API, ITB's own sites (as the desktop's download guard). */
const FILE_HOSTS = [/\.blob\.core\.windows\.net$/, /^api-edunex\.cognisia\.id$/, /(^|\.)itb\.ac\.id$/];

export function isEdunexFile(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && FILE_HOSTS.some((pattern) => pattern.test(parsed.hostname));
  } catch {
    return false;
  }
}

/** A material's own place on Edunex's website: its module's page, or the course's. */
export function edunexMaterialUrl(material: Pick<Material, "courseId" | "moduleId">): string {
  return material.moduleId === null ? edunexCourseUrl(material.courseId) : `${EDUNEX_WEB}/courses/${material.courseId}/preview/${material.moduleId}`;
}

export type MaterialAction =
  | { kind: "download"; url: string; name: string }
  | { kind: "join"; url: string }
  /** Drawn right on the page, as Edunex does: the lecturer's HTML, with its pictures and links. */
  | { kind: "note"; html: string }
  | { kind: "image"; url: string }
  | { kind: "open"; url: string }
  | { kind: "edunex"; url: string };

export function materialAction(material: Material): MaterialAction {
  const content = material.content?.trim() ?? "";
  const edunex: MaterialAction = { kind: "edunex", url: edunexMaterialUrl(material) };
  // A lecturer's link elsewhere (YouTube, Google Drive) opens in the browser, as Edunex opens it.
  const elsewhere: MaterialAction = isWebLink(content) ? { kind: "open", url: content } : edunex;
  switch (materialKind(material.type)) {
    case "pdf":
    case "file":
    case "video":
    case "audio":
      return isEdunexFile(content) ? { kind: "download", url: content, name: fileName(material) } : elsewhere;
    case "vicon":
      // Only the services' own pages: a CloudX room is joined through Edunex.
      return isOfficialUrl(content) ? { kind: "join", url: content } : edunex;
    case "note":
      return { kind: "note", html: content };
    case "link":
      return elsewhere;
    case "image":
      return isEdunexFile(content) ? { kind: "image", url: content } : elsewhere;
    default:
      return edunex;
  }
}

/**
 * The Modul tab's address for an Edunex course's course-wide items (its
 * Introduction), in a route's `module`: Edunex's module ids are positive, so
 * the course's id, negated.
 */
export const introModule = (courseId: number) => -courseId;

/** The text of a lecturer's HTML, roughly (no DOM here): enough to tell whether there is any, and to search it. */
export function htmlText(html: string): string {
  return html
    .replace(/<(script|style)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, code: string) => (Number(code) > 0 && Number(code) <= 0x10ffff ? String.fromCodePoint(Number(code)) : " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** A name the file system accepts, readable: no folders, reserved characters or trailing dots. */
export function safeFileName(name: string, max = 120): string {
  let clean = name
    .replace(/[/\\:*?"<>|\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .replace(/[. ]+$/, "")
    .replace(/^\.+/, "");
  if (/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(clean)) clean = `${clean}-`;
  return clean || "file";
}

function extensionOf(url: string | null): string | null {
  if (!url) return null;
  try {
    const match = /\.([a-z0-9]{2,5})$/i.exec(decodeURIComponent(new URL(url).pathname));
    return match ? `.${match[1].toLowerCase()}` : null;
  } catch {
    return null;
  }
}

/** The file's name when saved: the lecturer's title with the file's extension. */
export function fileName(material: Pick<Material, "title" | "type" | "content">): string {
  const ext = material.type === "pdf" ? ".pdf" : (extensionOf(material.content) ?? uploadExtension(material.type) ?? "");
  let base = material.title.trim();
  if (ext && base.toLowerCase().endsWith(ext)) base = base.slice(0, -ext.length);
  return `${safeFileName(base)}${ext}`;
}

// ---------------------------------------------------------------- the outline

export interface OutlineEntry {
  module: CourseModule;
  /** Its place in its own Edunex course, from 1. */
  number: number;
  /** It sits in the class's parent course. */
  parent: boolean;
}

/** The course's modules as Edunex numbers them: the class's own course first, then its parent's. */
export function outlineEntries(outline: CourseOutline, mainCourseId: number): OutlineEntry[] {
  const counts = new Map<number, number>();
  return outline.modules.map((module) => {
    const number = (counts.get(module.courseId) ?? 0) + 1;
    counts.set(module.courseId, number);
    return { module, number, parent: module.courseId !== mainCourseId };
  });
}

// ---------------------------------------------------------------- offline files

export interface OfflineFile {
  url: string;
  /** Folders under the course's folder: none for course-wide files, else the module's. */
  folders: string[];
  name: string;
  sizeBytes: number | null;
}

export interface OfflinePlan {
  /** The course's folder: "PL3002 Economics and Innovation in Planning". */
  folder: string;
  files: OfflineFile[];
}

/** Every file of a course from Edunex, by module, with names that don't collide. */
export function planOfflineFiles(
  course: { code: string; name: string; mainCourseId: number },
  outline: CourseOutline | undefined,
  materials: readonly Material[],
  lang: Lang,
): OfflinePlan {
  const parentLabel = translate(lang, "course.parentClass");
  const moduleFolder = new Map<number, string[]>();
  for (const entry of outline ? outlineEntries(outline, course.mainCourseId) : []) {
    const name = safeFileName(`${String(entry.number).padStart(2, "0")} ${entry.module.title}`, 80);
    moduleFolder.set(entry.module.id, entry.parent ? [parentLabel, name] : [name]);
  }
  const taken = new Set<string>();
  const files: OfflineFile[] = [];
  for (const material of materials) {
    const action = materialAction(material);
    if (action.kind !== "download") continue;
    let folders: string[];
    if (material.moduleId === null) folders = material.courseId === course.mainCourseId ? [] : [parentLabel];
    else {
      const known = moduleFolder.get(material.moduleId);
      // A file in a module the outline no longer shows has no place to go.
      if (!known) continue;
      folders = known;
    }
    const name = uniqueName(action.name, (candidate) => taken.has([...folders, candidate].join("/").toLowerCase()));
    taken.add([...folders, name].join("/").toLowerCase());
    files.push({ url: action.url, folders, name, sizeBytes: material.sizeBytes });
  }
  return { folder: safeFileName(`${course.code} ${course.name}`, 80), files };
}

function uniqueName(name: string, isTaken: (candidate: string) => boolean): string {
  if (!isTaken(name)) return name;
  const dot = name.lastIndexOf(".");
  const [base, ext] = dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
  for (let n = 2; ; n++) {
    const candidate = `${base} (${n})${ext}`;
    if (!isTaken(candidate)) return candidate;
  }
}

// ---------------------------------------------------------------- the Modul tab

/** What a module holds, by the kinds a Student tells apart: "2 PDF · 1 tugas". */
export type ContentKind = "task" | "pdf" | "vicon" | "note" | "video" | "link" | "image" | "file";

export function contentCounts(materials: readonly Material[], tasks: number): { kind: ContentKind; count: number }[] {
  const counts = new Map<ContentKind, number>();
  if (tasks) counts.set("task", tasks);
  for (const material of materials) {
    const kind = materialKind(material.type);
    const shown: ContentKind = kind === "pdf" || kind === "vicon" || kind === "note" || kind === "video" || kind === "link" || kind === "image" ? kind : "file";
    counts.set(shown, (counts.get(shown) ?? 0) + 1);
  }
  const order: ContentKind[] = ["task", "pdf", "video", "vicon", "note", "link", "image", "file"];
  return order.flatMap((kind) => (counts.has(kind) ? [{ kind, count: counts.get(kind)! }] : []));
}

/**
 * The entry the Modul tab opens on: the newest one with something in it (by
 * when it or its newest material was posted; the later in the outline on a
 * tie), the class's own before the joint class's; never an empty one when
 * any has content.
 */
export function newestWithContent(entries: readonly { hasContent: boolean; at: number | null; parent: boolean }[]): number {
  let best = -1;
  for (const [index, entry] of entries.entries()) {
    if (!entry.hasContent) continue;
    if (best === -1) {
      best = index;
      continue;
    }
    const current = entries[best];
    if (entry.parent !== current.parent) {
      if (!entry.parent) best = index;
      continue;
    }
    if ((entry.at ?? 0) >= (current.at ?? 0)) best = index;
  }
  return best === -1 ? 0 : best;
}
