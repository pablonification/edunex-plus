// Handing a Task in (#73), only ever because the Student clicked: a file goes
// up through Edunex's own upload flow (a temporary storage link, then the
// file), a draft is saved (Edunex's answers are re-read first, so a new answer
// is created only when there is none), and a submit counts only once Edunex
// says the answer is sent when the Task is read back.
import { z } from "zod";
import { Bytes, HandIn, type HandInResult, MAX_UPLOAD_BYTES } from "../../../core/actions/tasks";
import type { Task, TaskFile } from "../../../core/models";
import { takesAnswers } from "../../../core/tasks";
import { EngineError, isEngineError } from "../../errors";
import { type HttpResponse, NetworkError, type Transport } from "../../http/transport";
import type { SourceAction, SourceContext } from "../source";
import { EDUNEX_API, EdunexClient, TIMEOUT_MS } from "./client";
import type { EdunexSession } from "./session";
import { readTask, remember } from "./task-records";

// ---------------------------------------------------------------- Edunex's write calls
//
// NOT RECORDED: the recorder blocks every write, so the website's own requests
// to these endpoints were never captured. The bodies follow v1's JSON:API
// envelope, which v1 checked live for a draft without files and for the
// submit (API.md, "The only writes"), plus the fields Edunex sends back on an
// answer (answer, files[{ name, file }], is_sent). The `files` field and the
// upload-link reply are modelled, not seen. They all live here so one real
// submission can confirm or correct them. The replies' shapes are unknown
// too, so only their status counts: every write is confirmed by reading the
// Task back.

const answerBodies = {
  // As checked live: a new answer carries no files; they're attached in an update.
  create: (taskId: number) => ({ data: { attributes: { task_id: taskId, answer: "", is_sent: 0 } } }),
  update: (taskId: number, text: string | null, files: TaskFile[]) => ({
    data: { attributes: { task_id: taskId, answer: text ?? "", files: files.map(stored), is_sent: 0 } },
  }),
  submit: () => ({ data: { attributes: { is_sent: 1 } } }),
  uploadLink: (name: string, contentType: string, size: number) => ({ files: [{ fileName: name, contentType, sizeInBytes: size }] }),
};
const stored = (file: TaskFile) => ({ name: file.name, file: file.url });

/** POST /blob-storage/sas answers with an upload link and a read link per file (the envelope is unconfirmed). */
const UploadLink = z.object({ uploadUrl: z.string().url(), readUrl: z.string().url() });
const UploadLinks = z.union([z.object({ data: z.array(UploadLink).min(1) }), z.array(UploadLink).min(1), z.object({ data: UploadLink }), UploadLink]);

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

const UploadInput = z.object({ name: z.string().min(1).max(255), contentType: z.string().min(1).max(200), bytes: Bytes });

export const taskActions: Record<string, SourceAction<EdunexSession>> = {
  /** Uploads one file; the answer gets its read link when the draft is saved. */
  async uploadFile(context, session, input) {
    const { name, contentType, bytes } = parse(UploadInput, input);
    if (bytes.byteLength > MAX_UPLOAD_BYTES) throw new EngineError("Rejected", `${name} is too big to hand in from the app`);
    const reply = UploadLinks.safeParse(
      await write(context, session, "POST", "/blob-storage/sas", answerBodies.uploadLink(name, contentType, bytes.byteLength)),
    );
    if (!reply.success) throw new EngineError("VendorChanged", "/blob-storage/sas: no upload link in the answer");
    const data = reply.data;
    const link = Array.isArray(data) ? data[0] : "data" in data ? (Array.isArray(data.data) ? data.data[0] : data.data) : data;
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
      if (fresh.fileRequired && handIn.files.length === 0) throw new EngineError("Rejected", "This Task needs a file");
      return refusedMidway(context, client, fresh, async () => {
        let draft: Task | null = fresh;
        if (!fresh.answer || !holdsFiles(fresh.answer.files, handIn.files)) {
          const saved = await saveAnswer(context, session, client, fresh, handIn);
          draft = saved.kept ? saved.task : null;
          if (!draft) {
            await remember(context, handIn.taskId, saved.task);
            return { outcome: saved.task ? "unconfirmed" : "gone", task: saved.task };
          }
        }
        const answerId = draft.answer?.id;
        if (answerId === undefined) throw new EngineError("Failed", "Edunex lost the answer");
        await write(context, session, "PATCH", `/course/task/answers/${answerId}`, answerBodies.submit());
        // The receipt is only what Edunex says when the Task is read back.
        const after = await readBack(context, client, draft);
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

function readBack(context: SourceContext, client: EdunexClient, task: Task): Promise<Task | null> {
  return readTask(client, task, context.clock.now());
}

/** Why Edunex won't take an answer now (read back just before writing), or null when it will. */
async function refusal(context: SourceContext, taskId: number, fresh: Task | null): Promise<HandInResult | null> {
  const now = context.clock.now();
  if (fresh && !fresh.answer?.sent && takesAnswers(fresh, now)) return null;
  await remember(context, taskId, fresh);
  if (!fresh) return GONE;
  // Handed in already (on the website, or by an earlier click): the receipt is what Edunex says.
  if (fresh.answer?.sent) return { outcome: "submitted", task: fresh };
  return { outcome: fresh.opensAt !== null && now < fresh.opensAt ? "not-open" : "closed", task: fresh };
}

/** Edunex refused a write: if the Task stopped taking answers meanwhile (closed midway), say that; else pass the refusal on. */
async function refusedMidway<T>(context: SourceContext, client: EdunexClient, fresh: Task, work: () => Promise<T>): Promise<T | HandInResult> {
  try {
    return await work();
  } catch (error) {
    if (!isEngineError(error, "Rejected")) throw error;
    const now = await readBack(context, client, fresh).catch(() => undefined);
    if (now === undefined) throw error;
    const refused = await refusal(context, fresh.id, now);
    if (refused) return refused;
    throw error;
  }
}

/**
 * Writes the draft: creates the answer when Edunex has none (as checked live,
 * without files), then puts exactly these files in it. `kept`: Edunex, read
 * back, holds exactly these files in a draft.
 */
async function saveAnswer(
  context: SourceContext,
  session: EdunexSession,
  client: EdunexClient,
  fresh: Task,
  handIn: HandIn,
): Promise<{ task: Task | null; kept: boolean }> {
  for (const file of handIn.files) {
    const already = fresh.answer?.files.some((existing) => sameFile(existing, file));
    if (!already && !isStorageUrl(file.url)) throw new EngineError("Rejected", `${file.name} isn't on Edunex's storage`);
  }
  const kept = (task: Task | null) => Boolean(task?.answer && !task.answer.sent && holdsFiles(task.answer.files, handIn.files));
  let answer = fresh.answer;
  if (!answer) {
    await write(context, session, "POST", "/course/task/answers", answerBodies.create(fresh.id));
    const created = await readBack(context, client, fresh);
    answer = created?.answer ?? null;
    if (!answer || answer.sent || kept(created)) return { task: created, kept: kept(created) };
  }
  await write(context, session, "PATCH", `/course/task/answers/${answer.id}`, answerBodies.update(fresh.id, answer.text, handIn.files));
  const after = await readBack(context, client, fresh);
  return { task: after, kept: kept(after) };
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

/** A write to Edunex's API. A refusal is "Rejected"; an ended session "Unauthorized". */
async function write(context: SourceContext, session: EdunexSession, method: "POST" | "PATCH", path: string, body: unknown): Promise<unknown> {
  let response: HttpResponse;
  try {
    response = await context.transport.request({
      method,
      url: new URL(path, EDUNEX_API).toString(),
      headers: {
        authorization: `Bearer ${session.token}`,
        accept: "application/json",
        "content-type": "application/json",
        "user-agent": context.userAgent,
      },
      body: JSON.stringify(body),
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

/** The file itself goes straight to Edunex's storage, as the website sends it; Edunex's sign-in never goes there. */
async function put(transport: Transport, userAgent: string, url: string, contentType: string, bytes: Uint8Array): Promise<void> {
  // Room for a slow connection: a minute, plus a second for every 50 KB.
  const timeoutMs = Math.min(30 * 60_000, 60_000 + Math.ceil(bytes.byteLength / 50));
  let response: HttpResponse;
  try {
    response = await transport.request({
      method: "PUT",
      url,
      headers: { "x-ms-blob-type": "BlockBlob", "content-type": contentType, "user-agent": userAgent },
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
