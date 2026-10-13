// Small hooks every screen uses.
import { useCallback, useMemo } from "react";
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

/** Opens a link a lecturer wrote (any web page) in the browser, as Edunex does. */
export function useOpenLink(): (url: string) => void {
  const bridge = useBridge();
  const failed = useLinkFailed();
  return useCallback((url: string) => void bridge.invoke("shell.openLink", { url }).catch(() => failed(url)), [bridge, failed]);
}
