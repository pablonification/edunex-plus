// "Simpan untuk offline" on the phone (mobile/src/host/save-offline.ts): the desktop's counts
// (src/desktop/handlers/course-page.ts), into the app's downloads, with how far it has got.
import { describe, expect, it } from "vitest";
import { type SaveProgress, saveOffline, saveProgress } from "../../mobile/src/host/save-offline";
import type { OfflinePlan } from "../../src/core/course-materials";

const plan = (...urls: string[]): OfflinePlan => ({
  folder: "II4091 Proyek",
  files: urls.map((url, i) => ({ url, folders: [], name: `file-${i}.pdf`, sizeBytes: 10 })),
});

describe("saving a course's files on the phone", () => {
  it("keeps what's already there, downloads the rest, and counts what failed", async () => {
    const have = new Set(["https://a/kept"]);
    const fetched: string[] = [];
    const counts = await saveOffline(plan("https://a/kept", "https://a/new", "https://a/broken", "http://elsewhere/x"), {
      isDownloadable: (url) => url.startsWith("https://a/"),
      has: (url) => have.has(url),
      download: async (url) => {
        if (url.endsWith("broken")) throw new Error("404");
        fetched.push(url);
        have.add(url);
      },
    });
    expect(counts).toEqual({ saved: 1, kept: 1, failed: 2 });
    expect(fetched).toEqual(["https://a/new"]);
  });

  it("saving again fetches only what's new", async () => {
    const have = new Set<string>();
    const ways = {
      isDownloadable: () => true,
      has: (url: string) => have.has(url),
      download: async (url: string) => void have.add(url),
    };
    await saveOffline(plan("https://a/1", "https://a/2"), ways);
    expect(await saveOffline(plan("https://a/1", "https://a/2", "https://a/3"), ways)).toEqual({ saved: 1, kept: 2, failed: 0 });
  });

  it("says how far it has got, file by file", async () => {
    const seen: SaveProgress[] = [];
    await saveOffline(plan("https://a/1", "https://a/2"), {
      isDownloadable: () => true,
      has: () => false,
      download: async () => undefined,
      onProgress: (progress) => seen.push(progress),
    });
    expect(seen).toEqual([
      { done: 0, total: 2 },
      { done: 1, total: 2 },
      { done: 2, total: 2 },
    ]);
  });

  it("a course with no files saves nothing", async () => {
    expect(await saveOffline(plan(), { isDownloadable: () => true, has: () => false, download: async () => undefined })).toEqual({
      saved: 0,
      kept: 0,
      failed: 0,
    });
  });

  it("the course page hears a save start and end, per course", () => {
    let heard = 0;
    const stop = saveProgress.subscribe(() => heard++);
    saveProgress.set("II4091", { done: 1, total: 3 });
    expect(saveProgress.get("II4091")).toEqual({ done: 1, total: 3 });
    expect(saveProgress.get("PL3002")).toBeNull();
    saveProgress.set("II4091", null);
    expect(saveProgress.get("II4091")).toBeNull();
    stop();
    saveProgress.set("II4091", null);
    expect(heard).toBe(2);
  });
});
