// Things that float above the window: dialogs, the confirm dialog, tooltips
// and toasts. Radix handles focus trapping, Escape and screen-reader roles.
// Each one leaves the way it came (Radix waits for the closing animation).
import * as AlertDialogPrimitive from "@radix-ui/react-alert-dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { type MouseEvent, type ReactNode, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { useT } from "../i18n";
import { Button, IconButton } from "./controls";
import { cx } from "./cx";
import { Icons } from "./icons";
import { Presence, usePresence } from "./motion/presence";
import { focusInsteadOf } from "./motion/presence-list";

/**
 * Focus goes back to what opened a dialog or panel when it closes, by Escape
 * or its close button. Radix only does that through its own Trigger, which a
 * dialog opened from state (Settings, ⌘K) or a trigger wrapped for its
 * tooltip doesn't have: focus fell to the page and the next Tab started over.
 * A click elsewhere in a panel leaves focus where the click put it. If what
 * opened it has gone meanwhile with its row (a menu item that snoozed its own
 * row), focus goes where the leaving row sent it (PresenceList).
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
      if (clickedAway.current || !opener.current) return;
      // Its row has gone and the screen has already put focus where it belongs (the planner's hidden list): it stays there.
      const gone = !opener.current.isConnected || opener.current.closest("[data-leaving]") !== null;
      const at = document.activeElement;
      if (gone && at instanceof HTMLElement && at !== document.body && at.isConnected && !at.closest("[data-leaving]")) return;
      if (!focusInsteadOf(opener.current) && opener.current.isConnected) opener.current.focus();
    },
  };
}

/** The tint behind a dialog: a solid scrim (no blur to redraw), fading in and out. Add a layer: z-(--z-dialog). */
export const SCRIM_CLASS = "fixed inset-0 bg-scrim motion-safe:data-[state=open]:animate-fade-in motion-safe:data-[state=closed]:animate-fade-out";
/** A dialog panel arriving (from 98%) and leaving, a little quicker. Pair it with onClickCapture={ignoreClosingClick}. */
export const PANEL_MOTION_CLASS = "motion-safe:data-[state=open]:animate-pop-in motion-safe:data-[state=closed]:animate-pop-out";

/**
 * A panel that is leaving (Radix keeps it on screen for its closing animation)
 * takes no more clicks, so the second click of a double-click, or a second
 * Enter, can't run its action again. It still catches them, so they don't land
 * on the page under it either.
 */
export function ignoreClosingClick(event: MouseEvent<HTMLElement>) {
  if (event.currentTarget.dataset.state !== "closed") return;
  event.preventDefault();
  event.stopPropagation();
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
        <DialogPrimitive.Overlay className={cx(SCRIM_CLASS, "z-(--z-dialog)")} />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onOpenAutoFocus={onOpenAutoFocus}
          onCloseAutoFocus={onCloseAutoFocus}
          onClickCapture={ignoreClosingClick}
          className={cx(
            "fixed top-1/2 left-1/2 z-(--z-dialog) flex max-h-[min(720px,86vh)] w-[min(600px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden",
            "rounded-2xl bg-raised text-fg shadow-dialog ring-1 ring-black/10 focus:outline-none dark:ring-white/10",
            PANEL_MOTION_CLASS,
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

/**
 * Asks before something that can't be undone from inside the app. A real alert
 * dialog: a click beside it doesn't count as an answer, and Cancel has focus
 * first, so Enter never confirms by accident.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  busy = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: string;
  confirmLabel: string;
  /** What staying means here, where "Batal" alone would be unclear ("Lanjut mengisi"). */
  cancelLabel?: string;
  onConfirm: () => void;
  busy?: boolean;
}) {
  const t = useT();
  const { onOpenAutoFocus, onCloseAutoFocus } = useReturnFocus();
  return (
    <AlertDialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialogPrimitive.Portal>
        <AlertDialogPrimitive.Overlay className={cx(SCRIM_CLASS, "z-(--z-confirm)")} />
        <AlertDialogPrimitive.Content
          onOpenAutoFocus={onOpenAutoFocus}
          onCloseAutoFocus={onCloseAutoFocus}
          onClickCapture={ignoreClosingClick}
          className={cx(
            "fixed top-1/2 left-1/2 z-(--z-confirm) w-[min(420px,calc(100vw-48px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-raised p-5 text-fg shadow-dialog ring-1 ring-black/10 focus:outline-none dark:ring-white/10",
            PANEL_MOTION_CLASS,
          )}
        >
          <AlertDialogPrimitive.Title className="text-title font-semibold">{title}</AlertDialogPrimitive.Title>
          <AlertDialogPrimitive.Description className="mt-1.5 text-body text-pretty text-muted">{body}</AlertDialogPrimitive.Description>
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialogPrimitive.Cancel asChild>
              <Button variant="secondary">{cancelLabel ?? t("action.cancel")}</Button>
            </AlertDialogPrimitive.Cancel>
            <Button variant="danger" busy={busy} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </AlertDialogPrimitive.Content>
      </AlertDialogPrimitive.Portal>
    </AlertDialogPrimitive.Root>
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
          // Grows from its control after the wait; moving on to the next control shows its tooltip at
          // once (instant-open), and the one before goes at once, so two never show together.
          className="z-(--z-tooltip) max-w-[300px] origin-(--radix-tooltip-content-transform-origin) rounded-md bg-tooltip-bg px-2 py-1 text-caption text-tooltip-fg shadow-pop motion-safe:data-[state=delayed-open]:animate-popover-in"
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
          onClickCapture={ignoreClosingClick}
          align={align}
          sideOffset={8}
          collisionPadding={12}
          // Grows from its control, so it shows which side it opened on, and fades as it closes.
          className={cx(
            "z-(--z-popover) origin-(--radix-popover-content-transform-origin) rounded-xl border border-edge bg-raised text-fg shadow-pop focus:outline-none",
            "motion-safe:data-[state=open]:animate-popover-in motion-safe:data-[state=closed]:animate-popover-out",
            className,
          )}
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

/**
 * Each toast's time left. It waits while the Student reads it (the pointer on
 * it, or focus on its action) and goes on with what was left after.
 */
interface ToastClock {
  left: number;
  since: number;
  timer: ReturnType<typeof setTimeout> | null;
  held: Set<"pointer" | "focus">;
}
const clocks = new Map<number, ToastClock>();

function stopClock(id: number) {
  const timer = clocks.get(id)?.timer;
  if (timer) clearTimeout(timer);
  clocks.delete(id);
}

const dismiss = (id: number) => {
  stopClock(id);
  toasts = toasts.filter((item) => item.id !== id);
  publish();
};

function runClock(id: number) {
  const clock = clocks.get(id);
  if (!clock || clock.timer || clock.held.size) return;
  clock.since = Date.now();
  clock.timer = setTimeout(() => dismiss(id), clock.left);
}

function holdClock(id: number, by: "pointer" | "focus") {
  const clock = clocks.get(id);
  if (!clock) return;
  clock.held.add(by);
  if (!clock.timer) return;
  clearTimeout(clock.timer);
  clock.timer = null;
  clock.left = Math.max(0, clock.left - (Date.now() - clock.since));
}

function releaseClock(id: number, by: "pointer" | "focus") {
  clocks.get(id)?.held.delete(by);
  runClock(id);
}

/** A short message at the bottom of the window that goes away by itself; with an action, a little later. Returns its id. */
export function toast(text: string, tone: ToastItem["tone"] = "neutral", action?: ToastItem["action"]): number {
  const id = nextId++;
  for (const pushedOut of toasts.slice(0, -2)) stopClock(pushedOut.id);
  toasts = [...toasts.slice(-2), { id, text, tone, action }];
  publish();
  clocks.set(id, { left: action ? 8_000 : 5_000, since: 0, timer: null, held: new Set() });
  runClock(id);
  return id;
}

/** Takes a toast away early (an undo that no longer applies). */
export const dismissToast = (id: number) => dismiss(id);

export function Toaster() {
  // Toasts belong to the window that shows them: when it goes, so do they (and their actions).
  useEffect(
    () => () => {
      for (const id of [...clocks.keys()]) stopClock(id);
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
    // Newest at the bottom. A toast rises in; when one goes, it fades first, then the gap closes,
    // so the others slide into place instead of jumping. The live region itself never leaves.
    <div aria-live="polite" className="pointer-events-none fixed bottom-5 left-1/2 z-(--z-toast) flex -translate-x-1/2 flex-col items-center">
      <Presence>
        {items.map((item) => (
          <Toast key={item.id} item={item} />
        ))}
      </Presence>
    </div>
  );
}

/** Where focus was before it came into each toast (its card): it goes back there when the toast goes. */
const focusCameFrom = new WeakMap<Element, HTMLElement>();

function Toast({ item }: { item: ToastItem }) {
  const ref = useRef<HTMLDivElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const exit = usePresence()?.exit;
  const leaving = exit !== undefined;
  useLayoutEffect(() => {
    if (!exit || !ref.current || !card.current) return;
    // Focus in a leaving toast (Undo pressed from the keyboard) goes back where it came from, or where
    // that has gone with its row, before the card turns inert: as a prop, React would make it inert
    // first and drop the focus on the page.
    const back = focusCameFrom.get(card.current);
    if (back && card.current.contains(document.activeElement) && !focusInsteadOf(back) && back.isConnected) back.focus();
    card.current.setAttribute("inert", "");
    return exit(ref.current);
  }, [exit]);
  return (
    // Rises in with CSS (none with Reduce motion); leaves with the kit's fade and closing gap, clipped
    // meanwhile. A leaving toast takes no more clicks, so a second click on Undo can't run it twice:
    // its card is inert, and the box around it catches the click so it doesn't land on the page behind.
    <div ref={ref} className={cx("flex justify-center pt-2 motion-safe:animate-toast-in", leaving && "pointer-events-auto overflow-clip")}>
      <div
        ref={card}
        role="status"
        onPointerEnter={() => holdClock(item.id, "pointer")}
        onPointerLeave={() => releaseClock(item.id, "pointer")}
        onFocus={(event) => {
          holdClock(item.id, "focus");
          const from = event.relatedTarget;
          if (!(from instanceof HTMLElement) || event.currentTarget.contains(from)) return;
          // From another toast: where that one's focus came from, which outlasts it.
          const toastBefore = from.closest("[role=status]");
          focusCameFrom.set(event.currentTarget, (toastBefore && focusCameFrom.get(toastBefore)) || from);
        }}
        onBlur={(event) => !event.currentTarget.contains(event.relatedTarget) && releaseClock(item.id, "focus")}
        className={cx(
          "pointer-events-auto flex items-center gap-2.5 rounded-xl py-2.5 pr-2.5 pl-3.5 text-small font-medium shadow-pop",
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
    </div>
  );
}
