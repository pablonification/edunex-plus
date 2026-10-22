// A "⋯" menu for a screen's rare actions (save for offline, open in Edunex):
// a named icon button that opens a short list. Arrow keys move between the
// items, Escape or a click outside closes it. An item that can't run stays in
// the list, dimmed, with the reason under it. A quieter trigger (a small "⋯"
// or another icon, with its words where there's room) serves a row's or a
// notice's own small menu, such as "Ingatkan nanti". Choosing an item puts
// focus back on the trigger first, so a dialog the item opens returns focus there.
import { type KeyboardEvent, type ReactNode, useRef, useState } from "react";
import { Button, IconButton } from "./controls";
import { cx } from "./cx";
import { Icons } from "./icons";
import { Meta } from "./layout";
import { Popover, Tooltip } from "./overlays";

export interface MenuItem {
  label: string;
  /** A second, quieter line: what it covers ("12 berkas · 34 MB"), or why it can't run. */
  hint?: string;
  icon?: ReactNode;
  disabled?: boolean;
  onSelect: () => void;
}

/**
 * A quieter trigger than the outlined "⋯" a screen's header uses: a smaller,
 * borderless button for a row's or a notice's own actions.
 */
export interface MenuTrigger {
  /** Its glyph; a small, bold "⋯" when left out. */
  icon?: ReactNode;
  /** Its short name: the tooltip, or the words beside the icon with `words`. The menu's `label` when left out. */
  text?: string;
  words?: boolean;
  /** With `words`: a quiet ghost button (the default), or an outlined one where it stands beside other buttons. */
  variant?: "ghost" | "secondary";
  className?: string;
}

/** `label` names the menu and its button for screen readers ("Ingatkan nanti: Tugas 02 Bab II"). */
export function Menu({ label, items, trigger, className }: { label: string; items: MenuItem[]; trigger?: MenuTrigger; className?: string }) {
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const move = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp" && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("[role=menuitem]:not(:disabled)")];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 : (at + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
    buttons[next]?.focus();
  };
  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      label={label}
      className={cx("w-[280px] p-1.5", className)}
      trigger={
        <span className="inline-flex">
          {trigger?.words ? (
            <Button
              ref={button}
              variant={trigger.variant ?? "ghost"}
              size={trigger.variant === "secondary" ? "md" : "sm"}
              icon={trigger.icon}
              aria-label={label}
              aria-haspopup="menu"
              aria-expanded={open}
              className={trigger.className}
            >
              {trigger.text ?? label}
            </Button>
          ) : (
            <Tooltip content={trigger?.text ?? label}>
              <IconButton
                ref={button}
                label={label}
                aria-haspopup="menu"
                aria-expanded={open}
                size={trigger ? "sm" : "md"}
                className={trigger ? trigger.className : "border border-edge bg-surface"}
              >
                {trigger?.icon ?? <Icons.MoreHorizontal className={trigger ? "size-3.5" : "size-4"} weight={trigger ? "bold" : "regular"} />}
              </IconButton>
            </Tooltip>
          )}
        </span>
      }
    >
      <div role="menu" aria-label={label} onKeyDown={move}>
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              // Before the item runs: a dialog it opens takes the trigger as what to give focus back to (the item itself is gone by then).
              button.current?.focus();
              setOpen(false);
              item.onSelect();
            }}
            className="focus-ring flex w-full items-start gap-2.5 rounded-md px-2.5 py-2 text-left hover:bg-hover disabled:cursor-default disabled:hover:bg-transparent"
          >
            {item.icon && <span className={cx("mt-0.5 shrink-0 text-muted", item.disabled && "opacity-50")}>{item.icon}</span>}
            <span className="min-w-0 flex-1">
              <span className={cx("block text-body font-medium", item.disabled && "text-faint")}>{item.label}</span>
              {item.hint && <Meta className="mt-0.5 text-small text-muted">{item.hint}</Meta>}
            </span>
          </button>
        ))}
      </div>
    </Popover>
  );
}
