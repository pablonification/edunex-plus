// The Student's highlights and page notes ("local.highlights") as the file
// viewers show them: one file's, by its SHA-256, and the ways to change them.
// A change shows at once: until the engine has saved it, the window keeps its
// own copy, so two changes in a row don't undo each other (local.set replaces
// the whole list). The rules live in core/highlights.ts; the viewers' part in
// ui/highlights.tsx and ui/page-notes.tsx.
import { useMemo, useSyncExternalStore } from "react";
import {
  addHighlights,
  clearHighlights,
  highlightsIn,
  notesIn,
  recolorHighlight,
  removeHighlight,
  removeNote,
  restoreHighlights,
  restoreNote,
  setNote,
} from "../core/highlights";
import type { HighlightedFile } from "../core/models";
import type { StringKey } from "../core/strings";
import { useT } from "./i18n";
import { type AppStore, useBridge, useDataset, useStore } from "./store";
import type { Highlights } from "./ui/highlights";
import { toast } from "./ui/overlays";
import type { PageNotes } from "./ui/page-notes";

/** What the window wrote and the engine hasn't confirmed yet, with how many writes are on their way. */
let pending: { value: HighlightedFile[]; writes: number } | null = null;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const publish = () => {
  for (const listener of listeners) listener();
};

const NONE: HighlightedFile[] = [];
const committedNow = (store: AppStore) => pending?.value ?? (store.dataset("local.highlights")?.value as HighlightedFile[] | undefined) ?? NONE;

/** The file's SHA-256 in hex: the same file is the same one wherever it's listed, however Edunex signs its link. */
export async function fileIdentity(bytes: Uint8Array): Promise<string> {
  // The bytes are copied as it's called, so the PDF reader may take them over straight after.
  const digest = await crypto.subtle.digest("SHA-256", bytes as Uint8Array<ArrayBuffer>);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Every file's highlights and notes as the window shows them: its own copy while a write is on its way, else the saved list. */
function useAllMarks(): readonly HighlightedFile[] {
  const saved = useDataset("local.highlights");
  const mine = useSyncExternalStore(subscribe, () => pending);
  return mine?.value ?? saved ?? NONE;
}

/** Saves what `change` makes of the list as it stands when called, not as some render saw it; `failed` says so when it can't. */
function useSave(failed: StringKey) {
  const t = useT();
  const store = useStore();
  const bridge = useBridge();
  return useMemo(
    () => async (change: (files: readonly HighlightedFile[], now: number) => HighlightedFile[]) => {
      const value = change(committedNow(store), Date.now());
      pending = { value, writes: (pending?.writes ?? 0) + 1 };
      publish();
      try {
        await bridge.invoke("local.set", { name: "local.highlights", value });
      } catch {
        toast(t(failed), "danger");
      } finally {
        // The engine sends the saved list before it answers: once every write is answered, that's the one to show.
        if (pending && --pending.writes === 0) {
          pending = null;
          publish();
        }
      }
    },
    [store, bridge, t, failed],
  );
}

/** One file's highlights (`file`: its identity; null while it's being read, or for a file that isn't Edunex's: none). */
export function useFileHighlights(file: string | null): Highlights | undefined {
  const all = useAllMarks();
  const save = useSave("highlight.saveFailed");

  return useMemo(() => {
    if (!file) return undefined;
    return {
      items: highlightsIn(all, file),
      add: (highlights) => void save((files, now) => addHighlights(files, file, highlights, now)),
      recolor: (id, color) => void save((files, now) => recolorHighlight(files, file, id, color, now)),
      remove: (id) => void save((files, now) => removeHighlight(files, file, id, now)),
      clear: () => void save((files, now) => clearHighlights(files, file, now)),
      restore: (highlights) => void save((files, now) => restoreHighlights(files, file, highlights, now)),
    };
  }, [file, all, save]);
}

/** One file's notes, a page's each (a Word document's or text file's: one for the whole file); none for a file that isn't Edunex's, as for highlights. */
export function useFileNotes(file: string | null): PageNotes | undefined {
  const all = useAllMarks();
  const save = useSave("pageNote.saveFailed");

  return useMemo(() => {
    if (!file) return undefined;
    return {
      items: notesIn(all, file),
      set: (page, text) => void save((files, now) => setNote(files, file, page, text, now)),
      remove: (page) => void save((files, now) => removeNote(files, file, page, now)),
      restore: (note) => void save((files, now) => restoreNote(files, file, note, now)),
    };
  }, [file, all, save]);
}
