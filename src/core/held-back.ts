// What "Perlu perhatianmu" still lists, and what the Student held back: put
// off ("Ingatkan nanti", ./snooze.ts) or put away ("Sudah beres", ./done.ts).
// Beranda (src/app/screens/home.tsx) and the tray menu
// (src/desktop/tray-menu.ts) both split their items here, so they agree.
import { needDoneKey, partitionDone } from "./done";
import type { DoneEntry, SnoozeEntry } from "./models";
import type { NeedDraft } from "./needs";
import { partitionSnoozed, snoozeKey } from "./snooze";

export interface HeldBack<T extends NeedDraft> {
  shown: T[];
  snoozed: { item: T; entry: SnoozeEntry }[];
  done: { item: T; entry: DoneEntry }[];
}

/**
 * `needs`: the list's own items. `due`: "Hari ini"'s deadlines, which it shows
 * only once put off or away, listed first, as the page reads: they're the soonest.
 */
export function heldBack<T extends NeedDraft>(
  needs: readonly T[],
  due: readonly T[],
  snoozes: readonly SnoozeEntry[],
  handled: readonly DoneEntry[],
  now: number,
): HeldBack<T> {
  const own = partitionDone(needs, needDoneKey, handled);
  const today = partitionDone(due, needDoneKey, handled);
  const left = partitionSnoozed(own.shown, snoozeKey, snoozes, now);
  return {
    shown: left.shown,
    snoozed: [...partitionSnoozed(today.shown, snoozeKey, snoozes, now).snoozed, ...left.snoozed],
    done: [...today.done, ...own.done],
  };
}
