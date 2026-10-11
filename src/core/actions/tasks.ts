// Actions for handing in Tasks (#73). The window refers to a file only by an
// id the main process issued when the Student picked it (system file picker)
// or dropped it (by content): it never names a path on the computer. Every
// write runs only because the Student clicked.
import { z } from "zod";
import { Task, TaskFile } from "../models";

/** The biggest file the app hands in. */
export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

/** A file the Student picked or dropped, as the window knows it. */
export const PickedFile = z.object({ id: z.string(), name: z.string(), size: z.number(), type: z.string() });
export type PickedFile = z.infer<typeof PickedFile>;

/** What the answer should hold: the files already in it the Student kept, and the newly uploaded ones. */
export const HandIn = z.object({
  taskId: z.number().int().positive(),
  files: z.array(TaskFile).max(50),
});
export type HandIn = z.infer<typeof HandIn>;

/**
 * What a draft save or a submit came to, as EduNex tells it when the Task is
 * read back: "submitted" only when EduNex says the answer is sent;
 * "unconfirmed" when EduNex took the request but the read-back doesn't show
 * it; "closed" / "not-open" when EduNex doesn't take answers now; "gone" when
 * the Task isn't on EduNex any more.
 */
export const HandInOutcome = z.enum(["saved", "submitted", "unconfirmed", "closed", "not-open", "gone"]);
export type HandInOutcome = z.infer<typeof HandInOutcome>;

const HandInResult = z.object({ outcome: HandInOutcome, task: Task.nullable() });
export type HandInResult = z.infer<typeof HandInResult>;

/** A file's content. Checked by kind rather than by constructor: the bytes may come from another JavaScript context. */
export const Bytes = z.custom<Uint8Array>((value) => Object.prototype.toString.call(value) === "[object Uint8Array]", "Not file content");

/** A file dropped on the window: its name, type and content. */
const DroppedFile = z.object({
  name: z.string().min(1).max(255),
  type: z.string().max(200),
  bytes: Bytes.refine((bytes) => bytes.byteLength <= MAX_UPLOAD_BYTES),
});

export const tasksActions = {
  /** Opens the system's file picker. Cancelling gives no files. */
  "tasks.pickFiles": { input: z.object({}), output: z.object({ files: z.array(PickedFile) }) },
  /** Files dropped on the window, by content (a drop gives no path the app may use). */
  "tasks.dropFiles": { input: z.object({ files: z.array(DroppedFile).min(1).max(20) }), output: z.object({ files: z.array(PickedFile) }) },
  /** Uploads one picked file through EduNex's own flow: a temporary storage link, then the file. */
  "tasks.upload": { input: z.object({ fileId: z.string().min(1).max(64) }), output: TaskFile.extend({ size: z.number() }) },
  /** Saves the answer as a draft. EduNex's answers are re-read first: a new answer only when there is none. */
  "tasks.saveDraft": { input: HandIn, output: HandInResult },
  /** Hands the answer in; "submitted" only once EduNex confirms it when the Task is read back. */
  "tasks.submit": { input: HandIn, output: HandInResult },
} as const;
