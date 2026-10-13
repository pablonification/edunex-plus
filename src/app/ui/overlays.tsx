// Things that float above the window: dialogs, the confirm dialog, tooltips
// and toasts. Radix handles focus trapping, Escape and screen-reader roles.
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { type ReactNode, useEffect, useRef, useSyncExternalStore } from "react";
import { useT } from "../i18n";
import { Button, IconButton } from "./controls";
import { cx } from "./cx";
import { Icons } from "./icons";

/**
 * Focus goes back to what opened a dialog or panel when it closes, by Escape
 * or its close button. Radix only does that through its own Trigger, which a
 * dialog opened from state (Settings, ⌘K) or a trigger wrapped for its
 * tooltip doesn't have: focus fell to the page and the next Tab started over.
 * A click elsewhere in a panel leaves focus where the click put it.
 */
export function useReturnFocus() {
  const opener = useRef<HTMLElement | null>(null);
  const clickedAway = useRef(false);
  return {
    onOpenAutoFocus: () => {
      opener.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
      clickedAway.current = false;
    },
    onPointerDownOutside: () => {
      clickedAway.current = true;
    },
    onCloseAutoFocus: (event: Event) => {
      event.preventDefault();
      if (!clickedAway.current && opener.current?.isConnected) opener.current.focus();
    },
  };
}

export function Dialog({
  open,
  onOpenChange,
  title,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const t = useT();
  const { onOpenAutoFocus, onCloseAutoFocus } = useReturnFocus();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-scrim backdrop-blur-[2px] motion-safe:animate-fade-in" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onOpenAutoFocus={onOpenAutoFocus}
          onCloseAutoFocus={onCloseAutoFocus}
          className={cx(
            "fixed top-1/2 left-1/2 z-50 flex max-h-[min(720px,86vh)] w-[min(600px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden",
            "rounded-2xl bg-raised text-fg shadow-dialog ring-1 ring-black/10 focus:outline-none motion-safe:animate-pop-in dark:ring-white/10",
            className,
          )}
        >
          <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-3.5">
            <DialogPrimitive.Title className="text-title font-semibold">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <IconButton label={t("action.close")} size="sm">
                <Icons.X className="size-4" />
              </IconButton>
            </DialogPrimitive.Close>
          </div>
          <div className="min-h-0 overflow-y-auto px-5 py-5">{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

/** Asks before something that can't be undone from inside the app. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  onConfirm,
  busy = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  busy?: boolean;
}) {
  const t = useT();
  const { onOpenAutoFocus, onCloseAutoFocus } = useReturnFocus();
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[55] bg-scrim motion-safe:animate-fade-in" />
        <DialogPrimitive.Content
          role="alertdialog"
          onOpenAutoFocus={onOpenAutoFocus}
          onCloseAutoFocus={onCloseAutoFocus}
          className="fixed top-1/2 left-1/2 z-[55] w-[min(420px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-raised p-5 text-fg shadow-dialog ring-1 ring-black/10 focus:outline-none motion-safe:animate-pop-in dark:ring-white/10"
        >
          <DialogPrimitive.Title className="text-title font-semibold">{title}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="mt-1.5 text-body text-muted">{body}</DialogPrimitive.Description>
          <div className="mt-5 flex justify-end gap-2">
            <DialogPrimitive.Close asChild>
              <Button variant="secondary">{t("action.cancel")}</Button>
            </DialogPrimitive.Close>
            <Button variant="danger" busy={busy} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export const TooltipProvider = ({ children }: { children: ReactNode }) => (
  <TooltipPrimitive.Provider delayDuration={450} skipDelayDuration={200}>
    {children}
  </TooltipPrimitive.Provider>
);

export function Tooltip({ content, children, side = "bottom" }: { content: ReactNode; children: ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="z-[70] max-w-[300px] rounded-md bg-tooltip-bg px-2 py-1 text-caption text-tooltip-fg shadow-pop motion-safe:animate-fade-in"
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

/** A panel that opens from a control (alerts, sync status): Escape or a click outside closes it, focus goes back. */
export function Popover({
  trigger,
  open,
  onOpenChange,
  align = "end",
  label,
  className,
  children,
}: {
  trigger: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  align?: "start" | "center" | "end";
  /** The panel's accessible name. */
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const returnFocus = useReturnFocus();
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <PopoverPrimitive.Trigger asChild>{trigger}</PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          aria-label={label}
          {...returnFocus}
          align={align}
          sideOffset={8}
          collisionPadding={12}
          className={cx("z-[60] rounded-xl border border-edge bg-raised text-fg shadow-pop focus:outline-none motion-safe:animate-slide-down", className)}
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

// ---------------------------------------------------------------- toasts

interface ToastItem {
  id: number;
  text: string;
  tone: "neutral" | "success" | "danger";
  action?: { label: string; onClick: () => void };
}

let toasts: ToastItem[] = [];
let nextId = 1;
const toastListeners = new Set<() => void>();
const publish = () => {
  for (const listener of toastListeners) listener();
};

const dismiss = (id: number) => {
  toasts = toasts.filter((item) => item.id !== id);
  publish();
};

/** A short message at the bottom of the window that goes away by itself; with an action, a little later. Returns its id. */
export function toast(text: string, tone: ToastItem["tone"] = "neutral", action?: ToastItem["action"]): number {
  const id = nextId++;
  toasts = [...toasts.slice(-2), { id, text, tone, action }];
  publish();
  setTimeout(() => dismiss(id), action ? 8_000 : 5_000);
  return id;
}

/** Takes a toast away early (an undo that no longer applies). */
export const dismissToast = (id: number) => dismiss(id);

export function Toaster() {
  // Toasts belong to the window that shows them: when it goes, so do they (and their actions).
  useEffect(
    () => () => {
      toasts = [];
    },
    [],
  );
  const items = useSyncExternalStore(
    (listener) => {
      toastListeners.add(listener);
      return () => toastListeners.delete(listener);
    },
    () => toasts,
  );
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-5 left-1/2 z-[80] flex -translate-x-1/2 flex-col items-center gap-2">
      {items.map((item) => (
        <div
          key={item.id}
          role="status"
          className={cx(
            "pointer-events-auto flex items-center gap-2.5 rounded-xl py-2.5 pr-2.5 pl-3.5 text-small font-medium shadow-pop motion-safe:animate-pop-in",
            item.tone === "danger" ? "bg-danger-bg text-danger-fg" : "bg-tooltip-bg text-tooltip-fg",
          )}
        >
          {item.tone === "danger" && <Icons.AlertTriangle className="size-4 shrink-0" />}
          {item.tone === "success" && <Icons.CheckCircle className="size-4 shrink-0 text-live" weight="bold" />}
          <span className="pr-1">{item.text}</span>
          {item.action && (
            <button
              type="button"
              onClick={() => {
                item.action?.onClick();
                dismiss(item.id);
              }}
              className="focus-ring -my-1 rounded-md px-2 py-1 font-semibold underline-offset-2 hover:underline"
            >
              {item.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
