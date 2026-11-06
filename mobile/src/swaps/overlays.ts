// The phone's version of src/app/ui/overlays.tsx's toasts, for the desktop's own hooks that say
// something happened (src/app/hooks.ts, course-colors.ts): the same toast()/dismissToast() calls,
// drawn by ../ui/toasts.tsx at the bottom of the screen, above the tabs. Metro swaps this in.
import { useSyncExternalStore } from "react";

export interface ToastItem {
  id: number;
  text: string;
  tone: "neutral" | "success" | "danger";
  action?: { label: string; onClick: () => void };
}

let toasts: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const timers = new Map<number, ReturnType<typeof setTimeout>>();
const publish = () => {
  for (const listener of listeners) listener();
};

/** How long a toast stays: longer with an action to take, an error until it's read. */
const lifetime = (item: ToastItem) => (item.tone === "danger" ? 8_000 : item.action ? 6_000 : 3_500);

export function toast(text: string, tone: ToastItem["tone"] = "neutral", action?: ToastItem["action"]): number {
  const id = nextId++;
  // The same error said again takes the place of the one before it; two at most on a phone.
  let kept = toasts.filter((item) => !(tone === "danger" && item.tone === "danger" && item.text === text));
  while (kept.length > 1) {
    const oldest = kept.findIndex((item) => item.tone !== "danger");
    if (oldest === -1) break;
    kept = kept.filter((_, i) => i !== oldest);
  }
  toasts = [...kept, { id, text, tone, ...(action ? { action } : {}) }];
  timers.set(
    id,
    setTimeout(() => dismissToast(id), lifetime(toasts.at(-1)!)),
  );
  publish();
  return id;
}

export function dismissToast(id: number): void {
  const timer = timers.get(id);
  if (timer) clearTimeout(timer);
  timers.delete(id);
  if (!toasts.some((item) => item.id === id)) return;
  toasts = toasts.filter((item) => item.id !== id);
  publish();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useToasts(): ToastItem[] {
  return useSyncExternalStore(subscribe, () => toasts);
}
