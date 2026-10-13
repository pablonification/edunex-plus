// Handing a Task in (#73), only ever because the Student clicked: a file goes
// up through Edunex's own upload flow (a temporary storage link, then the
// file), a draft is saved (Edunex's answers are re-read first, so a new answer
// is created only when there is none), and a submit counts only once Edunex
// says the answer is sent when the Task is read back.
import { z } from "zod";
import { answerFileProblem, Bytes, HandIn, type HandInResult } from "../../../core/actions/tasks";
import type { Task, TaskFile } from "../../../core/models";
import { takesAnswers } from "../../../core/tasks";
import { EngineError, isEngineError } from "../../errors";
import { type HttpResponse, NetworkError, type Transport } from "../../http/transport";
import type { SourceAction, SourceContext } from "../source";
import { answerWords, cleanAnswer } from "./answer-html";
import { EDUNEX_API, EdunexClient, TIMEOUT_MS } from "./client";
import { LoginMe } from "./schemas";
import type { EdunexSession } from "./session";
import { type AnswerFile, readTaskRecord, remember, type TaskRecord } from "./task-records";

// ---------------------------------------------------------------- Edunex's write calls
//
// NOT RECORDED: the recorder blocks every write. These are what Edunex's own
// website sends, read from its public code (fetched 2026-10-12, no sign-in):
// the answer form `ContentTaskAnswer` (getFilePath, onFilesAdded, onProcessing,
// onSuccess, saveData) in js/components/content/reader/task-reader.2eb63cbd.js,
// and the task store's answerCreate, answerUpdate and answerSend in
// js/app.79bf84f4.js. Like the website, an answer is never saved without text
// ("Text is required"). The replies' shapes beyond the upload links are
// unknown, so only their status counts: every write is confirmed by reading
// the Task back.

/** A file in an answer as the website sends it: Edunex's own record for a file kept, `{ file, name }` for a new one. */
type SentFile = AnswerFile | { file: string; name: string };

const answerBodies = {
  /** answerCreate: the text and the files in one request. */
  create: (taskId: number, text: string, files: SentFile[]) => ({ data: { attributes: { task_id: taskId, files, answer: text, is_sent: 0 } } }),
  /** answerUpdate: the same fields, for the answer Edunex already has. */
  update: (taskId: number, text: string, files: SentFile[]) => ({ data: { attributes: { task_id: taskId, files, answer: text, is_sent: 0 } } }),
  /** answerSend. */
  submit: () => ({ data: { attributes: { is_sent: 1 } } }),
  uploadLink: (fileName: string, contentType: string, size: number) => ({ files: [{ fileName, contentType, sizeInBytes: size }] }),
};
/** After a send the website clears the lecturer's cached "download all answers" file, so it's built again with this answer in it. */
const exportPath = (taskId: number) => `/blob-storage//task/${taskId}/export`;

/** POST /blob-storage/sas answers with the links for each storage path sent: `{ files: { [path]: { uploadUrl, readUrl } } }`. */
const UploadLink = z.object({ uploadUrl: z.string().url(), readUrl: z.string().url() });
const UploadLinks = z.object({ files: z.record(z.string(), UploadLink) });

/** GET /course/modules/{id}?include=, as the website reads a Task's module before an upload. */
const ModuleRecord = z.object({ data: z.object({ attributes: z.object({ name: z.string() }) }) });
/** GET /course/courses/{id}, the course's own name when the Task doesn't carry it. */
const CourseRecord = z.object({ data: z.object({ attributes: z.object({ name: z.string() }) }) });

/**
 * Where the website puts a Student's file on Edunex's storage (getFilePath):
 * "{year}/{courseId}-{course}/{moduleId}-{module}/task/{userId}/{ms}_{name}",
 * spaces as "-", the file's extension left off, as it does.
 */
function storagePath(parts: {
  at: number;
  courseId: number;
  courseName: string;
  module: { id: number; name: string } | null;
  userId: number;
  fileName: string;
}): string {
  const dashed = (text: string) => text.replace(/\s+/g, "-");
  const base = parts.fileName.split(".").slice(0, -1).join(".");
  const module = parts.module ? `${parts.module.id}-${dashed(parts.module.name)}/` : "";
  return `${new Date(parts.at).getFullYear()}/${parts.courseId}-${dashed(parts.courseName)}/${module}task/${parts.userId}/${parts.at}_${dashed(base)}`;
}

/** Where Edunex keeps files: its storage on Azure. Nothing else is uploaded to or attached. */
function isStorageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.hostname.endsWith(".blob.core.windows.net");
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- the actions

const UploadInput = z.object({
  taskId: z.number().int().positive(),
  name: z.string().min(1).max(255),
  contentType: z.string().min(1).max(200),
  bytes: Bytes,
});

export const taskActions: Record<string, SourceAction<EdunexSession>> = {
  /** Uploads one file for a Task; the answer gets its read link when the draft is saved. */
  async uploadFile(context, session, input) {
    const { taskId, name, contentType, bytes } = parse(UploadInput, input);
    const problem = answerFileProblem(name, bytes.byteLength);
    if (problem) throw new EngineError("Rejected", problem === "size" ? `${name} is over 100 MB` : `Edunex doesn't take ${name} in an answer`);
    const client = new EdunexClient(context.transport, session.token, context.userAgent);
    // What the website knows on the Task's page: the Task, its course and module, and who is signed in.
    const fresh = await readBack(context, client, known(context, taskId));
    // Not the file's fault: said as Edunex not taking the upload, never as a file that can't be read.
    if (!fresh) throw new EngineError("Failed", `Task ${taskId} is no longer on Edunex`);
    personalOnly(fresh.task);
    const a = fresh.record.attributes;
    const courseName = a.course_name ?? (await client.get(`/course/courses/${fresh.task.courseId}`, {}, CourseRecord)).data.attributes.name;
    const module =
      a.taskable_type === "modules" && a.taskable_id !== null
        ? { id: a.taskable_id, name: (await client.get(`/course/modules/${a.taskable_id}`, { include: "" }, ModuleRecord)).data.attributes.name }
        : null;
    const me = await client.get("/login/me", {}, LoginMe);
    const path = storagePath({ at: context.clock.now(), courseId: fresh.task.courseId, courseName, module, userId: me.id, fileName: name });
    const reply = UploadLinks.safeParse(
      await write(context, session, "POST", "/blob-storage/sas", answerBodies.uploadLink(path, contentType, bytes.byteLength)),
    );
    const links = reply.success ? reply.data.files : {};
    // The website reads the link by the path it sent; a reply holding just one link is that one.
    const link = links[path] ?? (Object.keys(links).length === 1 ? Object.values(links)[0] : undefined);
    if (!link) throw new EngineError("VendorChanged", "/blob-storage/sas: no upload link in the answer");
    if (!isStorageUrl(link.uploadUrl) || !isStorageUrl(link.readUrl))
      throw new EngineError("VendorChanged", "/blob-storage/sas: the upload link isn't Edunex's storage");
    await put(context.transport, context.userAgent, link.uploadUrl, contentType, bytes);
    return { name, url: link.readUrl, size: bytes.byteLength };
  },

  /** Saves the answer as a draft holding exactly these files. */
  async saveDraft(context, session, input) {
    const handIn = parse(HandIn, input);
    return oneAtATime(context, handIn.taskId, async (): Promise<HandInResult> => {
      const client = new EdunexClient(context.transport, session.token, context.userAgent);
      const fresh = await readBack(context, client, known(context, handIn.taskId));
      const refused = await refusal(context, handIn.taskId, fresh);
      if (refused || !fresh) return refused ?? GONE;
      needsText(answerText(fresh, handIn), handIn);
      const saved = await refusedMidway(context, client, fresh, () => saveAnswer(context, session, client, fresh, handIn));
      if ("outcome" in saved) return saved;
      await remember(context, handIn.taskId, saved.task);
      return { outcome: saved.kept ? "saved" : saved.task ? "unconfirmed" : "gone", task: saved.task };
    });
  },

  /** Hands the answer in: saves these files first when the answer doesn't hold exactly them, then sends it. */
  async submit(context, session, input) {
    const handIn = parse(HandIn, input);
    return oneAtATime(context, handIn.taskId, async (): Promise<HandInResult> => {
      const client = new EdunexClient(context.transport, session.token, context.userAgent);
      const fresh = await readBack(context, client, known(context, handIn.taskId));
      const refused = await refusal(context, handIn.taskId, fresh);
      if (refused || !fresh) return refused ?? GONE;
      const text = answerText(fresh, handIn);
      needsText(text, handIn);
      if (fresh.task.fileRequired && handIn.files.length === 0) throw new EngineError("Rejected", "This Task needs a file");
      return refusedMidway(context, client, fresh, async () => {
        let draft: TaskRecord | null = fresh;
        // Saved first when Edunex's draft doesn't hold exactly this text and these files.
        if (!fresh.task.answer || !holdsFiles(fresh.task.answer.files, handIn.files) || text !== (fresh.answer?.answer ?? "")) {
          const saved = await saveAnswer(context, session, client, fresh, handIn);
          draft = saved.kept ? saved.record : null;
          if (!draft) {
            await remember(context, handIn.taskId, saved.task);
            return { outcome: saved.task ? "unconfirmed" : "gone", task: saved.task };
          }
        }
        const answerId = draft.task.answer?.id;
        if (answerId === undefined) throw new EngineError("Failed", "Edunex lost the answer");
        await write(context, session, "PATCH", `/course/task/answers/${answerId}`, answerBodies.submit());
        await clearExport(context, session, handIn.taskId);
        // The receipt is only what Edunex says when the Task is read back.
        const after = (await readBack(context, client, draft.task))?.task ?? null;
        await remember(context, handIn.taskId, after);
        return { outcome: !after ? "gone" : after.answer?.sent ? "submitted" : "unconfirmed", task: after };
      });
    });
  },
};

const GONE: HandInResult = { outcome: "gone", task: null };

/** The Task as the app knows it: hand-in starts from a Task on screen. */
function known(context: SourceContext, taskId: number): Task {
  const task = context.get("edunex.tasks")?.find((item) => item.id === taskId);
  if (!task) throw new EngineError("Rejected", `Task ${taskId} isn't known`);
  return task;
}

function readBack(context: SourceContext, client: EdunexClient, task: Task): Promise<TaskRecord | null> {
  return readTaskRecord(client, task, context.clock.now());
}

/** The text the answer will hold: the Student's, cleaned, when they wrote it; else Edunex's own, unchanged. */
function answerText(fresh: TaskRecord, handIn: HandIn): string {
  return handIn.text !== undefined ? cleanAnswer(handIn.text) : (fresh.answer?.answer ?? "");
}

/**
 * Edunex's website never saves an answer without text: neither does the app.
 * What the Student writes needs words; text the website wrote itself counts
 * as the website counts it (a picture alone too).
 */
function needsText(text: string, handIn: HandIn): void {
  if (handIn.text !== undefined ? !answerWords(text) : !text.trim()) throw new EngineError("Rejected", "Write your answer first: Edunex needs text");
}

/** A group Task goes through the website's group pages (`/course/task/answer/groups`): the app never writes a personal answer to it. */
function personalOnly(task: Task): void {
  if (task.group) throw new EngineError("Rejected", "A group Task is handed in on Edunex");
}

/** Why Edunex won't take an answer now (read back just before writing), or null when it will. */
async function refusal(context: SourceContext, taskId: number, fresh: TaskRecord | null): Promise<HandInResult | null> {
  const now = context.clock.now();
  const task = fresh?.task ?? null;
  if (task) personalOnly(task);
  if (task && !task.answer?.sent && takesAnswers(task, now)) return null;
  await remember(context, taskId, task);
  if (!task) return GONE;
  // Handed in already (on the website, or by an earlier click): the receipt is what Edunex says.
  if (task.answer?.sent) return { outcome: "submitted", task };
  return { outcome: task.opensAt !== null && now < task.opensAt ? "not-open" : "closed", task };
}

/** Edunex refused a write: if the Task stopped taking answers meanwhile (closed midway), say that; else pass the refusal on. */
async function refusedMidway<T>(context: SourceContext, client: EdunexClient, fresh: TaskRecord, work: () => Promise<T>): Promise<T | HandInResult> {
  try {
    return await work();
  } catch (error) {
    if (!isEngineError(error, "Rejected")) throw error;
    const now = await readBack(context, client, fresh.task).catch(() => undefined);
    if (now === undefined) throw error;
    const refused = await refusal(context, fresh.task.id, now);
    if (refused) return refused;
    throw error;
  }
}

/**
 * Writes the draft as the website's "Save Answer" does: one request with the
 * text and every file, creating the answer when Edunex has none, else
 * updating it. Each file the Student kept goes back as Edunex's own record of
 * it; a new one as its link and name. `kept`: Edunex, read back, holds this
 * text and exactly these files in a draft.
 */
async function saveAnswer(
  context: SourceContext,
  session: EdunexSession,
  client: EdunexClient,
  fresh: TaskRecord,
  handIn: HandIn,
): Promise<{ task: Task | null; record: TaskRecord | null; kept: boolean }> {
  const files: SentFile[] = handIn.files.map((file) => {
    const record = fresh.answer?.files.find((existing) => sameFile({ name: existing.name, url: existing.file }, file));
    if (record) return record;
    if (!isStorageUrl(file.url)) throw new EngineError("Rejected", `${file.name} isn't on Edunex's storage`);
    return { file: file.url, name: file.name };
  });
  const text = answerText(fresh, handIn);
  needsText(text, handIn);
  const answer = fresh.task.answer;
  if (answer) await write(context, session, "PATCH", `/course/task/answers/${answer.id}`, answerBodies.update(fresh.task.id, text, files));
  else await write(context, session, "POST", "/course/task/answers", answerBodies.create(fresh.task.id, text, files));
  const after = await readBack(context, client, fresh.task);
  // The words are what must have arrived; Edunex may tidy the markup around them.
  const kept = Boolean(
    after?.answer &&
      !after.task.answer?.sent &&
      holdsFiles(after.task.answer?.files ?? [], handIn.files) &&
      answerWords(after.answer.answer ?? "") === answerWords(text),
  );
  return { task: after?.task ?? null, record: after, kept };
}

/** Best effort, as on the website: a refusal or no answer never undoes or fails the submit. */
async function clearExport(context: SourceContext, session: EdunexSession, taskId: number): Promise<void> {
  try {
    await write(context, session, "DELETE", exportPath(taskId));
  } catch {
    // The website ignores it too; the lecturer's next "download all" may just be older.
  }
}

/** A file's place on the storage, however Edunex writes the link (query and encoding aside). */
function place(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.host.toLowerCase()}${decodeURIComponent(parsed.pathname)}`;
  } catch {
    return url;
  }
}

const sameFile = (a: TaskFile, b: TaskFile) => place(a.url) === place(b.url);

/** The answer holds exactly these files: each one by its link, or by its name if Edunex moved it. */
function holdsFiles(files: TaskFile[], wanted: TaskFile[]): boolean {
  return files.length === wanted.length && wanted.every((want) => files.some((have) => sameFile(have, want) || have.name === want.name));
}

// Kept per engine (one transport each), like the write log.
const queues = new WeakMap<Transport, Map<number, Promise<unknown>>>();

/** One write at a time per Task: a second click waits, then re-reads, so it can't create a second answer. */
function oneAtATime<T>(context: SourceContext, taskId: number, work: () => Promise<T>): Promise<T> {
  let queue = queues.get(context.transport);
  if (!queue) queues.set(context.transport, (queue = new Map()));
  const next = (queue.get(taskId) ?? Promise.resolve()).catch(() => undefined).then(work);
  queue.set(taskId, next);
  const done = () => {
    if (queue.get(taskId) === next) queue.delete(taskId);
  };
  next.then(done, done);
  return next;
}

function parse<S extends z.ZodType>(schema: S, input: unknown): z.infer<S> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new EngineError("Rejected", "Not a valid hand-in");
  return parsed.data;
}

// ---------------------------------------------------------------- requests

/** A write to Edunex's API (a DELETE carries no body). A refusal is "Rejected"; an ended session "Unauthorized". */
async function write(context: SourceContext, session: EdunexSession, method: "POST" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<unknown> {
  let response: HttpResponse;
  try {
    response = await context.transport.request({
      method,
      url: new URL(path, EDUNEX_API).toString(),
      headers: {
        authorization: `Bearer ${session.token}`,
        accept: "application/json",
        ...(body === undefined ? {} : { "content-type": "application/json" }),
        "user-agent": context.userAgent,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      timeoutMs: TIMEOUT_MS,
    });
  } catch (error) {
    if (error instanceof NetworkError)
      throw new EngineError("Offline", error.reason === "timeout" ? "Edunex didn't answer in time" : "Edunex is unreachable", true);
    throw error;
  }
  if (response.status === 401) throw new EngineError("Unauthorized", `Edunex refused ${path}`);
  if (response.status === 429 || response.status >= 500) throw new EngineError("Offline", `Edunex answered ${response.status}`);
  if (response.status >= 400) throw new EngineError("Rejected", `Edunex refused ${method} ${path} (${response.status})`);
  try {
    return response.body ? JSON.parse(response.body) : null;
  } catch {
    return null;
  }
}

/**
 * The file itself goes straight to Edunex's storage with the website's
 * headers (its uploader's options and onProcessing); Edunex's sign-in never
 * goes there. "inline" lets the lecturer's browser show the file instead of
 * downloading it.
 */
async function put(transport: Transport, userAgent: string, url: string, contentType: string, bytes: Uint8Array): Promise<void> {
  // Room for a slow connection: a minute, plus a second for every 50 KB.
  const timeoutMs = Math.min(30 * 60_000, 60_000 + Math.ceil(bytes.byteLength / 50));
  let response: HttpResponse;
  try {
    response = await transport.request({
      method: "PUT",
      url,
      headers: { "x-ms-blob-type": "BlockBlob", "content-type": contentType, "content-disposition": "inline", "user-agent": userAgent },
      body: bytes,
      timeoutMs,
    });
  } catch (error) {
    if (error instanceof NetworkError)
      throw new EngineError("Offline", error.reason === "timeout" ? "The upload took too long" : "Edunex's storage is unreachable", true);
    throw error;
  }
  if (response.status < 200 || response.status >= 300) throw new EngineError("Failed", `Edunex's storage refused the file (${response.status})`);
}
