// "Ingatkan nanti" and "Sudah beres" on the phone (src/app/snooze-menu.tsx): the moments that fit
// an item, each saying until when, in a sheet; the ✓ that puts away what only the Student can know
// is dealt with. Both answer with a toast and Undo. A row shows both as icons (never hidden), and
// the same actions are a swipe away (`useRowActions`).
import { type ReactNode, useState } from "react";
import { View } from "react-native";
import { errorKey } from "../../../src/app/bridge";
import { useFormat, useNow, useT } from "../../../src/app/i18n";
import { useDone, useSnoozes } from "../../../src/app/snoozes";
import type { DoneHow } from "../../../src/core/models";
import { type Snoozable, type SnoozeKey, snoozeChoices } from "../../../src/core/snooze";
import { dismissToast, toast } from "../swaps/overlays";
import { Button, IconButton } from "../ui/controls";
import { Icons } from "../ui/icons";
import { ActionSheet } from "../ui/sheet";
import type { SwipeAction } from "../ui/swipe";
import { useTheme } from "../ui/theme";

let shown: number | null = null;
let shownDone: number | null = null;

/** Whether the item can be put off at all right now (too close to its moment, it can't). */
export const canSnooze = (item: Snoozable, now: number) => snoozeChoices(item, now).length > 0;

export type RowDone = Extract<DoneHow, "checked" | "groupDone" | "gotIt" | "paid">;

/** The snooze sheet's state and what putting an item off does (a toast with Undo). */
export function useSnooze(item: Snoozable | null) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const { snooze, wake } = useSnoozes();
  const [open, setOpen] = useState(false);
  const choices = item ? snoozeChoices(item, now) : [];
  const sheet = item ? (
    <ActionSheet
      open={open}
      onClose={() => setOpen(false)}
      title={t("snooze.action")}
      testID="sheet.snooze"
      choices={choices.map((choice) => ({
        label: t(`snooze.choice.${choice.kind}`),
        hint: choice.kind === "change" ? t("snooze.atLatest", { when: f.dayTimeWord(choice.until) }) : f.dueLabel(choice.until),
        testID: `snooze.${choice.kind}`,
        onPress: () => {
          const when = f.dayTimeWord(choice.until);
          snooze(item.key, choice.until, choice.kind).then(
            () => {
              if (shown !== null) dismissToast(shown);
              shown = toast(choice.kind === "change" ? t("snooze.doneChange") : t("snooze.done", { when }), "neutral", {
                label: t("action.undo"),
                onClick: () => void wake(item.key.id).catch(() => undefined),
              });
            },
            (error: unknown) => toast(t(errorKey(error)), "danger"),
          );
        },
      }))}
    />
  ) : null;
  return { available: choices.length > 0, open: () => setOpen(true), sheet };
}

/** What the ✓ does: put the item away for good, with a toast saying until what, and Undo. */
export function useMarkDone(item: SnoozeKey | null, how: RowDone | null, said: string) {
  const t = useT();
  const { mark, unmark } = useDone();
  return () => {
    if (!item || !how) return;
    mark(item, how).then(
      () => {
        if (shownDone !== null) dismissToast(shownDone);
        shownDone = toast(said, "neutral", { label: t("action.undo"), onClick: () => void unmark(item.id).catch(() => undefined) });
      },
      (error: unknown) => toast(t(errorKey(error)), "danger"),
    );
  };
}

/** "Ingatkan nanti" as an alarm icon (a row) or with its words (a notice). Nothing when it can't be put off. */
export function SnoozeMenu({ item, name, words = false }: { item: Snoozable; name: string; words?: boolean }) {
  const t = useT();
  const theme = useTheme();
  const { available, open, sheet } = useSnooze(item);
  if (!available) return null;
  return (
    <>
      {words ? (
        <Button
          size="sm"
          variant="ghost"
          icon={<Icons.Snooze size={16} color={theme.color.muted} />}
          onPress={open}
          label={t("snooze.actionFor", { title: name })}
          testID="action.snooze"
        >
          {t("snooze.action")}
        </Button>
      ) : (
        <IconButton label={t("snooze.actionFor", { title: name })} onPress={open} testID="action.snooze">
          <Icons.Snooze size={20} color={theme.color.faint} />
        </IconButton>
      )}
      {sheet}
    </>
  );
}

/** The ✓ on a row whose "done" only the Student can know. */
export function DoneButton({
  item,
  how,
  name,
  said,
  words = false,
  variant = "ghost",
}: {
  item: SnoozeKey;
  how: RowDone;
  name: string;
  said: string;
  words?: boolean;
  variant?: "ghost" | "secondary";
}) {
  const t = useT();
  const theme = useTheme();
  const put = useMarkDone(item, how, said);
  return words ? (
    <Button
      size="sm"
      variant={variant}
      icon={<Icons.Check size={16} weight="bold" color={theme.color.muted} />}
      label={t(`done.${how}For`, { title: name })}
      onPress={put}
      testID="action.done"
    >
      {t(`done.${how}`)}
    </Button>
  ) : (
    <IconButton label={t(`done.${how}For`, { title: name })} onPress={put} testID="action.done">
      <Icons.Check size={20} weight="bold" color={theme.color.faint} />
    </IconButton>
  );
}

/** A row's two controls side by side, the ✓ then the alarm; neither: nothing. */
export function rowControls(done: ReactNode, snooze: ReactNode): ReactNode {
  if (!done && !snooze) return undefined;
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {done}
      {snooze}
    </View>
  );
}

/**
 * The same two actions as a swipe (ui/swipe.tsx): "Sudah beres" toward the row's end (it leaves, folds away, and the
 * snackbar offers Urungkan) and "Ingatkan nanti" toward its start (the row springs back and the sheet `useSnooze`
 * gave opens on its times). Use with <SwipeRow actions={…}>.
 */
export function useRowActions({
  done,
  snooze,
}: {
  done?: { how: RowDone; put: () => void } | null;
  snooze?: { available: boolean; open: () => void } | null;
}): SwipeAction[] {
  const t = useT();
  const theme = useTheme();
  const actions: SwipeAction[] = [];
  if (done)
    actions.push({
      label: t(`done.${done.how}`),
      tone: "success",
      icon: <Icons.Check size={20} weight="bold" color={theme.color.successFg} />,
      onPress: done.put,
      testID: "swipe.done",
    });
  if (snooze?.available)
    actions.push({
      label: t("snooze.action"),
      tone: "warning",
      icon: <Icons.Snooze size={20} color={theme.color.warningFg} />,
      onPress: snooze.open,
      leaves: false,
      testID: "swipe.snooze",
    });
  return actions;
}
