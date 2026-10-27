// The signed-in window: sidebar, top bar and the current screen, each inside
// its own crash guard. Settings opens over it (sidebar footer, or ⌘,), quick
// search too (the top bar, or ⌘K). After a new Student's first sign-in the
// guide offers a tour of it, and once, after the first full sync, the
// first-run scan opens. A screen shows in the sidebar once it's built (./built.ts).
// Beranda comes with the window; every other screen loads after it (../later.tsx).
import {
  Component,
  type ComponentType,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { edunexCourseUrl, sixStatusUrl } from "../../core/links";
import { guideDue } from "../../core/models";
import type { StringKey } from "../../core/strings";
import { CourseColorPicker } from "../course-color-picker";
import { useRememberCourseColors } from "../course-colors";
import { type TermCourse, useTermCourses } from "../courses";
import { useOpenExternal } from "../hooks";
import { useT } from "../i18n";
import { later } from "../later";
import { displayName, initials } from "../names";
import { NavProvider, type Route, useNav } from "../nav";
import { usePdfViewer } from "../pdf";
import { useReportAsk } from "../report";
import { Home } from "../screens/home";
import { useBridge, useCommand, useDataset, useJoined, useNavigateRequests, useSettings, useStore } from "../store";
import { AppMark } from "../ui/brand";
import { Button, IconButton } from "../ui/controls";
import { cx } from "../ui/cx";
import { Badge, CourseDot } from "../ui/display";
import { type IconProps, Icons } from "../ui/icons";
import { factsLabel } from "../ui/layout";
import { Tooltip, toast } from "../ui/overlays";
import { PanelBoundary } from "../ui/panel-boundary";
import { windowError } from "../window-errors";
import { AlertsBell, openAlerts } from "./alerts";
import { type Badge as BadgeValue, usePlanBadge, usePresenceBadge, useTasksBadge } from "./badges";
import { isBuilt } from "./built";
import { ReportAskCard } from "./report-ask";
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
// What opens over the screen: Settings, quick search, the guide, the first-run scan and "Laporkan masalah".
const SettingsDialog = later(() => import("./settings").then((dialog) => dialog.SettingsDialog));
const SearchPalette = later(() => import("./search").then((dialog) => dialog.SearchPalette));
const Guide = later(() => import("./guide").then((guide) => guide.Guide));
const FirstScan = later(() => import("./first-scan").then((dialog) => dialog.FirstScan));
const ReportDialog = later(() => import("./report-dialog").then((dialog) => dialog.ReportDialog));

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

/** `arriving`: it is still the welcome screen's preview of the app, so the first-run scan waits for it to open. */
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
  /** Where Settings opens: at its top, or at a group the Student asked for (the sidebar's course colors button). */
  const [settingsAt, setSettingsAt] = useState<"courseColors" | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const bridge = useBridge();
  const t = useT();
  // The guide (./guide.tsx): it offers itself once the app has opened after a new Student's first sign-in (not in the
  // welcome's preview of it), and Settings starts its tour. Ended, it's remembered, and it doesn't offer itself again.
  // Each start is a new tour (`run`), from its first part, even over one still running.
  const due = guideDue(useSettings()) && !arriving;
  const [guide, setGuide] = useState<{ start: "offer" | "tour"; run: number } | null>(null);
  const [offered, setOffered] = useState(false);
  if (due && !offered) {
    setOffered(true);
    setGuide({ start: "offer", run: 0 });
  }
  const endGuide = (finished: boolean) => {
    if (guide?.start === "offer" && !finished) toast(t("guide.later"));
    setGuide(null);
    if (due) void bridge.invoke("settings.update", { guideDone: true }).catch(() => undefined);
    // The keyboard carries on from the top of the screen it ends on, once the guide has let go of it, unless something
    // else has it by then (a dialog the tour ended under).
    setTimeout(() => {
      if (document.activeElement && document.activeElement !== document.body) return;
      const title = main.current?.querySelector<HTMLElement>("h1");
      if (!title) return;
      title.tabIndex = -1;
      title.focus({ preventScroll: true });
    });
  };
  const { route, place, go } = useNav();
  const pdf = usePdfViewer();
  const main = useRef<HTMLElement>(null);
  const settingsLoaded = SettingsDialog.useLoaded();
  const searchLoaded = SearchPalette.useLoaded();
  const scanLoaded = FirstScan.useLoaded();
  const reportLoaded = ReportDialog.useLoaded();
  // "Laporkan masalah" opens over everything else, about what the Student was looking at.
  const reportAsk = useReportAsk();
  const [reportOpen, setReportOpen] = useState(false);
  const [reportShown, setReportShown] = useState(reportAsk);
  if (reportAsk !== reportShown) {
    setReportShown(reportAsk);
    if (reportAsk) {
      setSettingsOpen(false);
      setSearchOpen(false);
      setReportOpen(true);
    }
  }
  /** Settings at its top, or at a group (the sidebar's course colors button): every way in says which, so none inherits the last. */
  const openSettings = useCallback((at: "courseColors" | null = null) => {
    setSettingsAt(at);
    setSettingsOpen(true);
  }, []);
  /** Search opens over anything else; the shortcut also closes it. */
  const openSearch = useCallback((toggle: boolean) => {
    setSettingsOpen(false);
    setScanOpen(false);
    setSearchOpen((open) => !(toggle && open));
  }, []);
  useNavigateRequests(go);
  // The other system came along on the Student's sign-in: worth a word, not a dialog.
  useJoined(useCallback((source) => toast(t("signIn.joined", { source: t(`source.${source}`) }), "success"), [t]));
  // While it is still the welcome's preview, its shortcuts and the menu's commands wait: Settings or Search opened
  // there would float over the welcome screen, out of its reach.
  useSearchShortcut(
    useCallback(() => {
      if (!arriving) openSearch(true);
    }, [arriving, openSearch]),
  );
  useCommand(
    useCallback(
      (command) => {
        if (arriving) return;
        if (command === "settings") openSettings();
        if (command === "refresh") void refreshNow(bridge);
        if (command === "search") openSearch(false);
        if (command === "alerts") openAlerts();
      },
      [arriving, bridge, openSearch, openSettings],
    ),
  );
  useRefreshWhenBackOnline();
  useNavShortcuts(
    useCallback(() => {
      setSettingsOpen(false);
      setSearchOpen(false);
      setScanOpen(false);
    }, []),
    // The guide opens each place itself while it runs.
    arriving || guide !== null,
  );
  useScrollPlace(main);

  return (
    <div className="flex h-dvh overflow-hidden bg-canvas text-fg">
      <PanelBoundary name="sidebar" compact>
        <Sidebar onSettings={openSettings} />
      </PanelBoundary>
      <div className="flex min-w-0 flex-1 flex-col">
        <PanelBoundary name="top bar" compact>
          <TopBar onSearch={() => openSearch(false)} />
          {/* A live region that is always there, so a banner arriving in it is read out. */}
          <div role="status" className="shrink-0">
            <ProblemBanner />
          </div>
        </PanelBoundary>
        <main ref={main} className="min-h-0 flex-1 overflow-y-auto">
          {/* Outside the screen's own guard, so the screen before stays while the next one's code loads. */}
          <Suspense fallback={null}>
            {/* Keyed by its place in history: a tab picked on it (nav.replace) keeps it drawn, with its scroll and focus. */}
            <PanelBoundary key={place} name={route.screen}>
              <CurrentScreen route={route} />
              <TitleTakesFocus main={main} />
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
              startAt={settingsAt}
              onShowFirstScan={() => {
                setSettingsOpen(false);
                setScanOpen(true);
              }}
              onShowGuide={() => {
                setSettingsOpen(false);
                // A PDF open over the screen closes first (with filling not saved, the Student says whether to drop it,
                // and keeping it starts no tour): the tour then opens each place with nothing over it.
                pdf.close(() => setGuide((last) => ({ start: "tour", run: (last?.run ?? 0) + 1 })));
              }}
            />
          )}
        </Suspense>
      </PanelBoundary>
      <PanelBoundary name="search" compact>
        <Suspense fallback={null}>
          {(searchOpen || searchLoaded) && <SearchPalette open={searchOpen} onOpenChange={setSearchOpen} onSettings={() => openSettings()} />}
        </Suspense>
      </PanelBoundary>
      <PanelBoundary name="report" compact>
        <Suspense fallback={null}>{(reportOpen || reportLoaded) && <ReportDialog ask={reportShown} open={reportOpen} onOpenChange={setReportOpen} />}</Suspense>
      </PanelBoundary>
      <PanelBoundary name="report question" compact>
        <ReportAskCard />
      </PanelBoundary>
      {guide && (
        <GuideGuard key={guide.run} onBreak={() => endGuide(false)}>
          <Suspense fallback={null}>
            {/* It steps aside while a dialog is open, and comes back where it was. */}
            <Guide start={guide.start} hidden={settingsOpen || searchOpen || reportOpen || scanOpen} onEnd={endGuide} />
          </Suspense>
        </GuideGuard>
      )}
      <PanelBoundary name="first scan" compact>
        <Suspense fallback={null}>
          {/* It also watches for the first full sync to open itself, so it stays drawn once in. It waits for the guide. */}
          {(scanOpen || scanLoaded) && (
            <FirstScan open={scanOpen} onOpenChange={setScanOpen} blocked={settingsOpen || searchOpen || reportOpen || arriving || guide !== null} />
          )}
        </Suspense>
      </PanelBoundary>
    </div>
  );
}

/**
 * The guide breaking (its code didn't come in, or a fault in it) ends it, as if skipped: the window never stays held
 * for a tour that isn't there (the place shortcuts off, the first-run scan waiting).
 */
class GuideGuard extends Component<{ onBreak: () => void; children: ReactNode }, { broken: boolean }> {
  state = { broken: false };
  static getDerivedStateFromError() {
    return { broken: true };
  }
  componentDidCatch(error: unknown) {
    console.error("[guide]", error);
    windowError("panel", error, "guide");
    this.props.onBreak();
  }
  render() {
    return this.state.broken ? null : this.props.children;
  }
}

const SCROLLED = "shell.scrolled";

/**
 * A new screen starts at its top; one come back to with Back, where the Student left it. The scroll is kept
 * in its place in history as it scrolls (read once the next screen is in, it would be cut to that one's
 * height). Set before the window draws, so it never shows the wrong part first.
 */
function useScrollPlace(main: RefObject<HTMLElement | null>) {
  const { kept, returned } = useNav();
  const here = useRef(kept);
  useLayoutEffect(() => {
    const el = main.current;
    if (!el) return;
    const note = () => here.current.set(SCROLLED, el.scrollTop);
    el.addEventListener("scroll", note, { passive: true });
    return () => el.removeEventListener("scroll", note);
  }, [main]);
  // A new place, or the one Back came back to; a tab picked on it (nav.replace) keeps both, and the scroll.
  useLayoutEffect(() => {
    here.current = kept;
    if (main.current) main.current.scrollTop = returned ? ((kept.get(SCROLLED) as number | undefined) ?? 0) : 0;
  }, [main, kept, returned]);
}

/**
 * When the screen that left took focus with it (the row that opened this one, Back, a ⌘ shortcut from
 * the page), the new screen's title takes it, so the keyboard and a screen reader carry on from the top
 * of what's shown instead of from the window's start. So does Back, even where it stays in the top bar.
 * Focus the Student put somewhere else that's still there (the sidebar) stays.
 * Inside the screen's own guard, so it runs once the screen has drawn, not while its code still loads.
 */
function TitleTakesFocus({ main }: { main: RefObject<HTMLElement | null> }) {
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const at = document.activeElement;
      // Back stays in the top bar between two detail screens, and pressing it still hands focus to the screen it opened.
      if (at && at !== document.body && !(at instanceof HTMLElement && at.dataset.back !== undefined)) return;
      const title = main.current?.querySelector<HTMLElement>("h1");
      if (!title) return;
      title.tabIndex = -1;
      // Where the screen is scrolled to stays (Back brings it back where it was).
      title.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [main]);
  return null;
}

function CurrentScreen({ route }: { route: Route }) {
  switch (route.screen) {
    case "home":
      return <Home />;
    case "tasks":
      return <TasksScreen show={route.show} />;
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

/**
 * ⌘1 to ⌘6 open the six places in the sidebar (Ctrl elsewhere); ⌘[ goes back. Either closes what's open over the screen
 * first. The mouse's back button goes back too. None of them works while `off` (the welcome's preview, the guide).
 */
function useNavShortcuts(closeOverlays: () => void, off: boolean) {
  const store = useStore();
  const { go, back } = useNav();
  useEffect(() => {
    if (off) return;
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
      go({ screen: NAV_ORDER[index] } as Route, { keep: true });
    };
    const onMouse = (event: MouseEvent) => {
      if (event.button === 3) back();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mouseup", onMouse);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mouseup", onMouse);
    };
  }, [store, go, back, closeOverlays, off]);
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

function Sidebar({ onSettings }: { onSettings: (at?: "courseColors" | null) => void }) {
  const store = useStore();
  const t = useT();
  const { route, go } = useNav();
  const account = useDataset("edunex.account");
  const student = useDataset("six.student");
  const update = useDataset("app.update");
  const courses = useTermCourses();
  // Each course's automatic color, remembered the first time it shows, so it never moves by itself.
  useRememberCourseColors(courses?.map((course) => course.code));
  // A course's color picker, from a right-click on its row (or Shift+F10, or the context-menu key): it hangs from the
  // row, as a click on the row opens the course. `open` false: it's on its way out, still naming its course.
  const [picker, setPicker] = useState<{ code: string; open: boolean } | null>(null);
  const rows = useRef(new Map<string, HTMLButtonElement>());
  const anchor = useRef<HTMLElement | null>(null);
  const pickColor = (code: string) => {
    anchor.current = rows.current.get(code) ?? null;
    setPicker({ code, open: true });
  };
  const contextKey = (code: string) => (event: KeyboardEvent) => {
    if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
    event.preventDefault();
    pickColor(code);
  };
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
    // Zoomed in far enough that the window is under 52rem wide (from 120% on the smallest window; never at 100%), the
    // sidebar folds to a rail of its icons, course dots and counts: the words stay as the controls' names and in their
    // tooltips, and the rail scrolls, so the screen keeps its room and nothing falls off the window.
    <aside className="flex h-full w-[248px] shrink-0 flex-col border-r border-line bg-sidebar select-none max-[52rem]:w-18 max-[52rem]:overflow-x-hidden max-[52rem]:overflow-y-auto">
      {store.platform === "darwin" && <div className="drag h-10 shrink-0" />}
      {/* The app's own name, under the traffic lights on macOS, level with the top bar elsewhere (clear of window buttons some Linux desktops put at the left). It moves the window. */}
      <div
        data-guide="intro"
        className={cx(
          "drag flex shrink-0 items-center gap-2.5 pr-5 max-[52rem]:justify-center max-[52rem]:pr-0",
          store.platform === "darwin"
            ? "h-11 pl-5 max-[52rem]:pl-0"
            : "h-(--title-bar) pl-[calc(--spacing(5)+var(--window-controls-start))] max-[52rem]:pl-(--window-controls-start)",
        )}
      >
        <AppMark className="size-5" />
        <span className="text-body font-semibold tracking-[-0.01em] max-[52rem]:sr-only">Edunex Plus</span>
      </div>

      <nav aria-label={t("nav.menu")} data-guide="nav" className="space-y-0.5 px-3">
        {items
          .filter((item) => isBuilt({ screen: item.screen } as Route))
          .map(({ screen, label, Icon, badge, owns }, index) => {
            const active = route.screen === screen || (owns ?? []).includes(route.screen);
            return (
              <Tooltip key={screen} side="right" content={factsLabel(t(label), `${store.platform === "darwin" ? "⌘" : "Ctrl+"}${index + 1}`)}>
                <button
                  type="button"
                  aria-current={active ? "page" : undefined}
                  onClick={() => go({ screen } as Route, { keep: true })}
                  className={cx(
                    "focus-ring relative flex h-[34px] w-full items-center gap-2.5 rounded-lg px-2.5 text-body max-[52rem]:justify-center max-[52rem]:px-0",
                    active ? "bg-selected font-semibold" : "font-medium text-fg/90 hover:bg-hover",
                  )}
                >
                  <Icon className={cx("size-[17px] shrink-0", active ? "text-accent-fg" : "text-muted")} weight={active ? "fill" : "regular"} />
                  <span className="flex-1 truncate text-left max-[52rem]:sr-only">{t(label)}</span>
                  {badge && <NavBadge badge={badge} />}
                </button>
              </Tooltip>
            );
          })}
      </nav>

      <div className="mt-6 min-h-0 flex-1 overflow-y-auto px-3 max-[52rem]:shrink-0 max-[52rem]:basis-auto max-[52rem]:overflow-visible">
        {courses && courses.length > 0 && (
          <>
            <div className="mb-1 flex items-center justify-between pr-1 pl-2.5 max-[52rem]:sr-only">
              <p className="text-caption font-semibold text-faint">{t("nav.courses")}</p>
              {/* The visible way to the colors (a Mac has no context-menu key): Settings' list of them. Not in the rail,
                  where this heading is only read out and the button would be a tab stop nobody sees. */}
              <Tooltip content={t("nav.courseColors")} side="right">
                <IconButton label={t("nav.courseColors")} size="sm" onClick={() => onSettings("courseColors")} className="size-6 text-faint max-[52rem]:hidden">
                  <Icons.Palette className="size-3.5" />
                </IconButton>
              </Tooltip>
            </div>
            <ul data-guide="courses" className="space-y-0.5">
              {courses.map((course) => {
                const active = route.screen === "course" && route.code === course.code;
                const site = courseReady ? null : outside(course);
                const picking = picker?.open === true && picker.code === course.code;
                return (
                  <li key={course.code}>
                    {/* Its whole name on hover and focus (cut short here, and only a dot in the rail); where it opens, until the course page is built. */}
                    <Tooltip content={factsLabel(course.code, course.name, site?.label)} side="right" hidden={picking}>
                      <button
                        ref={(button) => {
                          if (button) rows.current.set(course.code, button);
                          else rows.current.delete(course.code);
                        }}
                        type="button"
                        aria-current={active ? "page" : undefined}
                        onClick={() => (courseReady ? go({ screen: "course", code: course.code }, { keep: true }) : site && open(site.url))}
                        onContextMenu={(event) => {
                          event.preventDefault();
                          pickColor(course.code);
                        }}
                        onKeyDown={contextKey(course.code)}
                        className={cx(
                          "focus-ring flex h-[34px] w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-body max-[52rem]:h-[42px] max-[52rem]:flex-col max-[52rem]:justify-center max-[52rem]:gap-1 max-[52rem]:px-0",
                          active || picking ? "bg-selected" : "hover:bg-hover",
                        )}
                      >
                        <CourseDot color={course.color} />
                        {/* In the rail, the code under the dot: the color is never the only way to tell the courses apart. */}
                        <span className={cx("shrink-0 tabular-nums max-[52rem]:text-micro", active ? "font-semibold" : "font-medium")}>{course.code}</span>
                        <span className="truncate text-small text-muted max-[52rem]:sr-only">{course.name}</span>
                      </button>
                    </Tooltip>
                  </li>
                );
              })}
            </ul>
            {picker && (
              // One per course: a right-click on another row while this one is still on its way out starts afresh.
              <CourseColorPicker
                key={picker.code}
                code={picker.code}
                open={picker.open}
                onOpenChange={(next) => setPicker({ code: picker.code, open: next })}
                anchor={anchor}
                side="right"
              />
            )}
          </>
        )}
      </div>

      <div className="border-t border-line px-2 py-2">
        <Tooltip side="right" content={factsLabel(t("nav.settings"), store.platform === "darwin" ? "⌘," : "Ctrl+,")}>
          <button
            type="button"
            data-guide="settings"
            onClick={() => onSettings()}
            className="focus-ring flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-hover max-[52rem]:h-9 max-[52rem]:justify-center max-[52rem]:py-0"
          >
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-info-bg text-micro font-bold text-info-fg max-[52rem]:hidden">
              {account ? initials(account.name) : <Icons.User className="size-3.5" />}
            </span>
            <span className="min-w-0 max-[52rem]:sr-only">
              <span className="block truncate text-small font-semibold">{account ? displayName(account.name) : t("nav.settings")}</span>
              <span className="block truncate text-caption text-faint">{account ? t("nav.settings") : (student?.nim ?? "")}</span>
            </span>
            <span className="relative ml-auto shrink-0 max-[52rem]:ml-0">
              <Icons.Settings className="size-4 text-faint" />
              {update && (
                <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-accent ring-2 ring-sidebar">
                  <span className="sr-only">{t("update.available")}</span>
                </span>
              )}
            </span>
          </button>
        </Tooltip>
      </div>
    </aside>
  );
}

/**
 * A place's count in the sidebar: grey says how many, amber that one needs the Student today. Amber also carries a
 * warning mark, and says so to a screen reader ("Presensi 3, Perlu perhatianmu"), so color isn't the only signal.
 * In the rail it sits on the icon's corner.
 */
function NavBadge({ badge }: { badge: NonNullable<BadgeValue> }) {
  const t = useT();
  const warning = badge.tone === "warning";
  return (
    <Badge tone={warning ? "warning" : "neutral"} className="gap-0.5 max-[52rem]:absolute max-[52rem]:-top-0.5 max-[52rem]:left-1/2 max-[52rem]:ml-0.5">
      {warning && <Icons.AlertTriangle className="size-2.5 shrink-0" weight="bold" />}
      {badge.value}
      {warning && <span className="sr-only">{`, ${t("home.needs")}`}</span>}
    </Badge>
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
            data-back=""
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
