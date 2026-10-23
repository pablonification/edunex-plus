// The course colors stay on this computer with the Student who has them: the
// picks and the remembered automatic colors load after a restart, a color a
// later version adds doesn't cost the others, a value that can't be read is
// refused (the old one stays), signing out of one system keeps them, and
// signing out of everything removes them. Nothing is saved while nobody is
// signed in, so a write that arrives after "Sign out of everything" can't
// bring them back.
import { describe, expect, it } from "vitest";
import { PRETEND_TOKEN } from "../pretend/edunex";
import { startEngine } from "./harness";

/** A dataset file exactly as the store writes it. */
const savedFile = (name: string, value: unknown) => JSON.stringify({ format: 1, name, value, fetchedAt: 0, hash: "saved" });
const COLORS = { picks: { PL3002: { color: "blue", at: 1 } }, automatic: { DK4073: "cyan", PL3002: "indigo" } };

async function signedIn() {
  const h = await startEngine({ start: false });
  await h.engine.signIn("edunex", { token: PRETEND_TOKEN });
  return h;
}

describe("the course colors' saved data", () => {
  it("picks and remembered colors load after a restart", async () => {
    const h = await signedIn();
    await h.engine.setLocal("local.courseColors", COLORS);
    const again = await startEngine({ world: h.world, storage: h.storage, vault: h.vault, start: false });
    expect(again.dataset("local.courseColors")).toEqual(COLORS);
  });

  it("a color this version doesn't know (a later one's) loads with the rest, and is kept", async () => {
    const storage = (await startEngine({ start: false })).storage;
    const later = { picks: { PL3002: { color: "teal-2", at: 1 }, DK4073: { color: "blue", at: 2 } }, automatic: { II4091: "sunset" } };
    storage.files.set("datasets/local.courseColors.json", savedFile("local.courseColors", later));
    const h = await startEngine({ storage, start: false });
    expect(h.dataset("local.courseColors")).toEqual(later);
  });

  it("a value written before `automatic` existed loads too", async () => {
    const storage = (await startEngine({ start: false })).storage;
    storage.files.set("datasets/local.courseColors.json", savedFile("local.courseColors", { picks: {} }));
    const h = await startEngine({ storage, start: false });
    expect(h.dataset("local.courseColors")).toEqual({ picks: {} });
  });

  it("refuses a value it can't read, or one past the cap, and keeps the one it had", async () => {
    const h = await signedIn();
    await h.engine.setLocal("local.courseColors", COLORS);
    await expect(h.engine.setLocal("local.courseColors", { picks: { PL3002: { color: "#3366F0", at: 1 } } })).rejects.toMatchObject({ kind: "Rejected" });
    const tooMany = Object.fromEntries(Array.from({ length: 201 }, (_, i) => [`XX${1000 + i}`, { color: "blue", at: i }]));
    await expect(h.engine.setLocal("local.courseColors", { picks: tooMany })).rejects.toMatchObject({ kind: "Rejected" });
    expect(h.dataset("local.courseColors")).toEqual(COLORS);
  });

  it("signing out of Edunex or SIX keeps them; signing out of everything removes them, file and all", async () => {
    const h = await signedIn();
    await h.engine.setLocal("local.courseColors", COLORS);
    await h.engine.signOut("six");
    await h.engine.signOut("edunex");
    expect(h.dataset("local.courseColors")).toEqual(COLORS);

    const again = await signedIn();
    await again.engine.setLocal("local.courseColors", COLORS);
    await again.engine.signOut();
    expect(again.dataset("local.courseColors")).toBeUndefined();
    expect([...again.storage.files.keys()].filter((k) => k.startsWith("datasets/local."))).toEqual([]);
  });

  it("nothing is saved while nobody is signed in: a write after signing out of everything doesn't bring them back", async () => {
    const h = await signedIn();
    await h.engine.signOut();
    await expect(h.engine.setLocal("local.courseColors", COLORS)).rejects.toMatchObject({ kind: "Rejected" });
    expect(h.dataset("local.courseColors")).toBeUndefined();
  });
});
