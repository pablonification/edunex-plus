// The signed-in window: sidebar, top bar and the current screen, each inside
// its own crash guard. Settings opens over it (sidebar footer, or ⌘,).
import { useCallback, useEffect, useMemo, useState } from "react";
import { courseColors } from "../../core/course-colors";
import { edunexCourseUrl } from "../../core/links";
import type { Course } from "../../core/models";
import { useFormat, useT } from "../i18n";
import { displayName, initials } from "../names";
import { Home } from "../screens/home";
import { useBridge, useCommand, useDataset, useStatus, useStore } from "../store";
import { IconButton } from "../ui/controls";
import { CourseDot } from "../ui/display";
import { cx } from "../ui/cx";
import { Icons } from "../ui/icons";
import { Tooltip } from "../ui/overlays";
import { PanelBoundary } from "../ui/panel-boundary";
import { SettingsDialog } from "./settings";
import { SourceStatusChip, useRefresh } from "./source-status";

export function Shell() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const bridge = useBridge();
  useCommand(
    useCallback(
      (command) => {
        if (command === "settings") setSettingsOpen(true);
        if (command === "refresh") void bridge.invoke("sync.refresh", {}).catch(() => undefined);
      },
      [bridge],
    ),
  );
  useRefreshWhenBackOnline();

  return (
    <div className="flex h-screen overflow-hidden bg-canvas text-fg">
      <PanelBoundary name="sidebar" compact>
        <Sidebar onSettings={() => setSettingsOpen(true)} />
      </PanelBoundary>
      <div className="flex min-w-0 flex-1 flex-col">
        <PanelBoundary name="top bar" compact>
          <TopBar />
        </PanelBoundary>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <PanelBoundary name="home">
            <Home />
          </PanelBoundary>
        </main>
      </div>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}

export function useCourseColors(courses: readonly Course[] | undefined): Map<string, string> {
  return useMemo(() => courseColors((courses ?? []).map((course) => course.code)), [courses]);
}

export function useOpenExternal() {
  const bridge = useBridge();
  return useCallback((url: string) => void bridge.invoke("shell.openExternal", { url }).catch(() => undefined), [bridge]);
}

/** Coming back online is the best moment to check again; the engine's own rhythm handles the rest. */
function useRefreshWhenBackOnline() {
  const bridge = useBridge();
  useEffect(() => {
    const refresh = () => void bridge.invoke("sync.refresh", {}).catch(() => undefined);
    window.addEventListener("online", refresh);
    return () => window.removeEventListener("online", refresh);
  }, [bridge]);
}

function Sidebar({ onSettings }: { onSettings: () => void }) {
  const store = useStore();
  const t = useT();
  const f = useFormat();
  const account = useDataset("edunex.account");
  const courses = useDataset("edunex.courses");
  const status = useStatus("edunex");
  const colors = useCourseColors(courses);
  const open = useOpenExternal();

  return (
    <aside className="flex h-full w-[248px] shrink-0 flex-col border-r border-line bg-sidebar select-none">
      <div className={cx("shrink-0", store.platform === "darwin" ? "drag h-[52px]" : "h-3")} />

      <nav aria-label={t("nav.home")} className="space-y-px px-3">
        <button
          type="button"
          aria-current="page"
          className="focus-ring flex h-8 w-full items-center gap-2.5 rounded-lg bg-selected px-2.5 text-body font-semibold"
        >
          <Icons.Home className="size-4" strokeWidth={2} />
          <span className="flex-1 truncate text-left">{t("nav.home")}</span>
        </button>
      </nav>

      <div className="mt-6 min-h-0 flex-1 overflow-y-auto px-3">
        {courses && courses.length > 0 && (
          <>
            <p className="mb-1 px-2.5 text-caption font-semibold tracking-[0.04em] text-faint uppercase">{t("nav.courses")}</p>
            <ul className="space-y-px">
              {courses.map((course) => (
                <li key={course.code}>
                  <Tooltip content={t("action.openInEdunex")} side="right">
                    <button
                      type="button"
                      onClick={() => open(edunexCourseUrl(course.edunex.courseId))}
                      className="focus-ring flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-body transition-colors duration-150 hover:bg-hover"
                    >
                      <CourseDot color={colors.get(course.code) ?? "#888"} />
                      <span className="shrink-0 font-semibold tabular-nums">{course.code}</span>
                      <span className="truncate text-muted">{course.name}</span>
                    </button>
                  </Tooltip>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <div className="border-t border-line px-2 py-2">
        <button
          type="button"
          onClick={onSettings}
          className="focus-ring flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors duration-150 hover:bg-hover"
        >
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-info-bg text-micro font-bold text-info-fg">
            {account ? initials(account.name) : <Icons.User className="size-3.5" />}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-small font-semibold">{account ? displayName(account.name) : t("nav.settings")}</span>
            <span className="flex items-center gap-1.5 truncate text-caption text-faint">
              {t("source.edunex")} · {status.updatedAt ? f.time(status.updatedAt) : t(`status.${status.state}`)}
            </span>
          </span>
          <Icons.Settings className="ml-auto size-4 shrink-0 text-faint" />
        </button>
      </div>
    </aside>
  );
}

function TopBar() {
  const store = useStore();
  const t = useT();
  const status = useStatus("edunex");
  const { refresh, busy } = useRefresh();
  return (
    <header className={cx("flex h-[52px] shrink-0 items-center gap-3 border-b border-line px-6 select-none", store.platform === "darwin" && "drag")}>
      <div className="no-drag ml-auto flex items-center gap-1.5">
        <SourceStatusChip source="edunex" />
        <Tooltip content={t("action.refresh")}>
          <IconButton label={t("action.refresh")} disabled={busy || status.state === "signed-out" || status.state === "expired"} onClick={() => void refresh()}>
            <Icons.RefreshCw className={cx("size-4", busy && "animate-spin")} />
          </IconButton>
        </Tooltip>
      </div>
    </header>
  );
}
