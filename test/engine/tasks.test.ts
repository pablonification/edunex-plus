// v2-04 (#72), seam 1: every Task of the term with its true status, read from
// each course's Task list (answers included) against the pretend Edunex.
import { describe, expect, it } from "vitest";
import type { Task } from "../../src/core/models";
import { editedAfterSubmit, shortWindow, taskHistory } from "../../src/core/tasks";
import { PRETEND_TOKEN, wib } from "../pretend/edunex";
import { type Harness, startEngine } from "./harness";

const MINUTE = 60_000;
const at = (iso: string) => Date.parse(iso);

const signedIn = async (now?: string) => {
  const h = await startEngine({ now });
  await h.engine.signIn("edunex", { token: PRETEND_TOKEN });
  return h;
};
const tasks = (h: Harness): Task[] => h.dataset("edunex.tasks") ?? [];
const task = (h: Harness, id: number): Task => {
  const found = tasks(h).find((t) => t.id === id);
  if (!found) throw new Error(`Task ${id} isn't in the list`);
  return found;
};
const statuses = (h: Harness) => Object.fromEntries(tasks(h).map((t) => [t.id, t.status]));

describe("Tasks with their true status", () => {
  it("lists every Task of the term from each course's Task list, with the Student's answers", async () => {
    const h = await signedIn();
    expect(statuses(h)).toEqual({
      113986: "submitted",
      117001: "submitted",
      117003: "not_started",
      117010: "not_started",
      117023: "not_started",
      117044: "submitted",
      117432: "submitted",
      117764: "not_started",
      117873: "not_started",
      118842: "submitted",
    });
    // Soonest deadline first.
    expect(tasks(h).map((t) => t.id)).toEqual([117044, 118842, 117001, 113986, 117432, 117003, 117764, 117010, 117023, 117873]);
    expect(task(h, 117003)).toMatchObject({ courseCode: "II4091", courseId: 95326, moduleId: 450222, title: "Tugas 02 Bab II", score: null });
    expect(h.status("edunex").state).toBe("live");
  });

  it("never reads Edunex's To Do feed, which has no submit status", async () => {
    const h = await signedIn();
    await h.wait(2 * 60 * MINUTE);
    expect(h.world.log.some((r) => new URL(r.url).pathname === "/todo")).toBe(false);
  });

  it("deadlines are exact instants, including Edunex's answer times that carry no time zone", async () => {
    const h = await signedIn();
    // The To Do feed says "2026-10-22T23:50:00.000Z" for this one: WIB wrongly marked UTC, 7 hours off.
    expect(task(h, 117764).dueAt).toBe(at("2026-10-22T23:50:00+07:00"));
    expect(task(h, 117764).opensAt).toBe(at("2026-09-17T08:43:00+07:00"));
    // Answer times come as "2026-09-16 15:29:06": WIB.
    expect(task(h, 117432).answer).toMatchObject({ sent: true, sentAt: at("2026-09-16T15:29:06+07:00"), createdAt: at("2026-09-16T15:28:42+07:00") });
  });

  it("shows the Task's instructions, the lecturer's files and its rules", async () => {
    const h = await signedIn();
    expect(task(h, 117764)).toMatchObject({
      kind: "uts",
      instructions: "<p>Soal lihat .pdf</p>",
      files: [{ name: "UTS MARKOM SEM 1 2026 2027.pdf", url: "https://edunexfixture.blob.core.windows.net/edunex/fixture-8" }],
      fileRequired: true,
      lateAllowed: false,
    });
    expect(task(h, 117003)).toMatchObject({ kind: "task", lateAllowed: true, fileRequired: true });
    expect(task(h, 117432).answer?.files).toEqual([{ name: "TUGAS IMPACT ON INNOVATION THE ECONOMY - 18223901.pdf", url: "https://edunexfixture.blob.core.windows.net/edunex/fixture-9" }]);
  });

  it("names the module each Task sits in, from the course outline", async () => {
    const h = await signedIn();
    expect(task(h, 117003).module).toEqual({ index: 5, name: "Tugas" });
    expect(task(h, 117873).module).toEqual({ index: 4, name: "Production Process Innovation" });
    expect(task(h, 117764).module).toEqual({ index: 1, name: "UTS Markom" });
  });

  it("says what Edunex doesn't: edited after posting, edited after the Student submitted, a short answer window", async () => {
    const h = await signedIn();
    // Edited a week after posting, nobody had submitted yet.
    expect(task(h, 117764).editedAt).toBe(at("2026-09-24T11:11:59+07:00"));
    expect(editedAfterSubmit(task(h, 117764))).toBe(false);
    // Edited four days after the Student handed it in.
    expect(task(h, 117001).editedAt).toBe(at("2026-09-22T20:08:31+07:00"));
    expect(editedAfterSubmit(task(h, 117001))).toBe(true);
    // A touch right after posting is part of posting it.
    expect(task(h, 117044).editedAt).toBeNull();
    // Open three hours, during class.
    expect(shortWindow(task(h, 118842))).toBe(3 * 60 * MINUTE);
    expect(shortWindow(task(h, 117003))).toBeNull();
  });

  it("builds the Task's history from Edunex's timestamps", async () => {
    const h = await signedIn();
    expect(taskHistory(task(h, 117001))).toEqual([
      { kind: "posted", at: at("2026-09-11T09:59:59+07:00") },
      { kind: "opens", at: at("2026-09-11T15:00:00+07:00") },
      { kind: "draft", at: at("2026-09-18T17:15:26+07:00") },
      { kind: "submitted", at: at("2026-09-18T19:12:22+07:00") },
      { kind: "edited", at: at("2026-09-22T20:08:31+07:00") },
      { kind: "deadline", at: at("2026-09-25T23:59:00+07:00") },
    ]);
    // Opened as it was posted, and created then sent within a minute on the website: no separate steps for those.
    expect(taskHistory(task(h, 117432)).map((s) => s.kind)).toEqual(["posted", "submitted", "edited", "deadline"]);
  });

  it("a draft is never a submission, whatever its timestamps say", async () => {
    const h = await signedIn();
    h.world.edunex.draftOnWebsite(117873);
    await h.engine.refresh("edunex");
    const draft = task(h, 117873);
    expect(draft.status).toBe("draft");
    // Edunex stamped sent_at on the draft too.
    expect(h.world.edunex.task(117873).attributes.answers[0].sent_at).not.toBeNull();
    expect(draft.answer).toMatchObject({ sent: false, sentAt: null });
    expect(draft.answer?.files.map((f) => f.name)).toEqual(["draf.pdf"]);
  });

  it("a Task Edunex never announces shows up on the next check, about every 15 minutes", async () => {
    const h = await signedIn();
    const id = h.world.edunex.postTask(95059, { name: "Tugas 1 Infrastruktur" }, { announce: false });
    await h.wait(10 * MINUTE);
    expect(tasks(h).some((t) => t.id === id)).toBe(false);
    await h.wait(8 * MINUTE);
    expect(task(h, id)).toMatchObject({ title: "Tugas 1 Infrastruktur", courseCode: "PL3032", status: "not_started" });
  });

  it("a Task Edunex announces shows up within minutes", async () => {
    const h = await signedIn();
    const id = h.world.edunex.postTask(95059, { name: "Tugas 2 Infrastruktur" });
    await h.wait(4 * MINUTE);
    expect(task(h, id)).toMatchObject({ title: "Tugas 2 Infrastruktur", courseCode: "PL3032", status: "not_started" });
  });

  it("an extended deadline shows, and the Task counts as edited", async () => {
    const h = await signedIn();
    await h.wait(3 * 60 * MINUTE);
    h.world.edunex.moveDeadline(117003, "2026-10-20T23:59:00+07:00");
    await h.engine.refresh("edunex");
    expect(task(h, 117003).dueAt).toBe(at("2026-10-20T23:59:00+07:00"));
    expect(task(h, 117003).editedAt).toBe(h.world.clock.now());
  });

  it("a Task the lecturer closes shows as closed", async () => {
    const h = await signedIn();
    h.world.edunex.closeTask(117010);
    await h.engine.refresh("edunex");
    expect(task(h, 117010).status).toBe("closed");
  });

  it("past its deadline: overdue while late submission is allowed, closed when it isn't", async () => {
    const h = await signedIn("2026-10-17T08:00:00+07:00");
    // Tugas 02 Bab II was due 16 Oct and allows late submission; Edunex keeps it open.
    expect(task(h, 117003).status).toBe("overdue");
    // A short in-class Task that allowed no late answers, past its end.
    const id = h.world.edunex.postTask(92948, { end_at: wib(h.world.clock.now() + 60 * MINUTE), is_lateable: false });
    await h.engine.refresh("edunex");
    expect(task(h, id).status).toBe("not_started");
    await h.world.clock.advance(61 * MINUTE);
    await h.engine.refresh("edunex");
    expect(task(h, id).status).toBe("closed");
  });

  it("an answer in review, then the score once the lecturer shows it", async () => {
    const h = await signedIn();
    h.world.edunex.reviewAnswer(117001);
    await h.engine.refresh("edunex");
    expect(task(h, 117001)).toMatchObject({ status: "in_review", score: null });
    h.world.edunex.publishScore(117001, 88);
    await h.engine.refresh("edunex");
    expect(task(h, 117001)).toMatchObject({ status: "submitted", score: 88 });
  });

  it("Edunex's placeholder 0 is never shown as a score", async () => {
    const h = await signedIn();
    h.world.edunex.publishScore(117044, 0);
    await h.engine.refresh("edunex");
    expect(task(h, 117044)).toMatchObject({ status: "submitted", score: null });
    // Once the lecturer has verified it, a 0 is a real score.
    h.world.edunex.reviewAnswer(117044);
    await h.engine.refresh("edunex");
    expect(task(h, 117044)).toMatchObject({ status: "submitted", score: 0 });
  });

  it("the Student submitted on the website: submitted on the next check", async () => {
    const h = await signedIn();
    h.world.edunex.submitOnWebsite(117873);
    await h.engine.refresh("edunex");
    expect(task(h, 117873).status).toBe("submitted");
    expect(task(h, 117873).answer?.sentAt).toBe(h.world.clock.now() - (h.world.clock.now() % 1000));
  });

  it("two answers on Edunex for one Task: the handed-in one counts", async () => {
    const h = await signedIn();
    h.world.edunex.draftOnWebsite(117432, "later-draft.pdf");
    await h.engine.refresh("edunex");
    expect(task(h, 117432)).toMatchObject({ status: "submitted" });
    expect(task(h, 117432).answer?.files.map((f) => f.name)).toEqual(["TUGAS IMPACT ON INNOVATION THE ECONOMY - 18223901.pdf"]);
  });

  it("a course with no Tasks, and a parent class without any, are simply empty", async () => {
    const h = await signedIn();
    expect(tasks(h).filter((t) => t.courseCode === "PL3032")).toEqual([]);
    expect(h.world.log.some((r) => r.url.includes("filter%5Bcourse_id%5D%5Bis%5D=97602"))).toBe(true);
    expect(h.status("edunex").state).toBe("live");
  });

  it("a Task in the parent class shows under its course", async () => {
    const h = await signedIn();
    const id = h.world.edunex.postTask(97602, { name: "Tugas Kelas Induk" });
    await h.engine.refresh("edunex");
    expect(task(h, id)).toMatchObject({ courseCode: "II4091", courseId: 97602 });
  });

  it("only reads: hours of checking never write anything", async () => {
    const h = await signedIn();
    await h.wait(6 * 60 * MINUTE);
    expect(h.world.edunex.writes).toEqual([]);
    expect(h.world.log.every((r) => r.method === "GET")).toBe(true);
  });

  it("Edunex changing the Task list says so and keeps the last Tasks", async () => {
    const h = await signedIn();
    h.world.edunex.mangle(/^\/course\/tasks$/, { kind: "missing-field", field: "end_at" });
    await h.engine.refresh("edunex");
    expect(h.status("edunex").state).toBe("changed");
    expect(h.status("edunex").detail).toContain("end_at");
    expect(tasks(h)).toHaveLength(10);
  });

  it("an unreadable deadline is a vendor change, never a guess", async () => {
    const h = await signedIn();
    h.world.edunex.editTask(117003, { end_at: "16/10/2026 23:59" });
    await h.engine.refresh("edunex");
    expect(h.status("edunex").state).toBe("changed");
    expect(task(h, 117003).dueAt).toBe(at("2026-10-16T23:59:00+07:00"));
  });

  it("one course's list failing keeps its last Tasks, and the others' new Tasks still show", async () => {
    const h = await signedIn();
    // DK4073 is read first.
    h.world.edunex.fail(/^\/course\/tasks$/, 404, 1);
    const id = h.world.edunex.postTask(95001, { name: "Tugas Baru PL3002" });
    await h.engine.refresh("edunex");
    expect(h.status("edunex").state).toBe("changed");
    expect(task(h, 117764).title).toBe("UTS Markom");
    expect(task(h, id).title).toBe("Tugas Baru PL3002");
  });

  it("without a network: offline, the last Tasks kept", async () => {
    const h = await signedIn();
    h.world.setOffline(true);
    await h.engine.refresh("edunex");
    expect(h.status("edunex").state).toBe("offline");
    expect(tasks(h)).toHaveLength(10);
  });

  it("after a restart the saved Tasks show at once, before any request", async () => {
    const first = await signedIn();
    first.engine.stop();
    first.world.setOffline(true);
    const again = await startEngine({ world: first.world, storage: first.storage, vault: first.vault, start: false });
    expect(again.dataset("edunex.tasks")).toHaveLength(10);
  });
});
