// The course page on the phone (S17, src/app/screens/course.tsx): one course, its parent and child
// Edunex classes merged. The header says what it is and where attendance stands; under it what is
// happening now or next (and, for a course at risk, what that means today); then its tabs, scrolling
// sideways and staying at the top while the page scrolls: Modul (a list that opens one module at a
// time), Pertemuan, Tugas & Ujian, Nilai and Pengumuman. The rare actions sit behind "⋯" in the top
// bar, as the desktop's: the course's color, and its pages on Edunex and SIX. Pull to refresh.
import { type ComponentRef, type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { type LayoutChangeEvent, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useAttendance } from "../../../../src/app/attendance";
import { useOpenExternal } from "../../../../src/app/hooks";
import { type StringKey, useT } from "../../../../src/app/i18n";
import { useTodo } from "../../../../src/app/schedule-data";
import { type CoursePage, useCoursePage } from "../../../../src/app/screens/course/data";
import { useDataset, useSettings, useStatus } from "../../../../src/app/store";
import { edunexCourseUrl, sixTimetableUrl } from "../../../../src/core/links";
import { todoCount, todoForCourse } from "../../../../src/core/todo";
import { useNav } from "../../nav";
import { AbsenceBudget, CourseTarget } from "../../parts/attendance";
import { CourseColorSheet, colorName } from "../../parts/course-color-picker";
import { usePullToRefresh, useRefresh } from "../../shell/source-status";
import { Button, IconButton } from "../../ui/controls";
import { CourseDot, EmptyState, Skeleton } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { factsLabel, Meta, Page, PageHeader } from "../../ui/layout";
import { ActionSheet, type SheetChoice } from "../../ui/sheet";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { TopBar } from "../../ui/top-bar";
import { GradesTab } from "./grades";
import { AnnouncementsTab, TasksTab } from "./lists";
import { MeetingsTab } from "./meetings";
import { ModulesTab } from "./modules";
import { MeetingNow, RiskStrip } from "./now";

const TABS = ["modules", "meetings", "tasks", "grades", "announcements"] as const;
type Tab = (typeof TABS)[number];

/**
 * `tab` and `module`: what the page shows, kept in the route (useNav().replace) as the Student picks
 * them, so a link, an alert or a Task's way up opens the same place.
 */
export function CourseScreen({ code, tab, module }: { code: string; tab?: string; module?: number }) {
  const t = useT();
  const page = useCoursePage(code);
  const todo = useTodo();
  const pull = usePullToRefresh();
  const { replace } = useNav();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [tabsAt, setTabsAt] = useState(0);
  const offset = useRef(0);
  const current: Tab = (TABS as readonly string[]).includes(tab ?? "") ? (tab as Tab) : "modules";
  const show = (next: { tab: Tab; module?: number }) => replace({ screen: "course", code, ...next });
  // Another tab, or a module opened or closed, while the tab bar is stuck at the top: its start comes into view under it.
  const toTop = () => {
    if (offset.current > tabsAt) scroll.current?.scrollTo({ y: tabsAt, animated: false });
  };
  const pickTab = (next: Tab) => {
    show({ tab: next, ...(module === undefined ? {} : { module }) });
    toTop();
  };
  const pickModule = (picked: number) => {
    show({ tab: "modules", module: picked });
    toTop();
  };
  const toList = useCallback(() => replace({ screen: "course", code, tab: "modules" }), [replace, code]);

  if (page === undefined) return <Loading />;
  if (page === null)
    return (
      <Page testID="screen.course" header={<TopBar />}>
        <CourseMissing />
      </Page>
    );

  const loaded = page.materials !== undefined;
  const counts: Partial<Record<Tab, number>> = {
    modules: page.outline?.modules.length,
    meetings: page.meetings.length,
    // The course's "Belum selesai": its Tasks and exams with a day still ahead, a take-home once.
    tasks: todo ? todoCount(todoForCourse(todo.items, code)) : undefined,
    announcements: page.announcements?.length || undefined,
  };

  let panel: ReactNode;
  if (current === "grades") panel = <GradesTab page={page} onOpenModules={() => pickTab("modules")} />;
  else if (!loaded) panel = <NotLoaded />;
  else if (current === "modules")
    panel = (
      <ModulesTab
        page={page}
        module={module}
        onPick={pickModule}
        onList={() => {
          toList();
          toTop();
        }}
      />
    );
  else if (current === "meetings") panel = <MeetingsTab page={page} />;
  else if (current === "tasks") panel = <TasksTab code={page.course.code} exams={page.exams} />;
  else panel = <AnnouncementsTab announcements={page.announcements} mainCourseId={page.course.edunex?.courseId ?? null} code={page.course.code} />;

  return (
    <Page
      testID="screen.course"
      header={<TopBar actions={<MoreMenu page={page} />} />}
      scrollRef={scroll}
      // The tab bar stays at the top while a long tab scrolls.
      stickyHeaderIndices={[1]}
      onScroll={(event) => {
        offset.current = event.nativeEvent.contentOffset.y;
      }}
      scrollEventThrottle={64}
      {...pull}
    >
      <View>
        <Header page={page} />
        <RiskStrip page={page} />
        <MeetingNow page={page} />
      </View>
      <View onLayout={(event: LayoutChangeEvent) => setTabsAt(event.nativeEvent.layout.y)}>
        <TabBar
          value={current}
          onChange={pickTab}
          label={page.course.code}
          tabs={TABS.map((key) => ({ value: key, label: t(`course.tab.${key}` as StringKey), count: counts[key] }))}
        />
      </View>
      <View style={{ paddingTop: space[5], minHeight: 480 }} testID={`panel.course.${current}`}>
        {panel}
      </View>
    </Page>
  );
}

function CourseMissing() {
  const t = useT();
  const theme = useTheme();
  return <EmptyState icon={<Icons.BookOpen size={20} color={theme.color.muted} />} title={t("course.notFound")} />;
}

function Header({ page }: { page: CoursePage }) {
  const t = useT();
  const theme = useTheme();
  const { course, outline } = page;
  const sks = course.sks ?? outline?.credits ?? null;
  // The course's color picker hangs from its dot and code, as on the desktop; also in "⋯".
  const [picking, setPicking] = useState(false);
  return (
    <View>
      <PageHeader
        eyebrow={
          <Pressable
            testID="action.courseColor"
            accessibilityRole="button"
            accessibilityLabel={t("courseColor.current", { code: course.code, color: colorName(t, course.colorId) })}
            accessibilityHint={t("courseColor.change")}
            onPress={() => setPicking(true)}
            hitSlop={8}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start" }}
          >
            <CourseDot color={course.color} size={10} />
            <Text size="small" weight="semibold" tabular>
              {course.code}
            </Text>
            <Icons.ChevronDown size={12} color={theme.color.faint} />
          </Pressable>
        }
        title={course.name}
        description={
          <Meta size="small">
            {course.classNo ? t("course.class", { no: course.classNo }) : ""}
            {sks !== null ? t("course.sks", { count: sks }) : ""}
            {outline?.lecturer ? (
              <View
                key="lecturer"
                accessibilityLabel={`${t("course.lecturer")}: ${outline.lecturer}`}
                style={{ flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 }}
              >
                <Icons.User size={14} color={theme.color.muted} />
                <Text size="small" tone="muted" style={{ flexShrink: 1 }}>
                  {outline.lecturer}
                </Text>
              </View>
            ) : (
              ""
            )}
          </Meta>
        }
      />
      <AttendanceMeter page={page} />
      <CourseColorSheet code={course.code} open={picking} onClose={() => setPicking(false)} />
    </View>
  );
}

/**
 * The course's absences ("Jatah absen": the bar and "Terpakai 1× · sisa 1×"), SIX's count with its
 * share, and the target, a tap from changing it. It stays while the banner below shows.
 */
function AttendanceMeter({ page }: { page: CoursePage }) {
  const attendance = useAttendance();
  const { attendanceTargets } = useSettings();
  const health = attendance?.courses.find((c) => c.course.code === page.course.code)?.health;
  if (!health || !attendance?.sixConnected) return null;
  return (
    <View testID="meter.courseAttendance" style={{ marginTop: -space[2], marginBottom: space[5], gap: space[3], alignItems: "flex-start" }}>
      <AbsenceBudget health={health} place="header" own={Object.hasOwn(attendanceTargets, page.course.code)} soFar={attendance.period === null} />
      {health.held ? <CourseTarget code={page.course.code} /> : null}
    </View>
  );
}

/** "⋯": the rare actions. The course's color, and its pages on Edunex and SIX. */
function MoreMenu({ page }: { page: CoursePage }) {
  const t = useT();
  const theme = useTheme();
  const open = useOpenExternal();
  const student = useDataset("six.student");
  const [menu, setMenu] = useState(false);
  const [picking, setPicking] = useState(false);
  const { course } = page;
  const choices: SheetChoice[] = [
    {
      label: t("courseColor.change"),
      hint: factsLabel(colorName(t, course.colorId), t(course.colorPicked ? "courseColor.yours" : "courseColor.automatic")),
      icon: <CourseDot color={course.color} size={12} />,
      onPress: () => setPicking(true),
      testID: "action.courseMenu.color",
    },
  ];
  if (course.edunex) {
    const url = edunexCourseUrl(course.edunex.courseId);
    choices.push({
      label: t("course.openEdunex"),
      icon: <Icons.ArrowUpRight size={18} color={theme.color.muted} />,
      onPress: () => open(url),
      testID: "action.courseMenu.edunex",
    });
  }
  if (page.inSix && student)
    choices.push({
      label: t("course.openSix"),
      icon: <Icons.ArrowUpRight size={18} color={theme.color.muted} />,
      onPress: () => open(sixTimetableUrl(student)),
      testID: "action.courseMenu.six",
    });
  return (
    <>
      <IconButton label={t("course.more")} onPress={() => setMenu(true)} testID="action.courseMenu">
        <Icons.MoreHorizontal size={22} />
      </IconButton>
      <ActionSheet open={menu} onClose={() => setMenu(false)} title={course.code} choices={choices} testID="sheet.courseMenu" />
      <CourseColorSheet code={course.code} open={picking} onClose={() => setPicking(false)} />
    </>
  );
}

/** The tabs, with their counts, scrolling sideways; the picked one comes into view. */
function TabBar<T extends string>({
  value,
  onChange,
  label,
  tabs,
}: {
  value: T;
  onChange: (value: T) => void;
  label: string;
  tabs: readonly { value: T; label: string; count?: number }[];
}) {
  const theme = useTheme();
  const c = theme.color;
  const bar = useRef<ComponentRef<typeof ScrollView>>(null);
  const places = useRef(new Map<T, { x: number; width: number }>());
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const place = places.current.get(value);
    if (place && width) bar.current?.scrollTo({ x: Math.max(0, place.x + place.width / 2 - width / 2), animated: true });
  }, [value, width]);
  return (
    <View
      style={{ backgroundColor: c.canvas, marginHorizontal: -space.page, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.line }}
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
    >
      <ScrollView
        ref={bar}
        testID="tabs.course"
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="tablist"
        accessibilityLabel={label}
        contentContainerStyle={{ paddingHorizontal: space.page - space[2] }}
      >
        {tabs.map((tab) => {
          const on = tab.value === value;
          return (
            <Pressable
              key={tab.value}
              testID={`tab.course.${tab.value}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={tab.count !== undefined ? `${tab.label}, ${tab.count}` : tab.label}
              onPress={() => onChange(tab.value)}
              onLayout={(event) => places.current.set(tab.value, { x: event.nativeEvent.layout.x, width: event.nativeEvent.layout.width })}
              android_ripple={{ color: c.selected }}
              style={{ paddingHorizontal: space[2], minHeight: 48, justifyContent: "center" }}
            >
              <Text size="body" weight={on ? "semibold" : "medium"} tone={on ? "fg" : "muted"} numberOfLines={1}>
                {tab.label}
                {tab.count !== undefined && (
                  <Text size="small" weight="medium" tone="faint" tabular>
                    {`  ${tab.count}`}
                  </Text>
                )}
              </Text>
              <View
                style={{
                  position: "absolute",
                  left: space[2],
                  right: space[2],
                  bottom: 0,
                  height: 2,
                  borderRadius: 1,
                  backgroundColor: on ? c.fg : "transparent",
                }}
              />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** Edunex's part of the course isn't here yet: placeholders while it's on its way, else why it isn't. */
function NotLoaded() {
  const t = useT();
  const theme = useTheme();
  const status = useStatus("edunex");
  const { refresh, busy } = useRefresh();
  if (status.state === "connecting" || status.state === "live")
    return (
      <View accessibilityState={{ busy: true }} style={{ gap: space[2] }}>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} height={48} />
        ))}
      </View>
    );
  return (
    <EmptyState icon={<Icons.BookOpen size={20} color={theme.color.muted} />} title={t("course.unavailable")}>
      {status.state !== "expired" && status.state !== "signed-out" && (
        <Button size="sm" busy={busy} onPress={() => void refresh("edunex")}>
          {t("action.tryAgain")}
        </Button>
      )}
    </EmptyState>
  );
}

function Loading() {
  return (
    <Page testID="screen.course" header={<TopBar />}>
      <View accessibilityState={{ busy: true }}>
        <Skeleton height={12} width={64} />
        <Skeleton height={30} width="70%" style={{ marginTop: space[3] }} />
        <Skeleton height={12} width="40%" style={{ marginTop: space[3] }} />
        <Skeleton height={64} style={{ marginTop: space[8] }} />
        <Skeleton height={40} style={{ marginTop: space[8] }} />
      </View>
    </Page>
  );
}
