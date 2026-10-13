// Signing out leaves Edunex's files behind nowhere on this computer: signing
// out of Edunex removes the files the window showed, even one still on its
// way in; "sign out of everything" also clears the app's browser storage and
// what the first version kept. Another Student signing in without a sign-out
// between finds none of them either. Runs the real handlers on a throwaway folder.
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const cleared = vi.hoisted(() => [] as string[]);
vi.mock("electron", () => {
  const session = (name: string) => ({
    clearStorageData: async () => void cleared.push(`${name} storage`),
    clearCache: async () => void cleared.push(`${name} cache`),
    clearAuthCache: async () => void cleared.push(`${name} auth`),
  });
  return { app: { isPackaged: true }, dialog: {}, shell: {}, session: { defaultSession: session("window"), fromPartition: () => session("v1") } };
});
vi.mock("../../src/desktop/signin-session", () => ({ forgetSignInSession: async () => void cleared.push("sign-in window") }));

const { authHandlers } = await import("../../src/desktop/handlers/auth");
const { createFileCache, FILE_CACHE_FOLDER } = await import("../../src/desktop/file-cache");
const { readFile } = await import("../../src/desktop/remote-files");
const { forgetOtherStudentsFiles } = await import("../../src/desktop/handlers/files");
type Context = Parameters<typeof authHandlers>[0];

const URL_A = "https://edunexfixture.blob.core.windows.net/edunex/fixture-1?sig=pretend";
const URL_B = "https://edunexfixture.blob.core.windows.net/edunex/fixture-2?sig=pretend";
const pdf = () => new TextEncoder().encode("%PDF-1.7 fixture");

let root: string;
beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), "edunex-sign-out-"));
  cleared.length = 0;
});
afterEach(async () => {
  await fs.rm(root, { recursive: true, force: true });
});

const signOutWith = (cache: ReturnType<typeof createFileCache>) => {
  const engineSession = {
    clearStorageData: async () => void cleared.push("engine storage"),
    clearCache: async () => undefined,
    clearAuthCache: async () => undefined,
  };
  const context = { engine: { signOut: async () => undefined }, fileCache: cache, userData: root, engineSession } as unknown as Context;
  return authHandlers(context)["auth.signOut"];
};

describe("signing out", () => {
  it("of Edunex removes the files it showed, and one still on its way in isn't kept after", async () => {
    const folder = path.join(root, FILE_CACHE_FOLDER);
    const cache = createFileCache(folder);
    await cache.put(URL_A, pdf());
    // A PDF the Student closed while it was still loading is still being read in.
    let arrive: () => void = () => undefined;
    const slow = new Promise<void>((resolve) => {
      arrive = resolve;
    });
    const reading = readFile(
      {
        fetch: async () => {
          await slow;
          return new Response(pdf());
        },
        cache,
      },
      URL_B,
      "pdf",
    );
    await signOutWith(cache)({ source: "edunex" });
    expect(await fs.readdir(folder).catch(() => [])).toEqual([]);
    arrive();
    await reading;
    expect(await fs.readdir(folder).catch(() => [])).toEqual([]);
    // Edunex alone: the rest of the app's data stays.
    expect(cleared).toEqual([]);
  });

  it("of SIX alone keeps Edunex's files", async () => {
    const cache = createFileCache(path.join(root, FILE_CACHE_FOLDER));
    await cache.put(URL_A, pdf());
    await signOutWith(cache)({ source: "six" });
    expect(await cache.get(URL_A)).toEqual(pdf());
  });

  it("of everything removes the files, the browser storage and what the first version kept", async () => {
    const cache = createFileCache(path.join(root, FILE_CACHE_FOLDER));
    await cache.put(URL_A, pdf());
    await fs.writeFile(path.join(root, "auth-session.enc"), "fixture");
    await fs.mkdir(path.join(root, "feed-snapshots"));
    await signOutWith(cache)({});
    expect(await fs.readdir(root)).toEqual([]);
    expect(cleared).toEqual(expect.arrayContaining(["window storage", "window cache", "engine storage", "v1 storage", "sign-in window"]));
  });

  it("of everything finishes even when the files can't be removed at that moment", async () => {
    const busy = {
      ...createFileCache(path.join(root, FILE_CACHE_FOLDER)),
      clear: async () => {
        throw new Error("EBUSY");
      },
    };
    await signOutWith(busy)({});
    expect(cleared).toEqual(expect.arrayContaining(["window storage", "engine storage", "sign-in window"]));
  });
});

describe("another Student signing in", () => {
  it("finds none of the last one's files, though nobody signed out", async () => {
    const cache = createFileCache(path.join(root, FILE_CACHE_FOLDER));
    await cache.put(URL_A, pdf());
    const follow = forgetOtherStudentsFiles(cache, "10000001");
    const account = (nim: string) => ({ type: "dataset", dataset: { name: "edunex.account", value: { nim }, fetchedAt: 0, hash: "" } }) as never;
    // The same Student's account read again keeps them.
    await follow(account("10000001"));
    expect(await cache.get(URL_A)).toEqual(pdf());
    // Their session ran out and someone else signed in: the engine drops the last account, then sets the new one.
    await follow({ type: "dataset.removed", name: "edunex.account" });
    await follow(account("10000002"));
    expect(await fs.readdir(path.join(root, FILE_CACHE_FOLDER)).catch(() => [])).toEqual([]);
  });
});
