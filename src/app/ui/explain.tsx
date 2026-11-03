// Less to read (docs/design-system.md): a status in a few words on screen, and its why a tooltip away. One
// set of parts, so every screen says "why" the same way: the words a student acts on stay visible, the
// explanation shows on hover and keyboard focus, and the control's name carries both for a screen reader.
import type { ComponentType, ReactNode } from "react";
import { useT } from "../i18n";
import { IconButton } from "./controls";
import { cx } from "./cx";
import { Icons } from "./icons";
import { Meta } from "./layout";
import { Tooltip } from "./overlays";

export type StatusTone = "danger" | "warning" | "quiet";

/** A status's words: red for what is lost, amber for a choice to make, quiet for a fact. */
export const STATUS_TONE: Record<StatusTone, string> = {
  danger: "font-medium text-danger-fg",
  warning: "font-medium text-warning-fg",
  quiet: "text-muted",
};

/** One status in a few words ("Wajib hadir", "Bentrok"), what's behind it, and how loud it is. */
export interface Status {
  key: string;
  text: string;
  why: string;
  tone: StatusTone;
}

type StatusIcon = ComponentType<{ className?: string }>;

/**
 * A status whose why is a tooltip away, beside facts outside a row's button (a card's meta line): the words stay
 * on screen, dotted underneath to say there's more, and the explanation shows on hover and keyboard focus.
 */
export function Explained({ text, why, className }: { text: ReactNode; why: string; className?: string }) {
  return (
    <Tooltip content={why}>
      <button
        type="button"
        data-explained=""
        aria-label={typeof text === "string" ? `${/[.!?]$/.test(text) ? text : `${text}.`} ${why}` : why}
        className={cx(
          "focus-ring inline-flex items-center gap-1 rounded-tag underline decoration-dotted decoration-1 underline-offset-[3px] hover:decoration-solid",
          className,
        )}
      >
        {text}
      </button>
    </Tooltip>
  );
}

/**
 * The why of a row's statuses (or a card's step), as an info button beside it: inside a row's button another
 * can't go. Shown while its row (`group/row`) is hovered or holds focus, and always where there's no hover: the
 * statuses themselves stay on screen, so a column of info icons doesn't become one more thing to read.
 */
export function WhyButton({ why }: { why: string }) {
  const t = useT();
  return (
    <Tooltip content={why}>
      <IconButton
        size="sm"
        label={t("action.why", { what: why })}
        className={cx(
          "transition-opacity duration-quick [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/row:opacity-100",
          "group-focus-within/row:opacity-100 focus-visible:opacity-100 data-[state=delayed-open]:opacity-100 data-[state=instant-open]:opacity-100",
        )}
      >
        <Icons.Info className="size-3.5" />
      </IconButton>
    </Tooltip>
  );
}

/** A row's one line of statuses, each an icon (by its key) and a few words in its tone. */
export function StatusLine({
  statuses,
  icons = {},
  className,
}: {
  statuses: readonly Status[];
  icons?: Readonly<Record<string, StatusIcon>>;
  className?: string;
}) {
  return (
    <Meta className={cx("mt-1 text-small", className)}>
      {statuses.map((status) => {
        const Icon = icons[status.key];
        return (
          <span key={status.key} className={cx("inline-flex items-center gap-1", STATUS_TONE[status.tone])}>
            {Icon && <Icon className="size-3.5 shrink-0" />}
            {status.text}
          </span>
        );
      })}
    </Meta>
  );
}
