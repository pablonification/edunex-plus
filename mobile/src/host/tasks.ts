// Handing in from the phone (#73): the desktop's src/desktop/hand-in.ts with the phone's file
// picker (expo-document-picker) in place of the system's open dialog. The screens know a picked
// file only by the id issued here, never by where it is on the phone; uploads, draft saves and
// submits run as the Edunex source's actions, only on the Student's press. Same contract, same
// rules: what Edunex wouldn't take (its kind, over 100 MB) is never sent.
import { randomUUID } from "expo-crypto";
import * as DocumentPicker from "expo-document-picker";
import { File } from "expo-file-system";
import { ANSWER_FILE_TYPES, answerFileProblem, MAX_UPLOAD_BYTES, type PickedFile } from "../../../src/core/actions/tasks";
import { Actions } from "../../../src/core/contract";
import { sniff } from "../../../src/desktop/remote-files";
import type { Engine } from "../../../src/engine/engine";
import { EngineError, isEngineError } from "../../../src/engine/errors";
import type { Handlers } from "./handlers";

/** A file on the phone the Student chose (src/desktop/hand-in.ts's LocalFile). */
export interface LocalFile {
  name: string;
  size: number;
  /** Its content type, when the phone knows it. */
  type: string;
  /** Reads it when it's uploaded; throws when it can't be read any more. */
  read(): Promise<Uint8Array>;
}

type HandInAction = "tasks.pickFiles" | "tasks.dropFiles" | "tasks.readPicked" | "tasks.upload" | "tasks.saveDraft" | "tasks.submit";

/** Picked files stay known this long a list (the latest ones). */
const KEEP = 50;

/**
 * The hand-in actions on the phone. `pick`: the phone's file picker (the default); a test or the
 * demo can give its own.
 */
export function phoneTaskHandlers(engine: Engine, pick: () => Promise<LocalFile[]> = pickOnPhone): Pick<Handlers, HandInAction> {
  const picked = new Map<string, LocalFile>();
  const keep = (file: LocalFile): PickedFile => {
    const id = randomUUID();
    picked.set(id, file);
    for (const oldest of picked.keys()) {
      if (picked.size <= KEEP) break;
      picked.delete(oldest);
    }
    return { id, name: file.name, size: file.size, type: file.type };
  };

  return {
    "tasks.pickFiles": async () => ({ files: (await pick()).map(keep) }),
    // Nothing is dropped on a phone; kept so a screen that sends bytes (a filled-in PDF) works as on the desktop.
    "tasks.dropFiles": async ({ files }) => ({
      files: files.map((file) => {
        const bytes = file.bytes;
        return keep({ name: baseName(file.name), size: bytes.byteLength, type: file.type || contentType(file.name), read: async () => bytes });
      }),
    }),
    "tasks.readPicked": async ({ fileId }) => {
      const file = picked.get(fileId);
      if (!file) throw new EngineError("Rejected", "That file isn't attached any more");
      if (!/\.pdf$/i.test(file.name)) throw new EngineError("Rejected", `${file.name} isn't a PDF`);
      if (file.size > MAX_UPLOAD_BYTES) return { problem: "too-big" };
      const bytes = await file.read().catch(() => null);
      return bytes && sniff(bytes, "pdf") ? { bytes } : { problem: "unreadable" };
    },
    "tasks.upload": async ({ fileId, taskId }) => {
      const file = picked.get(fileId);
      if (!file) throw new EngineError("Rejected", "That file isn't attached any more");
      const problem = answerFileProblem(file.name, file.size);
      if (problem) throw new EngineError("Rejected", problem === "size" ? `${file.name} is over 100 MB` : `Edunex doesn't take ${file.name} in an answer`);
      let bytes: Uint8Array;
      try {
        bytes = await file.read();
      } catch (error) {
        if (isEngineError(error)) throw error;
        throw new EngineError("Rejected", `${file.name} can't be read any more`);
      }
      const uploaded = await engine.act("edunex", "uploadFile", { taskId, name: file.name, contentType: file.type || contentType(file.name), bytes });
      return Actions["tasks.upload"].output.parse(uploaded);
    },
    "tasks.saveDraft": async (input) => Actions["tasks.saveDraft"].output.parse(await engine.act("edunex", "saveDraft", input)),
    "tasks.submit": async (input) => Actions["tasks.submit"].output.parse(await engine.act("edunex", "submit", input)),
  };
}

/**
 * The phone's file picker, showing only the kinds Edunex takes in an answer. Each pick is copied
 * into the app's cache (the picker's own link to it can stop working), read when it's uploaded.
 */
async function pickOnPhone(): Promise<LocalFile[]> {
  const result = await DocumentPicker.getDocumentAsync({
    type: [...new Set(ANSWER_FILE_TYPES.map((ext) => TYPES[`.${ext}`]!))],
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return [];
  return result.assets.map((asset) => {
    const name = baseName(asset.name);
    const file = new File(asset.uri);
    return {
      name,
      size: asset.size ?? (file.exists ? file.size : 0),
      // The extension decides, as the website's upload does; the picker's guess only when there's none.
      type: TYPES[extension(name)] ?? asset.mimeType ?? "application/octet-stream",
      read: async () => {
        if (!file.exists) throw new EngineError("Rejected", `${name} isn't on the phone any more`);
        return file.bytes();
      },
    };
  });
}

// The content types Edunex's uploader lists for the files it takes (src/desktop/hand-in.ts).
const TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".zip": "application/zip",
  ".rar": "application/vnd.rar",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
};

const extension = (name: string) => /\.[^./\\]+$/.exec(name)?.[0]?.toLowerCase() ?? "";

/** A file's content type from its extension, as the website's upload would send it. */
export function contentType(name: string): string {
  return TYPES[extension(name)] ?? "application/octet-stream";
}

/** The name without any folders (node:path's basename, which the phone doesn't have). */
const baseName = (name: string) => name.split(/[/\\]/).pop() || name;
