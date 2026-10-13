// Handing in from the window (#73): the files the Student picked (system file
// picker) or dropped, known to the window only by ids issued here, and the
// uploads, draft saves and submits, which run as the Edunex source's actions
// on the Student's click. No Electron here, so tests run it as it is; the
// handlers in ./handlers/tasks.ts plug in the real file picker.
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { z } from "zod";
import { MAX_UPLOAD_BYTES, type PickedFile } from "../core/actions/tasks";
import { type ActionOutput, Actions } from "../core/contract";
import type { Engine } from "../engine/engine";
import { EngineError, isEngineError } from "../engine/errors";

/** A file on this computer the Student chose. */
export interface LocalFile {
  name: string;
  size: number;
  /** Its content type, when the system knows it. */
  type: string;
  /** Reads it when it's uploaded; throws when it can't be read any more. */
  read(): Promise<Uint8Array>;
}

export type HandInAction = "tasks.pickFiles" | "tasks.dropFiles" | "tasks.upload" | "tasks.saveDraft" | "tasks.submit";
type HandInHandlers = { [N in HandInAction]: (input: z.infer<(typeof Actions)[N]["input"]>) => Promise<ActionOutput<N>> };

/** Picked files stay known this long a list (the latest ones). */
const KEEP = 50;

export function handInHandlers(engine: Engine, pick: () => Promise<LocalFile[]>): HandInHandlers {
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
    "tasks.dropFiles": async ({ files }) => ({
      files: files.map((file) => {
        const bytes = file.bytes;
        return keep({ name: path.basename(file.name), size: bytes.byteLength, type: file.type || contentType(file.name), read: async () => bytes });
      }),
    }),
    "tasks.upload": async ({ fileId }) => {
      const file = picked.get(fileId);
      if (!file) throw new EngineError("Rejected", "That file isn't attached any more");
      if (file.size > MAX_UPLOAD_BYTES) throw new EngineError("Rejected", `${file.name} is too big to hand in from the app`);
      let bytes: Uint8Array;
      try {
        bytes = await file.read();
      } catch (error) {
        if (isEngineError(error)) throw error;
        throw new EngineError("Rejected", `${file.name} can't be read any more`);
      }
      const uploaded = await engine.act("edunex", "uploadFile", { name: file.name, contentType: file.type || contentType(file.name), bytes });
      return Actions["tasks.upload"].output.parse(uploaded);
    },
    "tasks.saveDraft": async (input) => Actions["tasks.saveDraft"].output.parse(await engine.act("edunex", "saveDraft", input)),
    "tasks.submit": async (input) => Actions["tasks.submit"].output.parse(await engine.act("edunex", "submit", input)),
  };
}

const TYPES: Record<string, string> = {
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".zip": "application/zip",
  ".rar": "application/vnd.rar",
  ".7z": "application/x-7z-compressed",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".mp3": "audio/mpeg",
};

/** A file's content type from its extension, as the website's upload would send it. */
export function contentType(name: string): string {
  return TYPES[path.extname(name).toLowerCase()] ?? "application/octet-stream";
}
