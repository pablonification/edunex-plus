// Files from Edunex on the phone (A12, A13): the desktop's "files.*" handlers (src/desktop/handlers
// /files.ts and core.ts's "files.download") the phone's way. A download lands in the app's own
// files (no other app reads them), recorded by its link so "Unduh" opens that copy instead of
// fetching it twice; it opens in the phone's own apps (Android's "open with", never a viewer in
// the app) and goes elsewhere through the share sheet. Pictures in lecturers' notes are read
// with the desktop's own rules (src/desktop/remote-files.ts): Edunex's storage only, no cookies,
// a size cap, and the bytes must really be a picture.
import { fetch as expoFetch } from "expo/fetch";
import { Directory, File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { type FetchFile, readFile } from "../../../src/desktop/remote-files";
import { EngineError } from "../../../src/engine/errors";
import type { Handlers } from "./handlers";

type FileAction = "files.download" | "files.local" | "files.open" | "files.reveal" | "files.read";

export interface FileContext {
  /** Fetches a file from Edunex's storage; the demo gives the pretend storage's. The phone's own network by default. */
  fetchFile?: FetchFile;
}

/** Where Edunex keeps files: its storage on Azure, its API, ITB's own sites (src/desktop/downloads.ts's isDownloadable). */
const FILE_HOSTS = [/\.blob\.core\.windows\.net$/, /^api-edunex\.cognisia\.id$/, /(^|\.)itb\.ac\.id$/];

function isDownloadable(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && FILE_HOSTS.some((host) => host.test(parsed.hostname));
  } catch {
    return false;
  }
}

/** A file name with no folders or characters the file system refuses (src/desktop/downloads.ts's safeName). */
function safeName(name: string): string {
  const clean = name
    // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what's being removed
    .replace(/[/\\:*?"<>|\u0000-\u001f]/g, "_")
    .replace(/^\.+/, "")
    .trim();
  return clean || "file";
}

const phoneFetch: FetchFile = (url, init) => expoFetch(url, init) as unknown as Promise<Response>;

/**
 * The downloads the app made, by link: one folder under the app's documents, and an index saying
 * which file holds which link. Wiped with the rest of the app's files when the Student signs out
 * of everything (the lead's `forgetEverything` clears the documents folder it lives in).
 */
class Downloads {
  private readonly root = new Directory(Paths.document, "downloads");
  private readonly index = new File(this.root, "index.json");

  private read(): Record<string, string> {
    try {
      return this.index.exists ? (JSON.parse(this.index.textSync()) as Record<string, string>) : {};
    } catch {
      return {};
    }
  }

  /** The copy of `url` the app downloaded, while it's still there. */
  find(url: string): File | null {
    const name = this.read()[url];
    if (!name) return null;
    const file = new File(this.root, name);
    return file.exists ? file : null;
  }

  /** A new file for `name`: "Notes.pdf", then "Notes (2).pdf" … so nothing already there is replaced. */
  place(name: string): File {
    if (!this.root.exists) this.root.create({ intermediates: true });
    const safe = safeName(name);
    const ext = /\.[^.]{1,8}$/.exec(safe)?.[0] ?? "";
    const base = safe.slice(0, safe.length - ext.length);
    let file = new File(this.root, safe);
    for (let n = 2; file.exists || file.name === "index.json"; n++) file = new File(this.root, `${base} (${n})${ext}`);
    return file;
  }

  record(url: string, file: File): void {
    const next = { ...this.read(), [url]: file.name };
    this.index.write(JSON.stringify(next));
  }
}

export function phoneFileHandlers(context: FileContext = {}): Pick<Handlers, FileAction> {
  const downloads = new Downloads();
  const fetchFile = context.fetchFile ?? phoneFetch;

  const local = (url: string): File => {
    const file = isDownloadable(url) ? downloads.find(url) : null;
    if (!file) throw new EngineError("Rejected", "That file isn't on this phone");
    return file;
  };

  return {
    "files.download": async ({ url, name }) => {
      if (!isDownloadable(url)) throw new EngineError("Rejected", "Only Edunex's files download from the app");
      // Already on the phone: that copy is the one, rather than another "Notes (2).docx" next to it.
      const existing = downloads.find(url);
      if (existing) return { path: existing.name, existing: true };
      const file = downloads.place(name);
      try {
        if (context.fetchFile) {
          // The demo's pretend storage answers in memory.
          const response = await fetchFile(url, { signal: new AbortController().signal, credentials: "omit", redirect: "error" });
          if (!response.ok) throw new EngineError("Failed", `The storage answered ${response.status}`);
          file.create();
          file.write(new Uint8Array(await response.arrayBuffer()));
        } else {
          // Straight to the file, however big: Android's own download, not through the app's memory.
          await File.downloadFileAsync(url, file);
        }
      } catch (error) {
        if (file.exists) file.delete();
        if (error instanceof EngineError) throw error;
        throw new EngineError("Failed", `The download failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      downloads.record(url, file);
      // The screens never learn where it is: the name is all they show.
      return { path: file.name, existing: false };
    },
    // No list of apps on a phone: Android asks which one (or uses the Student's default) when it opens.
    "files.local": async ({ url }) => {
      const file = isDownloadable(url) ? downloads.find(url) : null;
      return file ? { name: file.name, apps: [], preferred: null, chooser: true } : null;
    },
    "files.open": async ({ url }) => {
      const file = local(url);
      if (!(await file.canPreview().catch(() => false))) throw new EngineError("Rejected", `No app on this phone opens ${file.name}`);
      await file.preview({ title: file.name });
      return {};
    },
    // A phone has no folder to show the file in: the share sheet is where it goes from here (Drive, chat, another app).
    "files.reveal": async ({ url }) => {
      const file = local(url);
      if (!(await Sharing.isAvailableAsync())) throw new EngineError("Rejected", "This phone can't share files");
      await Sharing.shareAsync(file.uri, { dialogTitle: file.name });
      return {};
    },
    "files.read": ({ url, as }) => readFile({ fetch: fetchFile }, url, as),
  };
}
