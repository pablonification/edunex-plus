// Highlights, and the notes kept with them, stay on this computer with the
// Student who made them: they load after a restart (what an older version
// saved, without notes, too), a color a later version adds doesn't cost the
// others, a value past the caps is refused (the old one stays), signing out of
// one system keeps them, and signing out of everything removes them, file and
// all. A different Student signing in starts with none, and nothing is saved
// while nobody is signed in.
import { describe, expect, it } from "vitest";
import type { HighlightedFile } from "../../src/core/models";
import { PRETEND_TOKEN } from "../pretend/edunex";
import { startEngine } from "./harness";

const savedFile = (name: string, value: unknown) => JSON.stringify({ format: 1, name, value, fetchedAt: 0, hash: "saved" });
const FILE = "c".repeat(64);
const HIGHLIGHTS: HighlightedFile[] = [{ file: FILE, at: 1, highlights: [{ id: "h1", page: 2, start: 10, end: 17, color: "yellow", text: "Capaian", at: 1 }] }];
const WITH_NOTES: HighlightedFile[] = [{ ...HIGHLIGHTS[0], notes: [{ page: 2, text: "Tanya dosen soal capaian ini", at: 1 }] }];

async function signedIn() {
  const h = await startEngine({ start: false });
  await h.engine.signIn("edunex", { token: PRETEND_TOKEN });
  return h;
}

describe("the highlights' saved data", () => {
  it("loads after a restart", async () => {
    const h = await signedIn();
    await h.engine.setLocal("local.highlights", HIGHLIGHTS);
    const again = await startEngine({ world: h.world, storage: h.storage, vault: h.vault, start: false });
    expect(again.dataset("local.highlights")).toEqual(HIGHLIGHTS);
  });

  it("notes load after a restart with the highlights; what an older version saved, without notes, loads as it was", async () => {
    const h = await signedIn();
    await h.engine.setLocal("local.highlights", WITH_NOTES);
    const again = await startEngine({ world: h.world, storage: h.storage, vault: h.vault, start: false });
    expect(again.dataset("local.highlights")).toEqual(WITH_NOTES);

    const storage = (await startEngine({ start: false })).storage;
    storage.files.set("datasets/local.highlights.json", savedFile("local.highlights", HIGHLIGHTS));
    expect((await startEngine({ storage, start: false })).dataset("local.highlights")).toEqual(HIGHLIGHTS);
  });

  it("a color this version doesn't know (a later one's) loads with the rest", async () => {
    const storage = (await startEngine({ start: false })).storage;
    const later = [{ ...HIGHLIGHTS[0], highlights: [{ ...HIGHLIGHTS[0].highlights[0], color: "orange-2" }] }];
    storage.files.set("datasets/local.highlights.json", savedFile("local.highlights", later));
    const h = await startEngine({ storage, start: false });
    expect(h.dataset("local.highlights")).toEqual(later);
  });

  it("refuses a value past the caps, and keeps the one it had", async () => {
    const h = await signedIn();
    await h.engine.setLocal("local.highlights", HIGHLIGHTS);
    const tooMany = [{ file: FILE, at: 1, highlights: Array.from({ length: 501 }, (_, i) => ({ ...HIGHLIGHTS[0].highlights[0], id: `h${i}` })) }];
    await expect(h.engine.setLocal("local.highlights", tooMany)).rejects.toMatchObject({ kind: "Rejected" });
    expect(h.dataset("local.highlights")).toEqual(HIGHLIGHTS);
  });

  it("signing out of Edunex keeps them; signing out of everything removes them, file and all", async () => {
    const h = await signedIn();
    await h.engine.setLocal("local.highlights", HIGHLIGHTS);
    await h.engine.signOut("edunex");
    expect(h.dataset("local.highlights")).toEqual(HIGHLIGHTS);

    const again = await signedIn();
    await again.engine.setLocal("local.highlights", WITH_NOTES);
    await again.engine.signOut();
    expect(again.dataset("local.highlights")).toBeUndefined();
    expect([...again.storage.files.keys()].filter((k) => k.startsWith("datasets/local."))).toEqual([]);
  });

  it("a different Student signing in, after the last one signed out of Edunex alone, starts with none, notes too", async () => {
    const h = await signedIn();
    await h.engine.setLocal("local.highlights", WITH_NOTES);
    await h.engine.signOut("edunex");
    // The same Student back: their highlights stay.
    await h.engine.signIn("edunex", { token: PRETEND_TOKEN });
    expect(h.dataset("local.highlights")).toEqual(WITH_NOTES);
    await h.engine.signOut("edunex");

    h.world.edunex.me = { ...h.world.edunex.me, name: "Rina Sari", code: "18223902" };
    await h.engine.signIn("edunex", { token: PRETEND_TOKEN });
    expect(h.dataset("edunex.account")?.nim).toBe("18223902");
    expect(h.dataset("local.highlights")).toBeUndefined();
  });

  it("nothing is saved while nobody is signed in: a highlight made as everything was signed out doesn't come back", async () => {
    const h = await signedIn();
    await h.engine.signOut();
    await expect(h.engine.setLocal("local.highlights", HIGHLIGHTS)).rejects.toMatchObject({ kind: "Rejected" });
    expect(h.dataset("local.highlights")).toBeUndefined();
  });
});
