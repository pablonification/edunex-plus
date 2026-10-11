// How each EduNex material is offered on the course page (#74): a file to
// download, an online class to join, a text note to read in the app, a page
// to open, or EduNex itself when the app can't do better. Also how a
// course's files are laid out when the Student saves them for offline
// reading: Edunex Plus/<course>/<module>/<file>.
import { OFFICIAL_HOSTS } from "./contract";
import { EDUNEX_WEB, edunexCourseUrl } from "./links";
import type { CourseModule, CourseOutline, Material } from "./models";
import { type Lang, translate } from "./strings";

export type MaterialKind = "pdf" | "vicon" | "note" | "video" | "audio" | "link" | "file" | "interactive" | "other";

/** EduNex's online-class (Vicon) types and the service each one is. */
export const VICON_PROVIDERS: Readonly<Record<string, string>> = {
  "ms-teams": "Microsoft Teams",
  zoom: "Zoom",
  "google-meet": "Google Meet",
  cloudx: "CloudX",
  webex: "Webex",
};

const KINDS: Readonly<Record<string, MaterialKind>> = { pdf: "pdf", text: "note", video: "video", audio: "audio", url: "link", file: "file", h5p: "interactive" };

export function materialKind(type: string): MaterialKind {
  if (Object.hasOwn(VICON_PROVIDERS, type)) return "vicon";
  return Object.hasOwn(KINDS, type) ? KINDS[type] : "other";
}

/** Where EduNex keeps files: its storage on Azure, its API, ITB's own sites (as the desktop's download guard). */
const FILE_HOSTS = [/\.blob\.core\.windows\.net$/, /^api-edunex\.cognisia\.id$/, /(^|\.)itb\.ac\.id$/];

function httpsHost(url: string): string | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? parsed.hostname : null;
  } catch {
    return null;
  }
}

export function isEdunexFile(url: string): boolean {
  const host = httpsHost(url);
  return host !== null && FILE_HOSTS.some((pattern) => pattern.test(host));
}

/** Official pages and online-class services, the only links the app opens in the browser. */
export function opensInBrowser(url: string): boolean {
  const host = httpsHost(url);
  return host !== null && OFFICIAL_HOSTS.some((pattern) => pattern.test(host));
}

/** A material's own place on EduNex's website: its module's page, or the course's. */
export function edunexMaterialUrl(material: Pick<Material, "courseId" | "moduleId">): string {
  return material.moduleId === null ? edunexCourseUrl(material.courseId) : `${EDUNEX_WEB}/courses/${material.courseId}/preview/${material.moduleId}`;
}

export type MaterialAction =
  | { kind: "download"; url: string; name: string }
  | { kind: "join"; url: string }
  | { kind: "read"; html: string }
  | { kind: "open"; url: string }
  | { kind: "edunex"; url: string };

export function materialAction(material: Material): MaterialAction {
  const content = material.content?.trim() ?? "";
  const edunex: MaterialAction = { kind: "edunex", url: edunexMaterialUrl(material) };
  switch (materialKind(material.type)) {
    case "pdf":
    case "file":
    case "video":
    case "audio":
      if (isEdunexFile(content)) return { kind: "download", url: content, name: fileName(material) };
      return opensInBrowser(content) ? { kind: "open", url: content } : edunex;
    case "vicon":
      return opensInBrowser(content) ? { kind: "join", url: content } : edunex;
    case "note":
      // A note that is only a picture has nothing to read here.
      return htmlText(content) ? { kind: "read", html: content } : edunex;
    case "link":
      return opensInBrowser(content) ? { kind: "open", url: content } : edunex;
    default:
      return edunex;
  }
}

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
  const ext = material.type === "pdf" ? ".pdf" : (extensionOf(material.content) ?? "");
  let base = material.title.trim();
  if (ext && base.toLowerCase().endsWith(ext)) base = base.slice(0, -ext.length);
  return `${safeFileName(base)}${ext}`;
}

// ---------------------------------------------------------------- the outline

export interface OutlineEntry {
  module: CourseModule;
  /** Its place in its own EduNex course, from 1. */
  number: number;
  /** It sits in the class's parent course. */
  parent: boolean;
}

/** The course's modules as EduNex numbers them: the class's own course first, then its parent's. */
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

/** Every file of a course from EduNex, by module, with names that don't collide. */
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
