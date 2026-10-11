// Things that float above the window: dialogs, the confirm dialog, tooltips
// and toasts. Radix handles focus trapping, Escape and screen-reader roles.
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { useSyncExternalStore, type ReactNode } from "react";
import { useT } from "../i18n";
import { Button, IconButton } from "./controls";
import { cx } from "./cx";
import { Icons } from "./icons";

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
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-scrim backdrop-blur-[2px] motion-safe:animate-fade-in" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
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
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[55] bg-scrim motion-safe:animate-fade-in" />
        <DialogPrimitive.Content
          role="alertdialog"
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

// ---------------------------------------------------------------- toasts

interface ToastItem {
  id: number;
  text: string;
  tone: "neutral" | "danger";
}

let toasts: ToastItem[] = [];
let nextId = 1;
const toastListeners = new Set<() => void>();
const publish = () => {
  for (const listener of toastListeners) listener();
};

/** A short message at the bottom of the window that goes away by itself. */
export function toast(text: string, tone: ToastItem["tone"] = "neutral"): void {
  const id = nextId++;
  toasts = [...toasts.slice(-2), { id, text, tone }];
  publish();
  setTimeout(() => {
    toasts = toasts.filter((item) => item.id !== id);
    publish();
  }, 5_000);
}

export function Toaster() {
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
            "pointer-events-auto flex items-center gap-2 rounded-lg px-3.5 py-2 text-small font-medium shadow-pop motion-safe:animate-pop-in",
            item.tone === "danger" ? "bg-danger-bg text-danger-fg" : "bg-tooltip-bg text-tooltip-fg",
          )}
        >
          {item.tone === "danger" && <Icons.AlertTriangle className="size-3.5" />}
          {item.text}
        </div>
      ))}
    </div>
  );
}
