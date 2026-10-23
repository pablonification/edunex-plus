// The course colors as the window draws them ("local.courseColors"), shared by
// every screen. A change shows at once: until the engine has saved it, the
// window keeps its own copy, so two writes in a row don't undo each other
// (local.set replaces the whole value). The rules live in core/course-colors.ts.
//
// The window remembers each course's automatic color the first time it shows,
// so it never moves by itself. The first time this version shows the courses
// (nothing saved yet), they start from the colors the version before showed
// (`legacyAutomatic`).
import { useEffect, useSyncExternalStore } from "react";
import { legacyAutomatic, resolveCourseColors } from "../core/course-colors";
import type { CourseColors } from "../core/models";
import { type AppStore, useBridge, useDataset, useStore } from "./store";

/** What the window wrote and the engine hasn't confirmed yet, with how many writes are on their way. */
let pending: { value: CourseColors; writes: number } | null = null;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const publish = () => {
  for (const listener of listeners) listener();
};

/** What's saved, or written and not confirmed yet. */
export function useCourseColorsValue(): CourseColors | undefined {
  const saved = useDataset("local.courseColors");
  const mine = useSyncExternalStore(subscribe, () => pending);
  return mine?.value ?? saved;
}

/** Nothing saved yet: the colors the version before this one showed, so the move to the palette keeps what it can. */
export const withLegacy = (codes: readonly string[], saved: CourseColors | undefined): CourseColors =>
  saved ?? { picks: {}, automatic: legacyAutomatic(codes) };

/** Saves what `change` makes of the value as it stands when called, not as some render saw it. */
async function save(store: AppStore, bridge: ReturnType<typeof useBridge>, change: (current: CourseColors | undefined) => CourseColors): Promise<void> {
  const value = change(pending?.value ?? (store.dataset("local.courseColors")?.value as CourseColors | undefined));
  pending = { value, writes: (pending?.writes ?? 0) + 1 };
  publish();
  try {
    await bridge.invoke("local.set", { name: "local.courseColors", value });
  } finally {
    // The engine sends the saved value before it answers: once every write is answered, that's the one to show.
    if (pending && --pending.writes === 0) {
      pending = null;
      publish();
    }
  }
}

/** The last automatic colors the window tried to remember: refused, it doesn't try the same again. */
let tried: string | null = null;

/**
 * Remembers the automatic color of each course the first time it shows: when the courses first come, and when a
 * course joins the term. Only once the Student is known (their Edunex account or SIX record is here), and never on
 * a render that changes nothing.
 */
export function useRememberCourseColors(codes: readonly string[] | undefined): void {
  const store = useStore();
  const bridge = useBridge();
  const saved = useCourseColorsValue();
  const account = useDataset("edunex.account");
  const student = useDataset("six.student");
  const known = account !== undefined || student !== undefined;
  const sorted = codes ? [...new Set(codes)].sort() : [];
  const remember = sorted.length ? resolveCourseColors(sorted, withLegacy(sorted, saved)).remember : {};
  const todo = known && sorted.length > 0 && (saved === undefined || Object.keys(remember).length > 0) ? JSON.stringify([sorted, remember]) : null;
  useEffect(() => {
    if (!todo || todo === tried) return;
    tried = todo;
    const [codes] = JSON.parse(todo) as [string[]];
    void save(store, bridge, (current) => {
      const base = withLegacy(codes, current);
      return { ...base, automatic: { ...base.automatic, ...resolveCourseColors(codes, base).remember } };
    }).then(
      // Saved: the same courses may need it again one day (after signing out of everything and back in).
      () => {
        if (tried === todo) tried = null;
      },
      () => undefined,
    );
  }, [todo, store, bridge]);
}
