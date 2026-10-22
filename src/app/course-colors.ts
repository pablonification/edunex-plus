// The course colors as the window draws them ("local.courseColors"), shared by
// every screen. A change shows at once: until the engine has saved it, the
// window keeps its own copy, so two writes in a row don't undo each other
// (local.set replaces the whole value). The rules live in core/course-colors.ts.
//
// The window remembers each course's automatic color the first time it shows,
// so it never moves by itself. The first time this version shows the courses
// (nothing saved yet), they start from the colors the version before showed
// (`legacyAutomatic`).
//
// While the picker is open, the color under its focus is drawn everywhere (the
// preview) without being saved. It's saved once, when the picker closes; Undo
// puts back the whole value it replaced, so a course it moved goes back too.
import { useEffect, useSyncExternalStore } from "react";
import { applyChoice, legacyAutomatic, type PaletteId, pickedColor, pruneCourseColors, resolveCourseColors, withRemembered } from "../core/course-colors";
import type { CourseColors } from "../core/models";
import { errorKey } from "./bridge";
import { useT } from "./i18n";
import { type AppStore, useBridge, useDataset, useStore } from "./store";
import { dismissToast, toast } from "./ui/overlays";

/** What the window wrote and the engine hasn't confirmed yet, with how many writes are on their way. */
let pending: { value: CourseColors; writes: number } | null = null;

/** The picker's choice, drawn but not saved: worked out against `base`, the value as it was when the picker opened. */
interface Preview {
  code: string;
  codes: readonly string[];
  base: CourseColors;
  choice: PaletteId | null;
  value: CourseColors;
}
let preview: Preview | null = null;

const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const publish = () => {
  for (const listener of listeners) listener();
};

/** What's saved, or written and not confirmed yet: what a change starts from. */
export function useCommittedCourseColors(): CourseColors | undefined {
  const saved = useDataset("local.courseColors");
  const mine = useSyncExternalStore(subscribe, () => pending);
  return mine?.value ?? saved;
}

/** What to draw: the picker's preview while it's open, else what's saved. */
export function useCourseColorsValue(): CourseColors | undefined {
  const committed = useCommittedCourseColors();
  const shown = useSyncExternalStore(subscribe, () => preview);
  return shown?.value ?? committed;
}

/** Nothing saved yet: the colors the version before this one showed, so the move to the palette keeps what it can. */
export const withLegacy = (codes: readonly string[], saved: CourseColors | undefined): CourseColors =>
  saved ?? { picks: {}, automatic: legacyAutomatic(codes) };

/** Draws the picker's choice everywhere, unsaved. */
export function previewCourseColor(next: Omit<Preview, "value">): void {
  if (preview && preview.code === next.code && preview.base === next.base && preview.choice === next.choice) return;
  preview = { ...next, value: applyChoice(next.base, next.code, next.choice, Date.now()) };
  publish();
}

/** The picker for `code` has gone without saving (its screen went with it): what's saved is drawn again. */
export function endPreview(code: string): void {
  if (preview?.code !== code) return;
  preview = null;
  publish();
}

const committedNow = (store: AppStore) => pending?.value ?? (store.dataset("local.courseColors")?.value as CourseColors | undefined);

/** Saves what `change` makes of the value as it stands when called, not as some render saw it. Returns what it replaced. */
async function save(
  store: AppStore,
  bridge: ReturnType<typeof useBridge>,
  change: (current: CourseColors | undefined) => CourseColors,
): Promise<CourseColors | undefined> {
  const before = committedNow(store);
  const value = change(before);
  pending = { value, writes: (pending?.writes ?? 0) + 1 };
  publish();
  try {
    await bridge.invoke("local.set", { name: "local.courseColors", value });
    return before;
  } finally {
    // The engine sends the saved value before it answers: once every write is answered, that's the one to show.
    if (pending && --pending.writes === 0) {
      pending = null;
      publish();
    }
  }
}

/**
 * The last color change said back. Its Undo puts back the whole value it replaced, so a newer change takes its
 * place: an older Undo would undo the newer change too.
 */
let said: number | null = null;
function sayBack(text: string, action: { label: string; onClick: () => void }) {
  if (said !== null) dismissToast(said);
  said = toast(text, "neutral", action);
}

export interface CourseColorPicks {
  /** The picker closed with Escape: nothing is saved, everything is drawn as it was. */
  cancel(code: string): void;
  /** The picker closed any other way: its choice is saved, once, and said back with Undo. */
  finish(code: string): Promise<void>;
  /** Every course of the term back to automatic, at once, with Undo. */
  resetAll(codes: readonly string[]): Promise<void>;
}

export function useCourseColorPicks(): CourseColorPicks {
  const t = useT();
  const store = useStore();
  const bridge = useBridge();
  const name = (id: PaletteId) => t(`courseColor.name.${id}`);
  const failed = (error: unknown) => void toast(t(errorKey(error)), "danger");
  const undo = (before: CourseColors | undefined) => ({
    label: t("action.undo"),
    onClick: () => {
      if (before) void save(store, bridge, () => before).catch(failed);
    },
  });
  return {
    cancel: (code) => endPreview(code),
    async finish(code) {
      const shown = preview;
      if (shown?.code !== code) return;
      preview = null;
      if (shown.choice === (pickedColor(code, shown.base) ?? null)) {
        publish();
        return;
      }
      // Who it moved, as the preview showed it.
      const moved = resolveCourseColors(shown.codes, shown.value).moved.filter((m) => m.code !== code);
      try {
        const before = await save(store, bridge, (current) =>
          pruneCourseColors(withRemembered(shown.codes, applyChoice(withLegacy(shown.codes, current), code, shown.choice, Date.now())), shown.codes),
        );
        const text =
          shown.choice === null
            ? t("courseColor.backToAuto", { code })
            : moved.length
              ? t("courseColor.doneMoved", { code, color: name(shown.choice), other: moved[0].code, next: name(moved[0].to) })
              : t("courseColor.done", { code, color: name(shown.choice) });
        sayBack(text, undo(before));
      } catch (error) {
        failed(error);
      }
    },
    async resetAll(codes) {
      const current = withLegacy(codes, committedNow(store));
      const count = codes.filter((code) => pickedColor(code, current)).length;
      if (!count) return;
      try {
        const before = await save(store, bridge, (now) => {
          const base = withLegacy(codes, now);
          const picks = Object.fromEntries(Object.entries(base.picks).filter(([code]) => !codes.includes(code)));
          return withRemembered(codes, { ...base, picks });
        });
        sayBack(t("courseColor.allBack", { count }), undo(before));
      } catch (error) {
        failed(error);
      }
    },
  };
}

/** The last automatic colors the window tried to remember: refused, it doesn't try the same again. */
let tried: string | null = null;

/**
 * Remembers the automatic color of each course the first time it shows: when the courses first come, and when a
 * course joins the term. Only once the Student is known (their Edunex account or SIX record is here), never while
 * the picker shows a choice, and never on a render that changes nothing.
 */
export function useRememberCourseColors(codes: readonly string[] | undefined): void {
  const store = useStore();
  const bridge = useBridge();
  const saved = useCommittedCourseColors();
  const picking = useSyncExternalStore(subscribe, () => preview) !== null;
  const account = useDataset("edunex.account");
  const student = useDataset("six.student");
  const known = account !== undefined || student !== undefined;
  const sorted = codes ? [...new Set(codes)].sort() : [];
  const remember = sorted.length ? resolveCourseColors(sorted, withLegacy(sorted, saved)).remember : {};
  const todo = known && !picking && sorted.length > 0 && (saved === undefined || Object.keys(remember).length > 0) ? JSON.stringify([sorted, remember]) : null;
  useEffect(() => {
    if (!todo || todo === tried) return;
    tried = todo;
    const [codes] = JSON.parse(todo) as [string[]];
    void save(store, bridge, (current) => pruneCourseColors(withRemembered(codes, withLegacy(codes, current)), codes)).then(
      // Saved: the same courses may need it again one day (after signing out of everything and back in).
      () => {
        if (tried === todo) tried = null;
      },
      () => undefined,
    );
  }, [todo, store, bridge]);
}
