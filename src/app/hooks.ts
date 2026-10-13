// Small hooks every screen uses.
import { useCallback, useEffect, useMemo, useRef } from "react";
import { courseColors } from "../core/course-colors";
import { linkHost } from "../core/links";
import type { Course } from "../core/models";
import { useT } from "./i18n";
import { useBridge } from "./store";
import { toast } from "./ui/overlays";

/** Each course's identity color, stable across launches. */
export function useCourseColors(courses: readonly Course[] | undefined): Map<string, string> {
  return useMemo(() => courseColors((courses ?? []).map((course) => course.code)), [courses]);
}

/** Says a link didn't open, naming where it went; never a silent dead click. */
function useLinkFailed(): (url: string) => void {
  const t = useT();
  return useCallback(
    (url: string) => {
      const host = linkHost(url);
      toast(host ? t("link.failed", { host }) : t("link.failedNoHost"), "danger");
    },
    [t],
  );
}

/** Opens an official page (Edunex, SIX, ITB, an online-class link) in the browser. */
export function useOpenExternal(): (url: string) => void {
  const bridge = useBridge();
  const failed = useLinkFailed();
  return useCallback((url: string) => void bridge.invoke("shell.openExternal", { url }).catch(() => failed(url)), [bridge, failed]);
}

/** Opens a link a lecturer wrote (any web page) in the browser, as Edunex does; also an open-source project's page from Settings' licences. */
export function useOpenLink(): (url: string) => void {
  const bridge = useBridge();
  const failed = useLinkFailed();
  return useCallback((url: string) => void bridge.invoke("shell.openLink", { url }).catch(() => failed(url)), [bridge, failed]);
}

/**
 * Where focus goes when the control the Student just used goes away (a row
 * that turns into another, a list that closes): `focusNext(...keys)` moves
 * it, once the next render is on screen, to the first element marked
 * `data-focus="<key>"` that's there (itself when it takes focus, else the
 * first button in it). Without it focus falls to the page, and the next Tab
 * starts over from the top of the window.
 */
export function useFocusNext(): (...keys: string[]) => void {
  const next = useRef<string[] | null>(null);
  useEffect(() => {
    const keys = next.current;
    if (!keys) return;
    next.current = null;
    const marked = [...document.querySelectorAll<HTMLElement>("[data-focus]")];
    for (const key of keys) {
      const el = marked.find((m) => m.dataset.focus === key);
      const target = el?.matches("button, input, [tabindex]") ? el : el?.querySelector<HTMLElement>("button");
      if (target) {
        target.focus();
        return;
      }
    }
  });
  return useCallback((...keys: string[]) => {
    next.current = keys;
  }, []);
}
