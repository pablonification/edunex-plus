// v2-05 (#73), seam 1: handing a Task in against the pretend Edunex. Files go
// up through Edunex's own upload flow, a draft never makes a second answer,
// and a submit counts only once Edunex says so when the Task is read back.
// Every request is what Edunex's own website sends (its public code).
import { describe, expect, it } from "vitest";
import type { HandInResult } from "../../src/core/actions/tasks";
import type { Task, TaskFile } from "../../src/core/models";
import { isEngineError } from "../../src/engine/errors";
import { PRETEND_TOKEN } from "../pretend/edunex";
import { type Harness, startEngine } from "./harness";

const MINUTE = 60_000;

const signedIn = async (now?: string) => {
  const h = await startEngine({ now });
  await h.engine.signIn("edunex", { token: PRETEND_TOKEN });
  return h;
};
const task = (h: Harness, id: number): Task => {
  const found = h.dataset("edunex.tasks")?.find((t) => t.id === id);
  if (!found) throw new Error(`Task ${id} isn't in the list`);
  return found;
};
const upload = async (h: Harness, name = "jawaban.pdf", content = "%PDF-1.7 jawaban", taskId = OPEN): Promise<TaskFile> => {
  const bytes = new TextEncoder().encode(content);
  const { url } = (await h.engine.act("edunex", "uploadFile", { taskId, name, contentType: "application/pdf", bytes })) as TaskFile;
  return { name, url };
};
/** The last change request of a kind ("PATCH /course/task/answers"), with the fields Edunex reads. */
const lastWrite = (h: Harness, method: string, path: RegExp) => h.world.edunex.writes.filter((w) => w.method === method && path.test(w.path)).at(-1)?.body;
const saveDraft = (h: Harness, taskId: number, files: TaskFile[]) => h.engine.act("edunex", "saveDraft", { taskId, files }) as Promise<HandInResult>;
const submit = (h: Harness, taskId: number, files: TaskFile[]) => h.engine.act("edunex", "submit", { taskId, files }) as Promise<HandInResult>;
const answerWrites = (h: Harness) =>
  h.world.edunex.writes.filter((w) => w.path.startsWith("/course/task/answers")).map((w) => `${w.method} ${w.path.replace(/\d+$/, ":id")}`);
const answersOn = (h: Harness, taskId: number) => h.world.edunex.task(taskId).attributes.answers;
const failure = async (work: Promise<unknown>) => {
  try {
    await work;
  } catch (error) {
    if (isEngineError(error)) return error;
    throw error;
  }
  throw new Error("expected the action to fail");
};

// Tugas 02 Bab II (II4091, course 95326 "Final Project Proposal", module 450222 "Tugas"): open, file required, late allowed, no answer yet.
const OPEN = 117003;
// UTS Markom (DK4073): open, file required, no late answers.
const UTS = 117764;

describe("uploading a file", () => {
  it("goes through Edunex's own flow: an upload link for the website's storage path, then the file with the website's headers", async () => {
    const h = await signedIn();
    const now = h.world.clock.now();
    const file = await upload(h, "Bab II.pdf", "%PDF bab dua");
    // {year}/{course id}-{course}/{module id}-{module}/task/{user id}/{ms}_{name without extension}, spaces as "-".
    const path = `2026/95326-Final-Project-Proposal/450222-Tugas/task/${h.world.edunex.userId}/${now}_Bab-II`;
    expect(h.world.edunex.writes).toEqual([
      { method: "POST", path: "/blob-storage/sas", body: { files: [{ fileName: path, contentType: "application/pdf", sizeInBytes: 12 }] } },
    ]);
    // The link Edunex gave for that path.
    expect(file.url).toBe(`https://edunexfixture.blob.core.windows.net/edunex/upload/${path}`);
    expect(Buffer.from(h.world.blobs.get(new URL(file.url).pathname) as Uint8Array).toString()).toBe("%PDF bab dua");
    expect(h.world.blobHeaders.get(new URL(file.url).pathname)).toMatchObject({
      "x-ms-blob-type": "BlockBlob",
      "content-type": "application/pdf",
      "content-disposition": "inline",
    });
    // The module's name and the Student's id are read as the website reads them; Edunex's token never goes to the storage.
    expect(h.world.log.map((r) => new URL(r.url).pathname)).toEqual(expect.arrayContaining(["/course/modules/450222", "/login/me"]));
    expect(h.world.blobHeaders.get(new URL(file.url).pathname)?.authorization).toBeUndefined();
    // Uploading attaches nothing yet.
    expect(answersOn(h, OPEN)).toEqual([]);
  });

  it("a Task gone from Edunex takes no upload, and the file isn't blamed for it", async () => {
    const h = await signedIn();
    h.world.edunex.tasks.set(
      95326,
      (h.world.edunex.tasks.get(95326) ?? []).filter((t) => Number(t.id) !== OPEN),
    );
    expect(await failure(upload(h))).toMatchObject({ kind: "Failed", message: `Task ${OPEN} is no longer on Edunex` });
    expect(h.world.edunex.writes).toEqual([]);
  });

  it("an upload link Edunex didn't give is a vendor change, never a guess", async () => {
    const h = await signedIn();
    h.world.edunex.mangle(/^\/blob-storage\/sas$/, { kind: "missing-field", field: "files" }, 1);
    expect(await failure(upload(h))).toMatchObject({ kind: "VendorChanged", message: "/blob-storage/sas: no upload link in the answer" });
    expect(h.world.blobs.size).toBe(0);
  });

  it("a failed upload is a clear error and attaches nothing", async () => {
    const h = await signedIn();
    h.world.failUploads(503);
    expect(await failure(upload(h))).toMatchObject({ kind: "Failed", message: "Edunex's storage refused the file (503)" });
    h.world.failUploads("network");
    expect((await failure(upload(h))).kind).toBe("Offline");
    expect(answerWrites(h)).toEqual([]);
    // The same file goes up on the next try.
    await upload(h);
  });

  it("a file over 100 MB, or of a kind Edunex doesn't take, is refused before anything is sent", async () => {
    const h = await signedIn();
    const big = new Uint8Array(100 * 1024 * 1024 + 1);
    expect((await failure(h.engine.act("edunex", "uploadFile", { taskId: OPEN, name: "rekaman.zip", contentType: "application/zip", bytes: big }))).kind).toBe(
      "Rejected",
    );
    const video = { taskId: OPEN, name: "presentasi.mp4", contentType: "video/mp4", bytes: new Uint8Array(10) };
    expect((await failure(h.engine.act("edunex", "uploadFile", video))).kind).toBe("Rejected");
    expect(h.world.edunex.writes).toEqual([]);
  });
});

describe("a group Task", () => {
  it("is never written to: the group hands it in on Edunex", async () => {
    const h = await signedIn();
    const id = h.world.edunex.postTask(95326, { name: "Tugas Kelompok 1", type: "GROUP" });
    await h.engine.refresh("edunex");
    expect(task(h, id).group).toBe(true);
    expect(task(h, OPEN).group).toBe(false);
    expect((await failure(upload(h, "kelompok.pdf", "%PDF", id))).kind).toBe("Rejected");
    const file = await upload(h);
    expect((await failure(saveDraft(h, id, [file]))).kind).toBe("Rejected");
    expect((await failure(submit(h, id, [file]))).kind).toBe("Rejected");
    expect(answerWrites(h)).toEqual([]);
  });
});

describe("saving a draft", () => {
  it("the first draft creates one answer with its files in one request, as the website does", async () => {
    const h = await signedIn();
    const file = await upload(h);
    const result = await saveDraft(h, OPEN, [file]);
    expect(result.outcome).toBe("saved");
    expect(answerWrites(h)).toEqual(["POST /course/task/answers"]);
    expect(lastWrite(h, "POST", /^\/course\/task\/answers$/)).toEqual({
      task_id: OPEN,
      files: [{ file: file.url, name: "jawaban.pdf" }],
      answer: "",
      is_sent: 0,
    });
    expect(task(h, OPEN).status).toBe("draft");
    expect(task(h, OPEN).answer?.files).toEqual([file]);
    expect(task(h, OPEN).answer?.sentAt).toBeNull();
  });

  it("a draft update changes the existing answer, never adds a second one", async () => {
    const h = await signedIn();
    const first = await upload(h, "bab2-v1.pdf");
    await saveDraft(h, OPEN, [first]);
    const second = await upload(h, "bab2-v2.pdf");
    expect((await saveDraft(h, OPEN, [second])).outcome).toBe("saved");
    expect(answerWrites(h)).toEqual(["POST /course/task/answers", "PATCH /course/task/answers/:id"]);
    expect(answersOn(h, OPEN)).toHaveLength(1);
    expect(task(h, OPEN).answer?.files.map((f) => f.name)).toEqual(["bab2-v2.pdf"]);
  });

  it("a file kept goes back as Edunex's own record of it, a new one as its link and name, as the website sends them", async () => {
    const h = await signedIn();
    const first = await upload(h, "bab2.pdf");
    await saveDraft(h, OPEN, [first]);
    const record = structuredClone(answersOn(h, OPEN)[0].files[0]);
    const second = await upload(h, "lampiran.pdf");
    expect((await saveDraft(h, OPEN, [first, second])).outcome).toBe("saved");
    expect(lastWrite(h, "PATCH", /^\/course\/task\/answers\/\d+$/)?.files).toEqual([record, { file: second.url, name: "lampiran.pdf" }]);
    // Edunex still holds the same file, not a copy of it.
    expect(answersOn(h, OPEN)[0].files[0].id).toBe(record.id);
  });

  it("an answer's text from the website is sent back as it is", async () => {
    const h = await signedIn();
    h.world.edunex.draftOnWebsite(OPEN, "draf.pdf", "<p>Berikut <strong>Bab II</strong>.</p>");
    await h.engine.refresh("edunex");
    const file = await upload(h);
    await saveDraft(h, OPEN, [file]);
    expect(lastWrite(h, "PATCH", /^\/course\/task\/answers\/\d+$/)).toMatchObject({ answer: "<p>Berikut <strong>Bab II</strong>.</p>", is_sent: 0 });
  });

  it("re-reads Edunex first: a draft saved on the website since the last check is updated, not duplicated", async () => {
    const h = await signedIn();
    h.world.edunex.draftOnWebsite(OPEN);
    expect(task(h, OPEN).answer).toBeNull();
    const file = await upload(h);
    await saveDraft(h, OPEN, [file]);
    expect(answerWrites(h)).toEqual(["PATCH /course/task/answers/:id"]);
    expect(answersOn(h, OPEN)).toHaveLength(1);
  });

  it("two clicks at once still make one answer", async () => {
    const h = await signedIn();
    const file = await upload(h);
    const [a, b] = await Promise.all([saveDraft(h, OPEN, [file]), saveDraft(h, OPEN, [file])]);
    expect([a.outcome, b.outcome]).toEqual(["saved", "saved"]);
    expect(answersOn(h, OPEN)).toHaveLength(1);
    expect(answerWrites(h)).toEqual(["POST /course/task/answers", "PATCH /course/task/answers/:id"]);
  });

  it("only files on Edunex's storage are ever attached", async () => {
    const h = await signedIn();
    const error = await failure(saveDraft(h, OPEN, [{ name: "x.pdf", url: "https://files.example.com/x.pdf" }]));
    expect(error.kind).toBe("Rejected");
    expect(answerWrites(h)).toEqual([]);
  });

  it("a Task already handed in on the website is left alone", async () => {
    const h = await signedIn();
    h.world.edunex.submitOnWebsite(OPEN);
    const file = await upload(h);
    const result = await saveDraft(h, OPEN, [file]);
    expect(result.outcome).toBe("submitted");
    expect(answerWrites(h)).toEqual([]);
    expect(task(h, OPEN).status).toBe("submitted");
  });
});

describe("submitting", () => {
  it("sends the answer and counts it only once Edunex says it's submitted", async () => {
    const h = await signedIn();
    const file = await upload(h);
    const result = await submit(h, OPEN, [file]);
    expect(result.outcome).toBe("submitted");
    expect(answerWrites(h)).toEqual(["POST /course/task/answers", "PATCH /course/task/answers/:id"]);
    expect(lastWrite(h, "PATCH", /^\/course\/task\/answers\/\d+$/)).toEqual({ is_sent: 1 });
    // Then, as the website does, the lecturer's cached "download all answers" file is cleared so it includes this one.
    expect(h.world.edunex.writes.at(-1)).toEqual({ method: "DELETE", path: `/blob-storage//task/${OPEN}/export`, body: {} });
    expect(h.world.edunex.exportsCleared).toEqual([OPEN]);
    expect(task(h, OPEN)).toMatchObject({ status: "submitted" });
    expect(task(h, OPEN).answer).toMatchObject({ sent: true, sentAt: h.world.clock.now(), files: [file] });
    expect(answersOn(h, OPEN)).toHaveLength(1);
  });

  it("a saved draft is submitted as it is", async () => {
    const h = await signedIn();
    const file = await upload(h);
    await saveDraft(h, OPEN, [file]);
    expect((await submit(h, OPEN, [file])).outcome).toBe("submitted");
    expect(answerWrites(h)).toEqual(["POST /course/task/answers", "PATCH /course/task/answers/:id"]);
    expect(lastWrite(h, "PATCH", /^\/course\/task\/answers\/\d+$/)).toEqual({ is_sent: 1 });
  });

  it("clearing the lecturer's cached download failing never fails the submit", async () => {
    const h = await signedIn();
    const file = await upload(h);
    h.world.edunex.fail(/\/export$/, 500, 1);
    expect((await submit(h, OPEN, [file])).outcome).toBe("submitted");
    expect(task(h, OPEN).status).toBe("submitted");
    expect(h.world.edunex.exportsCleared).toEqual([]);
  });

  it("when Edunex takes the request but doesn't show it sent, it's unconfirmed, never submitted", async () => {
    const h = await signedIn();
    const file = await upload(h);
    await saveDraft(h, OPEN, [file]);
    // Edunex answers 200 and changes nothing.
    h.world.edunex.fail(/^\/course\/task\/answers\/\d+$/, 200, 1);
    const result = await submit(h, OPEN, [file]);
    expect(result.outcome).toBe("unconfirmed");
    expect(task(h, OPEN).status).toBe("draft");
  });

  it("a Task closed midway is re-read before anything is sent", async () => {
    const h = await signedIn();
    const file = await upload(h);
    h.world.edunex.closeTask(OPEN);
    const result = await submit(h, OPEN, [file]);
    expect(result.outcome).toBe("closed");
    expect(answerWrites(h)).toEqual([]);
    expect(task(h, OPEN).status).toBe("closed");
  });

  it("Edunex refusing the write because the Task closed at that moment says closed", async () => {
    const h = await signedIn();
    const file = await upload(h);
    await saveDraft(h, OPEN, [file]);
    h.world.setLatency(1_000);
    const closing = submit(h, OPEN, [file]);
    // The app has re-read the Task (still open) and its submit is on the way when the lecturer closes it.
    await h.wait(1_500);
    h.world.edunex.closeTask(OPEN);
    await h.wait(5_000);
    expect((await closing).outcome).toBe("closed");
    expect(h.world.edunex.writes.at(-1)?.body).toEqual({ is_sent: 1 });
    expect(task(h, OPEN).status).toBe("closed");
  });

  it("Edunex refusing a write for another reason is a clear refusal, the draft untouched", async () => {
    const h = await signedIn();
    const file = await upload(h);
    await saveDraft(h, OPEN, [file]);
    h.world.edunex.fail(/^\/course\/task\/answers\/\d+$/, 422, 1);
    expect((await failure(submit(h, OPEN, [file]))).kind).toBe("Rejected");
    expect(task(h, OPEN).status).toBe("draft");
  });

  it("late allowed: past the deadline it can still be submitted; not allowed: refused", async () => {
    const h = await signedIn("2026-10-23T08:00:00+07:00");
    const file = await upload(h);
    // Tugas 02 Bab II was due 16 Oct and allows late answers.
    expect(task(h, OPEN).status).toBe("overdue");
    expect((await submit(h, OPEN, [file])).outcome).toBe("submitted");
    // UTS Markom was due 22 Oct 23:50, no late answers.
    expect(task(h, UTS).status).toBe("closed");
    expect((await submit(h, UTS, [file])).outcome).toBe("closed");
    expect(answersOn(h, UTS)).toEqual([]);
  });

  it("a Task that needs a file isn't submitted without one", async () => {
    const h = await signedIn();
    expect((await failure(submit(h, OPEN, []))).kind).toBe("Rejected");
    expect(answerWrites(h)).toEqual([]);
  });

  it("the session ending during a submit: the Student is asked to sign in again, nothing is half-sent", async () => {
    const h = await signedIn();
    const file = await upload(h);
    h.world.edunex.expireSession();
    expect((await failure(submit(h, OPEN, [file]))).kind).toBe("Unauthorized");
    await h.wait(MINUTE);
    expect(h.status("edunex").state).toBe("expired");
    expect(answersOn(h, OPEN)).toEqual([]);
    // Signed in again, the same file goes in.
    h.world.edunex.sessionValid = true;
    await h.engine.signIn("edunex", { token: PRETEND_TOKEN });
    expect((await submit(h, OPEN, [file])).outcome).toBe("submitted");
  });

  it("a check that began before a submit never puts the old state back", async () => {
    const h = await signedIn();
    const file = await upload(h);
    await saveDraft(h, UTS, [file]);
    h.world.setLatency(1_000);
    const submitting = submit(h, UTS, [file]);
    const checking = h.engine.refresh("edunex");
    await h.wait(30_000);
    await Promise.all([submitting, checking]);
    expect(task(h, UTS).status).toBe("submitted");
  });

  it("nothing is ever written in the background, before or after handing in", async () => {
    const h = await signedIn();
    const file = await upload(h);
    await submit(h, OPEN, [file]);
    const writes = h.world.edunex.writes.length;
    await h.wait(6 * 60 * MINUTE);
    expect(h.world.edunex.writes).toHaveLength(writes);
  });
});
