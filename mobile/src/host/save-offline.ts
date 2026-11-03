// "Simpan untuk offline" on the phone: the desktop's "course.saveOffline" loop
// (src/desktop/handlers/course-page.ts) without its folders. Every file of the course goes into the
// app's downloads (./files.ts), the same place and index "Unduh" uses, so a file saved here opens
// offline from its own row and is never fetched twice. Kept free of Expo so test/mobile runs it.
import type { OfflinePlan } from "../../../src/core/course-materials";

export interface SaveCounts {
  saved: number;
  kept: number;
  failed: number;
}

/** How far a course's save has got: `done` of `total` files tried. */
export interface SaveProgress {
  done: number;
  total: number;
}

export interface SaveWays {
  /** Only Edunex's own storage: anything else counts as failed, as on the desktop. */
  isDownloadable(url: string): boolean;
  /** The app already has this file. */
  has(url: string): boolean;
  /** Downloads one file into the app's downloads; throws when it doesn't arrive. */
  download(url: string, name: string): Promise<void>;
  onProgress?(progress: SaveProgress): void;
}

/** One file at a time, as the desktop does: polite to Edunex, and a slow phone network isn't split. */
export async function saveOffline(plan: OfflinePlan, ways: SaveWays): Promise<SaveCounts> {
  const counts: SaveCounts = { saved: 0, kept: 0, failed: 0 };
  const total = plan.files.length;
  ways.onProgress?.({ done: 0, total });
  for (const [i, file] of plan.files.entries()) {
    if (!ways.isDownloadable(file.url)) counts.failed += 1;
    else if (ways.has(file.url)) counts.kept += 1;
    else {
      try {
        await ways.download(file.url, file.name);
        counts.saved += 1;
      } catch {
        counts.failed += 1;
      }
    }
    ways.onProgress?.({ done: i + 1, total });
  }
  return counts;
}

// ---------------------------------------------------------------- progress, for the course page

type Listener = () => void;
const running = new Map<string, SaveProgress>();
const listeners = new Set<Listener>();
const publish = () => {
  for (const listener of listeners) listener();
};

/** The course pages listen: a save keeps going when its page closes, and says so when it's open again. */
export const saveProgress = {
  get(code: string): SaveProgress | null {
    return running.get(code) ?? null;
  },
  set(code: string, progress: SaveProgress | null): void {
    if (progress) running.set(code, progress);
    else running.delete(code);
    publish();
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
