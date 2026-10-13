// What the Student entered for the study plan stays on this computer: the
// plan and their curriculum corrections, as earlier versions saved them, load
// after an update; a bad one is refused, never half-saved; signing out of
// everything forgets them.
import { describe, expect, it } from "vitest";
import { MemoryStorage } from "../pretend/memory";
import { startEngine } from "./harness";

/** A dataset file exactly as the store writes it. */
const savedFile = (name: string, value: unknown) => JSON.stringify({ format: 1, name, value, fetchedAt: 0, hash: "saved" });

// As the version before this one saved them.
const OLD_PLAN = {
  terms: [{ term: "2026-2", courses: [{ code: "II4092", name: "Tugas Akhir", sks: 4, grade: "AB", retake: false }] }],
  expected: { II4091: "A" },
  target: 3.5,
  minor: null,
};

describe("the study plan's saved data", () => {
  it("a plan saved by an earlier version and the Student's corrections load after a restart", async () => {
    const storage = new MemoryStorage();
    storage.files.set("datasets/local.plan.json", savedFile("local.plan", OLD_PLAN));
    const h = await startEngine({ storage, start: false });
    expect(h.dataset("local.plan")).toEqual(OLD_PLAN);

    await h.engine.setLocal("local.curriculum", { slots: { WI1111: { kind: "not-mine", at: 1 }, WI2002: { kind: "counted-as", code: "KU1102", at: 2 } } });
    const again = await startEngine({ world: h.world, storage: h.storage, vault: h.vault, start: false });
    expect(again.dataset("local.curriculum")).toEqual({
      slots: { WI1111: { kind: "not-mine", at: 1 }, WI2002: { kind: "counted-as", code: "KU1102", at: 2 } },
    });
    expect(again.dataset("local.plan")).toEqual(OLD_PLAN);
  });

  it("this term's what-ifs and hidden warnings are kept too", async () => {
    const h = await startEngine({ start: false });
    const plan = {
      ...OLD_PLAN,
      now: {
        term: "2026-1",
        // A what-if as the version before this one saved it (no `from`), and one tried from a later semester.
        added: [
          { code: "II4090", name: "Kerja Praktik", sks: 2 },
          { code: "II4010", name: "Manajemen Data", sks: 3, from: { term: "2026-2", grade: "AB", retake: false } },
        ],
        dropped: ["PL3032"],
      },
      hidden: { "parity|II4090": { reason: "program-adds", at: 3 } },
    };
    await h.engine.setLocal("local.plan", plan);
    const again = await startEngine({ world: h.world, storage: h.storage, vault: h.vault, start: false });
    expect(again.dataset("local.plan")).toEqual(plan);
  });

  it("refuses a correction it can't read, and keeps the one it had", async () => {
    const h = await startEngine({ start: false });
    await h.engine.setLocal("local.curriculum", { slots: { WI1111: { kind: "done", at: 1 } } });
    await expect(h.engine.setLocal("local.curriculum", { slots: { WI1111: { kind: "counted-as", at: 1 } } })).rejects.toMatchObject({ kind: "Rejected" });
    expect(h.dataset("local.curriculum")).toEqual({ slots: { WI1111: { kind: "done", at: 1 } } });
  });

  it("signing out of everything forgets the plan and the corrections", async () => {
    const h = await startEngine({ start: false });
    await h.engine.setLocal("local.plan", OLD_PLAN);
    await h.engine.setLocal("local.curriculum", { slots: { WI1111: { kind: "done", at: 1 } } });
    await h.engine.signOut();
    expect(h.dataset("local.plan")).toBeUndefined();
    expect(h.dataset("local.curriculum")).toBeUndefined();
    expect([...h.storage.files.keys()].filter((k) => k.startsWith("datasets/local."))).toEqual([]);
  });
});
