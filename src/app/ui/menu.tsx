// A "⋯" menu for a screen's rare actions (save for offline, open in Edunex):
// a named icon button that opens a short list. Arrow keys move between the
// items, Escape or a click outside closes it. An item that can't run stays in
// the list, dimmed, with the reason under it.
import { type KeyboardEvent, type ReactNode, useState } from "react";
import { IconButton } from "./controls";
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

export function Menu({ label, items, className }: { label: string; items: MenuItem[]; className?: string }) {
  const [open, setOpen] = useState(false);
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
          <Tooltip content={label}>
            <IconButton label={label} aria-haspopup="menu" aria-expanded={open} className="border border-edge bg-surface">
              <Icons.MoreHorizontal className="size-4" />
            </IconButton>
          </Tooltip>
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
              setOpen(false);
              item.onSelect();
            }}
            className="focus-ring flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors duration-150 hover:bg-hover disabled:cursor-default disabled:hover:bg-transparent"
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
