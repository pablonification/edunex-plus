// The signed-in window: sidebar, top bar and the current screen, each inside
// its own crash guard. Settings opens over it (sidebar footer, or ⌘,). A
// screen shows in the sidebar once it's built (its `ready` flag).
import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import { edunexCourseUrl } from "../../core/links";
import type { StringKey } from "../../core/strings";
import { useCourseColors, useOpenExternal } from "../hooks";
import { useFormat, useT } from "../i18n";
import { displayName, initials } from "../names";
import { NavProvider, type Route, useNav } from "../nav";
import { CourseScreen, ready as courseReady } from "../screens/course";
import { ExamScreen } from "../screens/exam";
import { GradesScreen, ready as gradesReady, useBadge as useGradesBadge } from "../screens/grades";
import { Home } from "../screens/home";
import { PlanScreen, ready as planReady, useBadge as usePlanBadge } from "../screens/plan";
import { PresenceScreen, ready as presenceReady, useBadge as usePresenceBadge } from "../screens/presence";
import { ScheduleScreen, ready as scheduleReady, useBadge as useScheduleBadge } from "../screens/schedule";
import { TaskScreen, TasksScreen, ready as tasksReady, useBadge as useTasksBadge } from "../screens/tasks";
import { useBridge, useCommand, useDataset, useStatus, useStore } from "../store";
import { IconButton } from "../ui/controls";
import { Badge, CourseDot } from "../ui/display";
import { cx } from "../ui/cx";
import { type IconProps, Icons } from "../ui/icons";
import { Tooltip } from "../ui/overlays";
import { PanelBoundary } from "../ui/panel-boundary";
import { SettingsDialog } from "./settings";
import { SourceStatusChip, useRefresh } from "./source-status";

export function Shell() {
  return (
    <NavProvider>
      <Layout />
    </NavProvider>
  );
}

function Layout() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const bridge = useBridge();
  const { route } = useNav();
  const main = useRef<HTMLElement>(null);
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
  // A new screen starts at its top.
  const key = JSON.stringify(route);
  useEffect(() => {
    if (main.current) main.current.scrollTop = 0;
  }, [key]);

  return (
    <div className="flex h-screen overflow-hidden bg-canvas text-fg">
      <PanelBoundary name="sidebar" compact>
        <Sidebar onSettings={() => setSettingsOpen(true)} />
      </PanelBoundary>
      <div className="flex min-w-0 flex-1 flex-col">
        <PanelBoundary name="top bar" compact>
          <TopBar />
        </PanelBoundary>
        <main ref={main} className="min-h-0 flex-1 overflow-y-auto">
          <PanelBoundary key={key} name={route.screen}>
            <CurrentScreen route={route} />
          </PanelBoundary>
        </main>
      </div>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
    </div>
  );
}

function CurrentScreen({ route }: { route: Route }) {
  switch (route.screen) {
    case "home":
      return <Home />;
    case "tasks":
      return <TasksScreen />;
    case "task":
      return <TaskScreen taskId={route.taskId} />;
    case "exam":
      return <ExamScreen examId={route.examId} />;
    case "course":
      return <CourseScreen code={route.code} tab={route.tab} />;
    case "schedule":
      return <ScheduleScreen />;
    case "presence":
      return <PresenceScreen />;
    case "grades":
      return <GradesScreen />;
    case "plan":
      return <PlanScreen tab={route.tab} />;
  }
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

interface NavItem {
  screen: "home" | "tasks" | "schedule" | "presence" | "grades" | "plan";
  label: StringKey;
  Icon: ComponentType<IconProps>;
  ready: boolean;
  badge: ReturnType<typeof useTasksBadge>;
  /** Detail screens that belong to this item. */
  owns?: Route["screen"][];
}

function Sidebar({ onSettings }: { onSettings: () => void }) {
  const store = useStore();
  const t = useT();
  const f = useFormat();
  const { route, go } = useNav();
  const account = useDataset("edunex.account");
  const courses = useDataset("edunex.courses");
  const status = useStatus("edunex");
  const colors = useCourseColors(courses);
  const open = useOpenExternal();
  const items: NavItem[] = [
    { screen: "home", label: "nav.home", Icon: Icons.Home, ready: true, badge: null },
    { screen: "tasks", label: "nav.tasks", Icon: Icons.ListChecks, ready: tasksReady, badge: useTasksBadge(), owns: ["task", "exam"] },
    { screen: "schedule", label: "nav.schedule", Icon: Icons.Calendar, ready: scheduleReady, badge: useScheduleBadge() },
    { screen: "presence", label: "nav.presence", Icon: Icons.Hand, ready: presenceReady, badge: usePresenceBadge() },
    { screen: "grades", label: "nav.grades", Icon: Icons.GraduationCap, ready: gradesReady, badge: useGradesBadge() },
    { screen: "plan", label: "nav.plan", Icon: Icons.BookOpen, ready: planReady, badge: usePlanBadge() },
  ];

  return (
    <aside className="flex h-full w-[248px] shrink-0 flex-col border-r border-line bg-sidebar select-none">
      <div className={cx("shrink-0", store.platform === "darwin" ? "drag h-[52px]" : "h-3")} />

      <nav aria-label={t("nav.home")} className="space-y-px px-3">
        {items
          .filter((item) => item.ready)
          .map(({ screen, label, Icon, badge, owns }) => {
            const active = route.screen === screen || (owns ?? []).includes(route.screen);
            return (
              <button
                key={screen}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => go({ screen } as Route)}
                className={cx(
                  "focus-ring flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-body transition-colors duration-150",
                  active ? "bg-selected font-semibold" : "font-medium hover:bg-hover",
                )}
              >
                <Icon className={cx("size-4", !active && "text-muted")} strokeWidth={active ? 2 : 1.75} />
                <span className="flex-1 truncate text-left">{t(label)}</span>
                {badge && <Badge tone={badge.tone === "warning" ? "warning" : "neutral"}>{badge.value}</Badge>}
              </button>
            );
          })}
      </nav>

      <div className="mt-6 min-h-0 flex-1 overflow-y-auto px-3">
        {courses && courses.length > 0 && (
          <>
            <p className="mb-1 px-2.5 text-caption font-semibold tracking-[0.04em] text-faint uppercase">{t("nav.courses")}</p>
            <ul className="space-y-px">
              {courses.map((course) => {
                const active = route.screen === "course" && route.code === course.code;
                const row = (
                  <button
                    type="button"
                    aria-current={active ? "page" : undefined}
                    onClick={() => (courseReady ? go({ screen: "course", code: course.code }) : open(edunexCourseUrl(course.edunex.courseId)))}
                    className={cx(
                      "focus-ring flex h-8 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-body transition-colors duration-150",
                      active ? "bg-selected" : "hover:bg-hover",
                    )}
                  >
                    <CourseDot color={colors.get(course.code) ?? "#888"} />
                    <span className="shrink-0 font-semibold tabular-nums">{course.code}</span>
                    <span className="truncate text-muted">{course.name}</span>
                  </button>
                );
                return (
                  <li key={course.code}>
                    {courseReady ? (
                      row
                    ) : (
                      <Tooltip content={t("action.openInEdunex")} side="right">
                        {row}
                      </Tooltip>
                    )}
                  </li>
                );
              })}
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
  const { route, back, canGoBack } = useNav();
  const status = useStatus("edunex");
  const { refresh, busy } = useRefresh();
  const detail = route.screen === "task" || route.screen === "exam" || route.screen === "course";
  return (
    <header className={cx("flex h-[52px] shrink-0 items-center gap-3 border-b border-line px-6 select-none", store.platform === "darwin" && "drag")}>
      {detail && canGoBack && (
        <Tooltip content={t("action.back")}>
          <IconButton label={t("action.back")} className="no-drag -ml-2" onClick={back}>
            <Icons.ChevronLeft className="size-4" />
          </IconButton>
        </Tooltip>
      )}
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
