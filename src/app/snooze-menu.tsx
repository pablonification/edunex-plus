// "Ingatkan nanti" (Remind me later) on a row or a notice: a quiet menu of
// moments that fit the item, each saying until when, then a toast saying when
// it's back, with Undo. A row that leaves hands keyboard focus to the next one,
// so nobody is left focused on nothing.
import { useRef } from "react";
import { type Snoozable, snoozeChoices } from "../core/snooze";
import { useFormat, useNow, useT } from "./i18n";
import { useSnoozes } from "./snoozes";
import { Icons } from "./ui/icons";
import { Menu } from "./ui/menu";
import { dismissToast, toast } from "./ui/overlays";

/** The last "Diingatkan lagi …" toast: a new snooze replaces it rather than stacking up. */
let shown: number | null = null;

/** Whether the item can be put off at all right now (too close to its moment, it can't). */
export const canSnooze = (item: Snoozable, now: number) => snoozeChoices(item, now).length > 0;

/**
 * `name`: what's put off, for screen readers ("Ingatkan nanti: Tugas 02 Bab II").
 * `words`: the button says "Ingatkan nanti" beside its icon (on a notice); on a row it's the icon alone.
 * `onTone`: it sits on a colored notice and takes its color.
 */
export function SnoozeMenu({ item, name, words = false, onTone = false }: { item: Snoozable; name: string; words?: boolean; onTone?: boolean }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const { snooze, wake } = useSnoozes();
  const anchor = useRef<HTMLSpanElement>(null);
  const choices = snoozeChoices(item, now);
  if (!choices.length) return null;

  const put = (choice: (typeof choices)[number]) => {
    const next = nextFocus(anchor.current);
    const when = f.dueLabel(choice.until);
    snooze(item.key, choice.until, choice.kind).then(
      () => {
        if (shown !== null) dismissToast(shown);
        shown = toast(choice.kind === "change" ? t("snooze.doneChange") : t("snooze.done", { when }), "neutral", {
          label: t("action.undo"),
          onClick: () => void wake(item.key.id).catch(() => undefined),
        });
      },
      (error: unknown) => toast(t("error.action", { message: error instanceof Error ? error.message : String(error) }), "danger"),
    );
    // Only where focus was lost with the row: never pull it away from something the Student has moved on to.
    requestAnimationFrame(() => {
      if (!document.activeElement || document.activeElement === document.body) next?.focus();
    });
  };

  return (
    <span ref={anchor} className="inline-flex">
      <Menu
        label={t("snooze.actionFor", { title: name })}
        trigger={{
          icon: <Icons.Snooze className="size-4" />,
          text: t("snooze.action"),
          words,
          className: onTone ? "text-current opacity-90 hover:bg-black/5 hover:text-current hover:opacity-100 dark:hover:bg-white/10" : undefined,
        }}
        className="w-[260px]"
        items={choices.map((choice) => ({
          label: t(`snooze.choice.${choice.kind}`),
          hint: choice.kind === "change" ? t("snooze.atLatest", { when: f.dueLabel(choice.until) }) : f.dueLabel(choice.until),
          onSelect: () => put(choice),
        }))}
      />
    </span>
  );
}

/** Where focus goes when the row holding `from` leaves: the next row, else the one before, else the list's "ditunda" line. */
function nextFocus(from: HTMLElement | null): HTMLElement | null {
  const row = from?.closest("li");
  if (!row) return null;
  const sibling = row.nextElementSibling ?? row.previousElementSibling;
  return sibling?.querySelector<HTMLElement>("button") ?? row.closest("section")?.querySelector<HTMLElement>("[data-snoozed]") ?? null;
}
