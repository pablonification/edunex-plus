// The signed-in window: sidebar, top bar and the current screen, each inside
// its own crash guard. Settings opens over it (sidebar footer, or ⌘,), quick
// search too (the top bar, or ⌘K), and once, after the first full sync, the
// first-run scan. A screen shows in the sidebar once it's built (its `ready` flag).
import { type ComponentType, useCallback, useEffect, useRef, useState } from "react";
import { edunexCourseUrl, sixStatusUrl } from "../../core/links";
import type { StringKey } from "../../core/strings";
import { type TermCourse, useTermCourses } from "../courses";
import { useOpenExternal } from "../hooks";
import { useT } from "../i18n";
import { displayName, initials } from "../names";
import { NavProvider, type Route, useNav } from "../nav";
import { usePdfViewer } from "../pdf";
import { CourseScreen, ready as courseReady } from "../screens/course";
import { ExamScreen } from "../screens/exam";
import { GradesScreen, ready as gradesReady, useBadge as useGradesBadge } from "../screens/grades";
import { Home } from "../screens/home";
import { PlanScreen, ready as planReady, useBadge as usePlanBadge } from "../screens/plan";
import { PresenceScreen, ready as presenceReady, useBadge as usePresenceBadge } from "../screens/presence";
import { ScheduleScreen, ready as scheduleReady, useBadge as useScheduleBadge } from "../screens/schedule";
import { TaskScreen, TasksScreen, ready as tasksReady, useBadge as useTasksBadge } from "../screens/tasks";
import { useBridge, useCommand, useDataset, useNavigateRequests, useStore } from "../store";
import { AppMark } from "../ui/brand";
import { Button } from "../ui/controls";
import { cx } from "../ui/cx";
import { Badge, CourseDot } from "../ui/display";
import { type IconProps, Icons } from "../ui/icons";
import { factsLabel } from "../ui/layout";
import { Tooltip } from "../ui/overlays";
import { PanelBoundary } from "../ui/panel-boundary";
import { AlertsBell } from "./alerts";
import { FirstScan } from "./first-scan";
import { SearchButton, SearchPalette, useSearchShortcut } from "./search";
import { SettingsDialog } from "./settings";
import { ProblemBanner, refreshNow, SyncStatus } from "./source-status";

export function Shell() {
  return (
    <NavProvider>
      <Layout />
    </NavProvider>
  );
}

function Layout() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const bridge = useBridge();
  const { route, go } = useNav();
  const pdf = usePdfViewer();
  const main = useRef<HTMLElement>(null);
  /** Search opens over anything else; the shortcut also closes it. */
  const openSearch = useCallback((toggle: boolean) => {
    setSettingsOpen(false);
    setScanOpen(false);
    setSearchOpen((open) => !(toggle && open));
  }, []);
  useNavigateRequests(go);
  useSearchShortcut(useCallback(() => openSearch(true), [openSearch]));
  useCommand(
    useCallback(
      (command) => {
        if (command === "settings") setSettingsOpen(true);
        if (command === "refresh") void refreshNow(bridge);
        if (command === "search") openSearch(false);
      },
      [bridge, openSearch],
    ),
  );
  useRefreshWhenBackOnline();
  useNavShortcuts(
    useCallback(() => {
      setSettingsOpen(false);
      setSearchOpen(false);
      setScanOpen(false);
      pdf.close();
    }, [pdf]),
  );
  // A new screen starts at its top, with no PDF from the last one left open over it (a search result, a notification, ⌘[).
  const key = JSON.stringify(route);
  // biome-ignore lint/correctness/useExhaustiveDependencies: key is the route; it changing is what scrolls back to the top
  useEffect(() => {
    if (main.current) main.current.scrollTop = 0;
    pdf.close();
  }, [key]);

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas text-fg">
      <PanelBoundary name="sidebar" compact>
        <Sidebar onSettings={() => setSettingsOpen(true)} />
      </PanelBoundary>
      <div className="flex min-w-0 flex-1 flex-col">
        <PanelBoundary name="top bar" compact>
          <TopBar onSearch={() => openSearch(false)} />
          <ProblemBanner />
        </PanelBoundary>
        <main ref={main} className="min-h-0 flex-1 overflow-y-auto">
          <PanelBoundary key={key} name={route.screen}>
            <CurrentScreen route={route} />
          </PanelBoundary>
        </main>
      </div>
      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onShowFirstScan={() => {
          setSettingsOpen(false);
          setScanOpen(true);
        }}
      />
      <SearchPalette open={searchOpen} onOpenChange={setSearchOpen} onSettings={() => setSettingsOpen(true)} />
      <FirstScan open={scanOpen} onOpenChange={setScanOpen} blocked={settingsOpen || searchOpen} />
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
      return <CourseScreen code={route.code} tab={route.tab} module={route.module} />;
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

const NAV_ORDER = ["home", "tasks", "schedule", "presence", "grades", "plan"] as const;

/** ⌘1 to ⌘6 open the six places in the sidebar (Ctrl elsewhere); ⌘[ goes back. Either closes what's open over the screen first. */
function useNavShortcuts(closeOverlays: () => void) {
  const store = useStore();
  const { go, back } = useNav();
  useEffect(() => {
    const mac = store.platform === "darwin";
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.altKey || event.shiftKey || !(mac ? event.metaKey : event.ctrlKey)) return;
      if (event.key === "[") {
        event.preventDefault();
        closeOverlays();
        back();
        return;
      }
      const index = Number(event.key) - 1;
      if (!Number.isInteger(index) || index < 0 || index >= NAV_ORDER.length) return;
      event.preventDefault();
      closeOverlays();
      go({ screen: NAV_ORDER[index] } as Route);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [store, go, back, closeOverlays]);
}

/** Coming back online is the best moment to check again; the engine's own rhythm handles the rest. */
function useRefreshWhenBackOnline() {
  const bridge = useBridge();
  useEffect(() => {
    const refresh = () => void refreshNow(bridge);
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
  const { route, go } = useNav();
  const account = useDataset("edunex.account");
  const student = useDataset("six.student");
  const update = useDataset("app.update");
  const courses = useTermCourses();
  const open = useOpenExternal();
  /** Until the course page exists, a course opens on its official site: Edunex's page, else SIX's list. */
  const outside = (course: TermCourse) =>
    course.edunex
      ? { url: edunexCourseUrl(course.edunex.courseId), label: t("action.openInEdunex") }
      : student
        ? { url: sixStatusUrl(student.nim), label: t("action.openInSix") }
        : null;
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
      {store.platform === "darwin" && <div className="drag h-10 shrink-0" />}
      {/* The app's own name, under the window buttons on macOS. */}
      <div className={cx("flex h-11 shrink-0 items-center gap-2.5 px-5", store.platform === "darwin" && "drag")}>
        <AppMark className="size-5" />
        <span className="text-body font-semibold tracking-[-0.01em]">Edunex Plus</span>
      </div>

      <nav aria-label={t("nav.menu")} className="space-y-0.5 px-3">
        {items
          .filter((item) => item.ready)
          .map(({ screen, label, Icon, badge, owns }, index) => {
            const active = route.screen === screen || (owns ?? []).includes(route.screen);
            return (
              <Tooltip key={screen} side="right" content={factsLabel(t(label), `${store.platform === "darwin" ? "⌘" : "Ctrl+"}${index + 1}`)}>
                <button
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => go({ screen } as Route)}
                  className={cx(
                    "focus-ring flex h-[34px] w-full items-center gap-2.5 rounded-lg px-2.5 text-body",
                    active ? "bg-selected font-semibold" : "font-medium text-fg/90 hover:bg-hover",
                  )}
                >
                  <Icon className={cx("size-[17px] shrink-0", active ? "text-accent-fg" : "text-muted")} weight={active ? "fill" : "regular"} />
                  <span className="flex-1 truncate text-left">{t(label)}</span>
                  {badge && <Badge tone={badge.tone === "warning" ? "warning" : "neutral"}>{badge.value}</Badge>}
                </button>
              </Tooltip>
            );
          })}
      </nav>

      <div className="mt-6 min-h-0 flex-1 overflow-y-auto px-3">
        {courses && courses.length > 0 && (
          <>
            <p className="mb-1.5 px-2.5 text-caption font-semibold text-faint">{t("nav.courses")}</p>
            <ul className="space-y-0.5">
              {courses.map((course) => {
                const active = route.screen === "course" && route.code === course.code;
                const site = courseReady ? null : outside(course);
                const row = (
                  <button
                    type="button"
                    aria-current={active ? "page" : undefined}
                    onClick={() => (courseReady ? go({ screen: "course", code: course.code }) : site && open(site.url))}
                    title={course.name}
                    className={cx(
                      "focus-ring flex h-[34px] w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-body",
                      active ? "bg-selected" : "hover:bg-hover",
                    )}
                  >
                    <CourseDot color={course.color} />
                    <span className={cx("shrink-0 tabular-nums", active ? "font-semibold" : "font-medium")}>{course.code}</span>
                    <span className="truncate text-small text-muted">{course.name}</span>
                  </button>
                );
                return (
                  <li key={course.code}>
                    {site ? (
                      <Tooltip content={site.label} side="right">
                        {row}
                      </Tooltip>
                    ) : (
                      row
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      <div className="border-t border-line px-2 py-2">
        <button type="button" onClick={onSettings} className="focus-ring flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-hover">
          <span className="grid size-7 shrink-0 place-items-center rounded-full bg-info-bg text-micro font-bold text-info-fg">
            {account ? initials(account.name) : <Icons.User className="size-3.5" />}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-small font-semibold">{account ? displayName(account.name) : t("nav.settings")}</span>
            <span className="block truncate text-caption text-faint">{account ? t("nav.settings") : (student?.nim ?? "")}</span>
          </span>
          <span className="relative ml-auto shrink-0">
            <Icons.Settings className="size-4 text-faint" />
            {update && (
              <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-accent ring-2 ring-sidebar">
                <span className="sr-only">{t("update.available")}</span>
              </span>
            )}
          </span>
        </button>
      </div>
    </aside>
  );
}

/** What the back button says: where it goes. (No saved data here: the top bar must not break with a screen's data.) */
function useBackLabel(previous: Route | null): string {
  const t = useT();
  if (!previous) return t("action.back");
  switch (previous.screen) {
    case "course":
      return previous.code;
    case "task":
      return t("nav.task");
    case "exam":
      return t("nav.exam");
    default:
      return t(`nav.${previous.screen}`);
  }
}

function TopBar({ onSearch }: { onSearch: () => void }) {
  const store = useStore();
  const t = useT();
  const { route, back, canGoBack, previous } = useNav();
  const backLabel = useBackLabel(previous);
  const detail = route.screen === "task" || route.screen === "exam" || route.screen === "course";
  return (
    <header className={cx("flex h-[52px] shrink-0 items-center gap-3 border-b border-line px-5 select-none", store.platform === "darwin" && "drag")}>
      {detail && canGoBack && (
        <Tooltip content={factsLabel(t("action.back"), store.platform === "darwin" ? "⌘[" : "Ctrl+[")}>
          <Button
            variant="ghost"
            size="sm"
            aria-label={t("action.backTo", { place: backLabel })}
            className="no-drag -ml-1.5 max-w-[280px] text-small"
            icon={<Icons.ChevronLeft className="size-4 shrink-0" />}
            onClick={back}
          >
            <span className="truncate">{backLabel}</span>
          </Button>
        </Tooltip>
      )}
      <div className="no-drag ml-auto flex items-center gap-1">
        <SearchButton onOpen={onSearch} />
        <AlertsBell />
        <SyncStatus />
      </div>
    </header>
  );
}
