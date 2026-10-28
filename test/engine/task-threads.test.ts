// The thread under each of the Student's answers, and what a lecturer says there or by handing a Task back, read by the
// real engine against the pretend Edunex (seeded with the recorded threads) on a fake clock.
import { describe, expect, it } from "vitest";
import type { TaskCommentResult } from "../../src/core/actions/tasks";
import type { TaskThread } from "../../src/core/models";
import { isEngineError } from "../../src/engine/errors";
import { PRETEND_TOKEN } from "../pretend/edunex";
import type { PretendWorld } from "../pretend/world";
import { STUDENT, startAttendance } from "./attendance-harness";
import { type Harness, startEngine } from "./harness";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
/** Tugas 01 Bab I (II4091): handed in 18 Sep, and its recorded thread has one message from the lecturer, 22 Sep. */
const BAB_I = { taskId: 117001, answerId: 2698258 };

const signedIn = async (now: string) => {
  const h = await startEngine({ now });
  await h.engine.signIn("edunex", { token: PRETEND_TOKEN });
  await h.wait(MINUTE);
  return h;
};
const thread = (h: Harness, answerId: number): TaskThread | undefined => h.dataset("edunex.taskThreads")?.find((t) => t.answerId === answerId);
const reads = (world: PretendWorld, answerId: number) =>
  world.log.filter((r) => {
    const url = new URL(r.url);
    return url.pathname === "/course/comments" && url.searchParams.get("filter[commentable_id][is]") === String(answerId);
  }).length;

describe("the thread under the Student's answer", () => {
  it("is read for each answer, oldest message first, saying who wrote it", async () => {
    const h = await signedIn("2026-10-08T08:00:00+07:00");
    h.world.edunex.comment(BAB_I.taskId, "<p>Sudah saya perbaiki, Bu.</p>", "STUDENT");
    h.world.edunex.comment(BAB_I.taskId, "<p>Lihat catatan di berkas.</p>", "LECTURER", [
      { name: "bab1-catatan.pdf", file: "https://edunexfixture.blob.core.windows.net/edunex/fixture-c1" },
    ]);
    h.world.edunex.handBack(BAB_I.taskId);
    await h.engine.refresh("edunex");
    await h.wait(MINUTE);
    expect(thread(h, BAB_I.answerId)?.messages).toEqual([
      { id: 99136, at: Date.parse("2026-09-22T20:59:02+07:00"), from: "lecturer", name: "Dr. Fajar Yuliana, S.T., M.T.", html: "<p>Komentar.</p>", files: [] },
      expect.objectContaining({ from: "me", html: "<p>Sudah saya perbaiki, Bu.</p>" }),
      expect.objectContaining({
        from: "lecturer",
        files: [{ name: "bab1-catatan.pdf", url: "https://edunexfixture.blob.core.windows.net/edunex/fixture-c1" }],
      }),
    ]);
    // Only answers have threads: a Task not started has none to read.
    expect(h.world.log.filter((r) => new URL(r.url).pathname === "/course/comments").length).toBeGreaterThan(0);
    expect(h.dataset("edunex.taskThreads")?.every((t) => h.dataset("edunex.tasks")?.some((task) => task.answer?.id === t.answerId))).toBe(true);
  });

  it("is read again at once when its answer changes, and otherwise hourly only while its Task is recent", async () => {
    // A month after its last message: nothing about it is recent.
    const h = await signedIn("2026-10-28T08:00:00+07:00");
    const first = reads(h.world, BAB_I.answerId);
    expect(first).toBe(1);
    await h.wait(3 * HOUR);
    expect(reads(h.world, BAB_I.answerId)).toBe(first);
    // Handed back: the answer changed, so its thread may say why.
    h.world.edunex.handBack(BAB_I.taskId);
    await h.engine.refresh("edunex");
    await h.wait(MINUTE);
    expect(reads(h.world, BAB_I.answerId)).toBe(first + 1);
  });

  it("while its Task is recent, a message the lecturer writes shows within the hour", async () => {
    const h = await signedIn("2026-09-23T08:00:00+07:00");
    h.world.edunex.comment(BAB_I.taskId, "<p>Tambahkan sumber.</p>");
    await h.wait(HOUR + 20 * MINUTE);
    expect(thread(h, BAB_I.answerId)?.messages.map((m) => m.html)).toContain("<p>Tambahkan sumber.</p>");
  });
});

describe("the Student writing under their answer", () => {
  const comment = (h: Harness, taskId: number, text: string) => h.engine.act("edunex", "comment", { taskId, text }) as Promise<TaskCommentResult>;
  const refusal = async (work: Promise<unknown>) => {
    try {
      await work;
    } catch (error) {
      if (isEngineError(error)) return error.kind;
      throw error;
    }
    return null;
  };
  const posts = (h: Harness) => h.world.edunex.writes.filter((w) => w.path === "/course/comments");

  it("goes once, as the website's comment box sends it, and counts as sent once the thread read back holds it", async () => {
    const h = await signedIn("2026-10-08T08:00:00+07:00");
    const result = await comment(
      h,
      BAB_I.taskId,
      '<p>Baik, Bu. <strong>Saya</strong> perbaiki.</p><script>alert(1)</script><p onclick="x()">Terima kasih.</p>',
    );
    expect(result.outcome).toBe("sent");
    // Cleaned as an answer is: the formatting stays, nothing that runs.
    expect(posts(h)).toEqual([
      {
        method: "POST",
        path: "/course/comments",
        body: {
          comment: "<p>Baik, Bu. <strong>Saya</strong> perbaiki.</p><p>Terima kasih.</p>",
          commentable_id: BAB_I.answerId,
          commentable_type: "task_answer",
        },
      },
    ]);
    expect(thread(h, BAB_I.answerId)?.messages.at(-1)).toMatchObject({
      from: "me",
      html: "<p>Baik, Bu. <strong>Saya</strong> perbaiki.</p><p>Terima kasih.</p>",
    });
    // A comment of their own is never an alert, nor a reason to read the thread again.
    expect(result.thread?.messages.at(-1)?.from).toBe("me");
  });

  it("is refused before anything is sent: no answer yet, no words, or a group Task", async () => {
    const h = await signedIn("2026-10-08T08:00:00+07:00");
    // Tugas 02 Bab II has no answer: the thread hangs off an answer.
    expect(await refusal(comment(h, 117003, "<p>Bu, boleh tanya?</p>"))).toBe("Rejected");
    expect(await refusal(comment(h, BAB_I.taskId, "<p> </p>"))).toBe("Rejected");
    const id = h.world.edunex.postTask(95326, { name: "Tugas Kelompok 1", type: "GROUP" });
    await h.engine.refresh("edunex");
    expect(await refusal(comment(h, id, "<p>Halo.</p>"))).toBe("Rejected");
    expect(posts(h)).toEqual([]);
  });
});

describe("what a lecturer says, as alerts", () => {
  const start = async () => {
    const app = await startAttendance({ six: { student: STUDENT, courses: [], schedule: [] } });
    await app.until("2026-10-08T09:00:00+07:00");
    return app;
  };

  it("a new message from the lecturer: an alert naming the Task and quoting it, opening the Task", async () => {
    const app = await start();
    app.world.edunex.comment(BAB_I.taskId, "<p>Tolong <b>perbaiki</b> daftar pustaka.</p>");
    await app.until("2026-10-08T11:00:00+07:00");
    expect(app.of("taskComment").map((n) => n.text)).toEqual(["Komentar dosen · II4091 — Tugas 01 Bab I · Tolong perbaiki daftar pustaka."]);
    expect(app.of("taskComment")[0]).toMatchObject({ source: "edunex", target: { screen: "task", taskId: BAB_I.taskId } });
  });

  it("the Student's own message, and the ones already there, aren't announced", async () => {
    const app = await start();
    app.world.edunex.comment(BAB_I.taskId, "<p>Baik, Bu.</p>", "STUDENT");
    await app.until("2026-10-08T11:00:00+07:00");
    expect(app.of("taskComment")).toEqual([]);
  });

  it("handed back: at once, and the message written with it is the hand-back's, not a second alert", async () => {
    const app = await start();
    app.world.edunex.comment(BAB_I.taskId, "<p>Bab I perlu perbaikan.</p>");
    app.world.edunex.handBack(BAB_I.taskId);
    await app.until("2026-10-08T09:30:00+07:00");
    expect(app.of("taskHandedBack").map((n) => n.text)).toEqual(["Tugas dikembalikan · II4091 — Tugas 01 Bab I · perbaiki lalu kumpulkan lagi"]);
    expect(app.of("taskHandedBack")[0]).toMatchObject({ target: { screen: "task", taskId: BAB_I.taskId } });
    await app.until("2026-10-08T11:00:00+07:00");
    expect(app.of("taskComment")).toEqual([]);
    expect(app.of("taskHandedBack")).toHaveLength(1);
  });
});
