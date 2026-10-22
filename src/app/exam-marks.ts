// The Student's "Mark as done" on Edunex exam windows, kept on this computer
// ("local.examMarks") and read by Tugas & Ujian, a course's tab, Beranda and
// the sidebar's count. A change shows at once: until the engine has saved it,
// the window keeps its own copy, so a quick Undo doesn't lose a write
// (local.set replaces the whole list). The rules live in core/exams.ts.
import { useSyncExternalStore } from "react";
import { examMarkKey, pruneExamMarks } from "../core/exams";
import type { EdunexExam, ExamMark } from "../core/models";
import { useNow } from "./i18n";
import { useBridge, useDataset, useStore } from "./store";

/** What the window wrote and the engine hasn't confirmed yet, with how many writes are on their way. */
let pending: { marks: ExamMark[]; writes: number } | null = null;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const publish = () => {
  for (const listener of listeners) listener();
};

export interface ExamMarks {
  marks: readonly ExamMark[];
  /** Moves an open Edunex window to Done, as it is now. */
  mark(exam: EdunexExam): Promise<void>;
  /** Back to To do. */
  unmark(exam: Pick<EdunexExam, "id">): Promise<void>;
}

/** The marks as the window has them: none in data saved before "Mark as done" existed. */
export function useExamMarkList(): readonly ExamMark[] {
  const saved = useDataset("local.examMarks");
  const mine = useSyncExternalStore(subscribe, () => pending);
  return mine?.marks ?? saved ?? [];
}

export function useExamMarks(): ExamMarks {
  const store = useStore();
  const bridge = useBridge();
  const now = useNow();
  const marks = useExamMarkList();
  /** Changes the list as it stands when called, not as this render saw it: an Undo seconds later mustn't put back what changed meanwhile. */
  const update = async (change: (current: ExamMark[]) => ExamMark[]) => {
    const current = pending?.marks ?? (store.dataset("local.examMarks")?.value as ExamMark[] | undefined) ?? [];
    const next = change(pruneExamMarks(current, now));
    pending = { marks: next, writes: (pending?.writes ?? 0) + 1 };
    publish();
    try {
      await bridge.invoke("local.set", { name: "local.examMarks", value: next });
    } finally {
      // The engine sends the saved list before it answers: once every write is answered, that's the one to show.
      if (pending && --pending.writes === 0) {
        pending = null;
        publish();
      }
    }
  };
  return {
    marks,
    mark: (exam) => {
      const key = examMarkKey(exam);
      return update((current) => [...current.filter((mark) => mark.id !== key.id), { ...key, at: now }]);
    },
    unmark: (exam) => update((current) => current.filter((mark) => mark.id !== examMarkKey({ id: exam.id, start: null, end: null }).id)),
  };
}
