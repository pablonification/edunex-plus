// "Sembunyikan nilai" on the desktop (src/core/hide-grades.ts has the rule, the phone's
// mobile/src/parts/hide-grades.tsx the same parts in its own look): whether grades are hidden, the eye
// button beside the IPK that hides or shows them everywhere at once, a hidden figure as dots in the
// figure's own place, and the one quiet line that stands where a whole part made of grades was (a chart,
// a transcript, a course's scores). The setting is the engine's (Settings.hideGrades), shared with the
// phone's notifier and the desktop's (src/desktop/notifications.ts).
import { gradesHidden, HIDDEN_FIGURE } from "../core/hide-grades";
import { useT } from "./i18n";
import { useBridge, useSettings } from "./store";
import { Button, IconButton } from "./ui/controls";
import { cx } from "./ui/cx";
import { Icons } from "./ui/icons";
import { Tooltip } from "./ui/overlays";

/** Whether grades are hidden now. */
export function useGradesHidden(): boolean {
  return gradesHidden(useSettings());
}

/** A grade's words where they're one string among others (a row's meta, a tag): the dots while hidden. */
export function useGradeWords(): (words: string) => string {
  const hidden = useGradesHidden();
  return (words) => (hidden ? HIDDEN_FIGURE : words);
}

/** Hides or shows grades, everywhere at once. */
export function useToggleGrades(): () => void {
  const bridge = useBridge();
  const hidden = useGradesHidden();
  return () => void bridge.invoke("settings.update", { hideGrades: !hidden }).catch(() => undefined);
}

/** The eye beside the IPK: one click hides or shows every grade. Named for what the click does. */
export function HideGradesButton({ className }: { className?: string }) {
  const t = useT();
  const hidden = useGradesHidden();
  const toggle = useToggleGrades();
  const label = t(hidden ? "mobile.hideGrades.show" : "mobile.hideGrades");
  const Eye = hidden ? Icons.EyeOff : Icons.Eye;
  return (
    <Tooltip content={label}>
      <IconButton label={label} onClick={toggle} className={className}>
        <Eye className="size-4" />
      </IconButton>
    </Tooltip>
  );
}

/** A hidden figure: the dots in the figure's own size and weight. A screen reader hears "`name` disembunyikan". */
export function HiddenFigure({ name, className }: { name: string; className?: string }) {
  const t = useT();
  return (
    <span role="img" aria-label={t("mobile.hideGrades.said", { name })} className={className}>
      <span aria-hidden>{HIDDEN_FIGURE}</span>
    </span>
  );
}

/** Where a part made of grades was: one quiet line and the way to show them. */
export function GradesHiddenLine({ className }: { className?: string }) {
  const t = useT();
  const toggle = useToggleGrades();
  return (
    <div className={cx("flex flex-wrap items-center justify-between gap-x-4 gap-y-2", className)}>
      <span className="flex items-center gap-2 text-body text-muted">
        <Icons.EyeOff className="size-4 shrink-0" />
        {t("mobile.hideGrades.hidden")}
      </span>
      <Button size="sm" variant="ghost" aria-label={t("mobile.hideGrades.show")} onClick={toggle}>
        {t("planner.hiddenShow")}
      </Button>
    </div>
  );
}
