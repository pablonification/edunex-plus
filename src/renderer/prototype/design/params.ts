// PROTOTYPE (#83) — throwaway. Prototype state lives in the URL so every
// view is shareable and reload-stable: ?variant=&screen=&theme=&lang=&status=&task=&course=
import { useSyncExternalStore } from "react";
import { TASK_STATUSES, type TaskStatus } from "./data";
import type { Lang } from "./i18n";

export type Screen =
  | "features"
  | "signin"
  | "today"
  | "tasks"
  | "task"
  | "exam"
  | "course"
  | "schedule"
  | "presence"
  | "grades"
  | "academic";
export const SCREENS: Screen[] = ["features", "signin", "today", "tasks", "task", "exam", "course", "schedule", "presence", "grades", "academic"];
export type Theme = "light" | "dark";

export interface Params {
  variant: string;
  screen: Screen;
  theme: Theme;
  lang: Lang;
  status: TaskStatus | null;
  task: string | null;
  course: string | null;
  /** A tab inside the screen (course page, study plan). */
  tab: string | null;
  /** search | inbox | settings */
  overlay: string | null;
  /** First-run step: connect | scan */
  step: string | null;
}

const EVENT = "prototype:params";

function read(): Params {
  const q = new URLSearchParams(window.location.search);
  const screen = q.get("screen") as Screen | null;
  const status = q.get("status") as TaskStatus | null;
  const theme = q.get("theme");
  return {
    variant: q.get("variant") ?? "D",
    screen: screen && SCREENS.includes(screen) ? screen : "features",
    theme: theme === "light" || theme === "dark"
      ? theme
      : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light",
    lang: q.get("lang") === "id" ? "id" : "en",
    status: status && TASK_STATUSES.includes(status) ? status : null,
    task: q.get("task"),
    course: q.get("course"),
    tab: q.get("tab"),
    overlay: q.get("overlay"),
    step: q.get("step"),
  };
}

let cachedSearch = "";
let cached: Params | null = null;

function snapshot(): Params {
  if (!cached || cachedSearch !== window.location.search) {
    cachedSearch = window.location.search;
    cached = read();
  }
  return cached;
}

function subscribe(listener: () => void) {
  window.addEventListener(EVENT, listener);
  window.addEventListener("popstate", listener);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener("popstate", listener);
  };
}

export function setParams(patch: { [K in keyof Params]?: Params[K] | null }) {
  const q = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined) q.delete(key);
    else q.set(key, String(value));
  }
  window.history.replaceState(null, "", `${window.location.pathname}?${q.toString()}`);
  window.dispatchEvent(new Event(EVENT));
}

export function useParams(): Params {
  return useSyncExternalStore(subscribe, snapshot);
}
