// What a lecturer changed in a Task, seam 1: the real engine against the
// pretend Edunex on a fake clock. An edit between two syncs is noted against
// the copy the app had, kept across restarts, and gone at sign-out with the
// rest of Edunex; with no earlier copy nothing is noted.
import { describe, expect, it } from "vitest";
import type { TaskEdit } from "../../src/core/models";
import { PRETEND_TOKEN } from "../pretend/edunex";
import { type Harness, startEngine } from "./harness";

const MINUTE = 60_000;
const signedIn = async (options: Parameters<typeof startEngine>[0] = {}) => {
  const h = await startEngine({ now: "2026-10-07T21:00:00+07:00", ...options });
  await h.engine.signIn("edunex", { token: PRETEND_TOKEN });
  return h;
};
const edits = (h: Harness): TaskEdit[] => h.dataset("edunex.taskEdits") ?? [];
const sync = (h: Harness) => h.engine.refresh("edunex");

describe("noting what changed", () => {
  it("an edit between two syncs: one record against the earlier copy, kept across a restart", async () => {
    const h = await signedIn();
    // The first sync after signing in has nothing to compare against.
    expect(edits(h)).toEqual([]);
    const before = h.dataset("edunex.tasks")!.find((t) => t.id === 117001)!;
    h.world.edunex.editTask(117001, { end_at: "2026-10-12T23:59:00+07:00", description: "<p>Revisi Bab I memakai template baru.</p>" });
    await sync(h);
    const [record] = edits(h);
    expect(record).toMatchObject({
      taskId: 117001,
      at: h.dataset("edunex.tasks")!.find((t) => t.id === 117001)!.editedAt,
      since: before.editedAt ?? before.postedAt,
      changes: [
        { kind: "deadline", from: before.dueAt, to: Date.parse("2026-10-12T23:59:00+07:00") },
        { kind: "instructions", after: "Revisi Bab I memakai template baru." },
      ],
    });
    // Later syncs keep it as it is.
    await h.wait(30 * MINUTE);
    expect(edits(h)).toEqual([record]);
    const again = await startEngine({ world: h.world, storage: h.storage, vault: h.vault });
    expect(again.dataset("edunex.taskEdits")).toEqual([record]);
  });

  it("an edit made while the app was closed is found on the next sync", async () => {
    const h = await signedIn();
    h.engine.stop();
    h.world.edunex.editTask(117003, { is_lateable: false });
    const again = await startEngine({ world: h.world, storage: h.storage, vault: h.vault });
    await again.engine.refresh("edunex");
    expect(again.dataset("edunex.taskEdits")?.map((e) => [e.taskId, e.changes.map((c) => c.kind)])).toEqual([[117003, ["lateAllowed"]]]);
  });

  it("an edit that changes nothing compared is an empty record; a touch in the first hour after posting isn't an edit", async () => {
    const h = await signedIn();
    h.world.edunex.editTask(117003, {});
    const fresh = h.world.edunex.postTask(95326, { name: "Tugas baru" });
    await sync(h);
    h.world.edunex.editTask(fresh, { description: "<p>Ralat.</p>" });
    await sync(h);
    expect(edits(h).map((e) => [e.taskId, e.changes])).toEqual([[117003, []]]);
  });

  it("goes with the rest of Edunex at sign-out; signing back in starts without an earlier copy", async () => {
    const h = await signedIn();
    h.world.edunex.editTask(117003, { is_lateable: false });
    await sync(h);
    expect(edits(h)).toHaveLength(1);
    await h.engine.signOut("edunex");
    expect(h.dataset("edunex.taskEdits")).toBeUndefined();
    await expect(h.storage.read("datasets/edunex.taskEdits.json")).resolves.toBeNull();
    await h.engine.signIn("edunex", { token: PRETEND_TOKEN });
    expect(edits(h)).toEqual([]);
  });

  it("an edit first seen when the Student's draft is read back is noted too", async () => {
    const h = await signedIn();
    // The lecturer changes the late rule; before the next sync, the Student saves a draft and the app reads the Task back.
    h.world.edunex.editTask(117003, { is_lateable: false });
    await h.engine.act("edunex", "saveDraft", { taskId: 117003, files: [], text: "<p>Draf pertama.</p>" });
    expect(edits(h).map((e) => [e.taskId, e.changes.map((c) => c.kind)])).toEqual([[117003, ["lateAllowed"]]]);
    // The next sync sees the same edit: no second record.
    await sync(h);
    expect(edits(h)).toHaveLength(1);
  });

  it("nothing is noted while Edunex can't be reached", async () => {
    const h = await signedIn();
    h.world.edunex.editTask(117003, { is_lateable: false });
    h.world.setOffline(true);
    await sync(h).catch(() => undefined);
    expect(edits(h)).toEqual([]);
  });
});
