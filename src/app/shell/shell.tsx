// The signed-in window: sidebar, top bar and the current screen, each inside
// its own crash guard. Settings opens over it (sidebar footer, or ⌘,), quick
// search too (the top bar, or ⌘K), and once, after the first full sync, the
// first-run scan. A screen shows in the sidebar once it's built (./built.ts).
// Beranda comes with the window; every other screen loads after it (../later.tsx).
import { type ComponentType, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { edunexCourseUrl, sixStatusUrl } from "../../core/links";
import type { StringKey } from "../../core/strings";
import { type TermCourse, useTermCourses } from "../courses";
import { useOpenExternal } from "../hooks";
import { useT } from "../i18n";
import { later } from "../later";
import { displayName, initials } from "../names";
import { NavProvider, type Route, useNav } from "../nav";
import { usePdfViewer } from "../pdf";
import { Home } from "../screens/home";
import { useBridge, useCommand, useDataset, useJoined, useNavigateRequests, useStore } from "../store";
import { AppMark } from "../ui/brand";
import { Button } from "../ui/controls";
import { cx } from "../ui/cx";
import { Badge, CourseDot } from "../ui/display";
import { type IconProps, Icons } from "../ui/icons";
import { factsLabel } from "../ui/layout";
import { ARRIVE_APP } from "../ui/motion/arrival";
import { Tooltip, toast } from "../ui/overlays";
import { PanelBoundary } from "../ui/panel-boundary";
import { AlertsBell } from "./alerts";
import { type Badge as BadgeValue, usePlanBadge, usePresenceBadge, useTasksBadge } from "./badges";
import { isBuilt } from "./built";
import { SearchButton, useSearchShortcut } from "./search-button";
import { ProblemBanner, refreshNow, SyncStatus } from "./source-status";

// In the sidebar's order, the order they load in.
const TasksScreen = later(() => import("../screens/tasks").then((screen) => screen.TasksScreen));
const ScheduleScreen = later(() => import("../screens/schedule").then((screen) => screen.ScheduleScreen));
const PresenceScreen = later(() => import("../screens/presence").then((screen) => screen.PresenceScreen));
const GradesScreen = later(() => import("../screens/grades").then((screen) => screen.GradesScreen));
const PlanScreen = later(() => import("../screens/plan").then((screen) => screen.PlanScreen));
const CourseScreen = later(() => import("../screens/course").then((screen) => screen.CourseScreen));
const TaskScreen = later(() => import("../screens/tasks").then((screen) => screen.TaskScreen));
const ExamScreen = later(() => import("../screens/exam").then((screen) => screen.ExamScreen));
// What opens over the screen: Settings, quick search and the first-run scan.
const SettingsDialog = later(() => import("./settings").then((dialog) => dialog.SettingsDialog));
const SearchPalette = later(() => import("./search").then((dialog) => dialog.SearchPalette));
const FirstScan = later(() => import("./first-scan").then((dialog) => dialog.FirstScan));

const SCREENS: Record<Route["screen"], { loaded(): boolean } | null> = {
  home: null,
  tasks: TasksScreen,
  task: TaskScreen,
  exam: ExamScreen,
  course: CourseScreen,
  schedule: ScheduleScreen,
  presence: PresenceScreen,
  grades: GradesScreen,
  plan: PlanScreen,
};
/** Beranda comes with the window; any other screen once its code is in. */
const drawsAtOnce = (route: Route) => SCREENS[route.screen]?.loaded() ?? true;

/** `arriving`: it comes in from the welcome screen, so it eases in that once (the first run, docs/design-system.md). */
export function Shell({ arriving = false }: { arriving?: boolean }) {
  // No PDF from the last screen is left open over the next one (a search result, a notification, ⌘[); with
  // filling not saved, the screen waits for the Student's answer.
  const pdf = usePdfViewer();
  return (
    <NavProvider leave={pdf.close} drawsAtOnce={drawsAtOnce}>
      <Layout arriving={arriving} />
    </NavProvider>
  );
}

function Layout({ arriving }: { arriving: boolean }) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const bridge = useBridge();
  const t = useT();
  const { route, go } = useNav();
  const main = useRef<HTMLElement>(null);
  const settingsLoaded = SettingsDialog.useLoaded();
  const searchLoaded = SearchPalette.useLoaded();
  const scanLoaded = FirstScan.useLoaded();
  /** Search opens over anything else; the shortcut also closes it. */
  const openSearch = useCallback((toggle: boolean) => {
    setSettingsOpen(false);
    setScanOpen(false);
    setSearchOpen((open) => !(toggle && open));
  }, []);
  useNavigateRequests(go);
  // The other system came along on the Student's sign-in: worth a word, not a dialog.
  useJoined(useCallback((source) => toast(t("signIn.joined", { source: t(`source.${source}`) }), "success"), [t]));
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
    }, []),
  );
  // A new screen starts at its top.
  const key = JSON.stringify(route);
  // biome-ignore lint/correctness/useExhaustiveDependencies: key is the route; it changing is what scrolls back to the top
  useEffect(() => {
    if (main.current) main.current.scrollTop = 0;
  }, [key]);

  return (
    <div className={cx("flex h-dvh overflow-hidden bg-canvas text-fg", arriving && ARRIVE_APP)}>
      <PanelBoundary name="sidebar" compact>
        <Sidebar onSettings={() => setSettingsOpen(true)} />
      </PanelBoundary>
      <div className="flex min-w-0 flex-1 flex-col">
        <PanelBoundary name="top bar" compact>
          <TopBar onSearch={() => openSearch(false)} />
          <ProblemBanner />
        </PanelBoundary>
        <main ref={main} className="min-h-0 flex-1 overflow-y-auto">
          {/* Outside the screen's own guard, so the screen before stays while the next one's code loads. */}
          <Suspense fallback={null}>
            <PanelBoundary key={key} name={route.screen}>
              <CurrentScreen route={route} />
            </PanelBoundary>
          </Suspense>
        </main>
      </div>
      {/* Each waits for its code (in at once after the idle preload) or for the Student to open it, then opens.
          Its own guard keeps a failed load to that dialog, with "Coba lagi", never the whole window. */}
      <PanelBoundary name="settings" compact>
        <Suspense fallback={null}>
          {(settingsOpen || settingsLoaded) && (
            <SettingsDialog
              open={settingsOpen}
              onOpenChange={setSettingsOpen}
              onShowFirstScan={() => {
                setSettingsOpen(false);
                setScanOpen(true);
              }}
            />
          )}
        </Suspense>
      </PanelBoundary>
      <PanelBoundary name="search" compact>
        <Suspense fallback={null}>
          {(searchOpen || searchLoaded) && <SearchPalette open={searchOpen} onOpenChange={setSearchOpen} onSettings={() => setSettingsOpen(true)} />}
        </Suspense>
      </PanelBoundary>
      <PanelBoundary name="first scan" compact>
        <Suspense fallback={null}>
          {/* It also watches for the first full sync to open itself, so it stays drawn once in. */}
          {(scanOpen || scanLoaded) && <FirstScan open={scanOpen} onOpenChange={setScanOpen} blocked={settingsOpen || searchOpen} />}
        </Suspense>
      </PanelBoundary>
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
  badge: BadgeValue;
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
  const courseReady = isBuilt({ screen: "course", code: "" });
  const items: NavItem[] = [
    { screen: "home", label: "nav.home", Icon: Icons.Home, badge: null },
    { screen: "tasks", label: "nav.tasks", Icon: Icons.ListChecks, badge: useTasksBadge(), owns: ["task", "exam"] },
    { screen: "schedule", label: "nav.schedule", Icon: Icons.Calendar, badge: null },
    { screen: "presence", label: "nav.presence", Icon: Icons.Hand, badge: usePresenceBadge() },
    { screen: "grades", label: "nav.grades", Icon: Icons.GraduationCap, badge: null },
    { screen: "plan", label: "nav.plan", Icon: Icons.BookOpen, badge: usePlanBadge() },
  ];

  return (
    <aside className="flex h-full w-[248px] shrink-0 flex-col border-r border-line bg-sidebar select-none">
      {store.platform === "darwin" && <div className="drag h-10 shrink-0" />}
      {/* The app's own name, under the traffic lights on macOS, level with the top bar elsewhere (clear of window buttons some Linux desktops put at the left). It moves the window. */}
      <div
        className={cx(
          "drag flex shrink-0 items-center gap-2.5 pr-5",
          store.platform === "darwin" ? "h-11 pl-5" : "h-(--title-bar) pl-[calc(--spacing(5)+var(--window-controls-start))]",
        )}
      >
        <AppMark className="size-5" />
        <span className="text-body font-semibold tracking-[-0.01em]">Edunex Plus</span>
      </div>

      <nav aria-label={t("nav.menu")} className="space-y-0.5 px-3">
        {items
          .filter((item) => isBuilt({ screen: item.screen } as Route))
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
    // It moves the window, and keeps clear of Windows' window buttons at its right end.
    <header className="drag flex h-(--title-bar) shrink-0 items-center gap-3 border-b border-line pr-[calc(--spacing(5)+var(--window-controls))] pl-5 select-none">
      {detail && canGoBack && (
        <Tooltip content={factsLabel(t("action.back"), store.platform === "darwin" ? "⌘[" : "Ctrl+[")}>
          <Button
            variant="ghost"
            size="sm"
            aria-label={t("action.backTo", { place: backLabel })}
            className="no-drag -ml-1.5 max-w-[280px] min-w-0 shrink text-small"
            icon={<Icons.ChevronLeft className="size-4 shrink-0" />}
            onClick={back}
          >
            <span className="truncate">{backLabel}</span>
          </Button>
        </Tooltip>
      )}
      {/* In a narrow window the search field gives up room first, then the back button's label. */}
      <div className="no-drag ml-auto flex min-w-0 shrink-[8] items-center gap-1">
        <SearchButton onOpen={onSearch} />
        <AlertsBell />
        <SyncStatus />
      </div>
    </header>
  );
}
