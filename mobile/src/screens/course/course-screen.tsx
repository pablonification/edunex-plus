// The course page on the phone (S17, src/app/screens/course.tsx; round 2's v4): one course, its parent and child
// Edunex classes merged, on v4's grey page. Its one title is its name, big at the top beside its tile (the course's ink
// and tint) with its code under it, collapsing into the top bar on scroll. Under it one white card led by the share
// attended, with what's left of the absences and the next class in one row (W4), and the one exception in a few words;
// then, while a class is on, its card with the one thing to do. A tap on the name or the card opens the course's sheet
// (./course-sheet.tsx: lecturer, SKS, the attendance in full, the target, what a course in trouble means now). Then its
// tabs as pills, staying under the bar while the page scrolls: Modul (a list; a module opens as its own screen,
// ./module-screen.tsx), Pertemuan, Tugas, Nilai and Pengumuman. The rare actions sit behind ⋮ in the top bar: saving
// its files for offline, its colour, its pages on Edunex and SIX. Pull to refresh.

import { router } from "expo-router";
import { type ComponentRef, type ReactNode, useEffect, useRef, useState } from "react";
import { type LayoutChangeEvent, ScrollView, View } from "react-native";
import { useOpenExternal } from "../../../../src/app/hooks";
import { type StringKey, useFormat, useT } from "../../../../src/app/i18n";
import { useTodo } from "../../../../src/app/schedule-data";
import { type CoursePage, useCoursePage } from "../../../../src/app/screens/course/data";
import { useDataset, useStatus } from "../../../../src/app/store";
import { edunexCourseUrl, sixTimetableUrl } from "../../../../src/core/links";
import { todoCount, todoForCourse } from "../../../../src/core/todo";
import { hrefOf, useNav } from "../../nav";
import { CourseColorSheet, colorName } from "../../parts/course-color-picker";
import { usePerfDrawn } from "../../perf";
import { usePullToRefresh, useRefresh } from "../../shell/source-status";
import { BigButton } from "../../ui/big-button";
import { CourseDot, EmptyState, Skeleton } from "../../ui/display";
import { EdgeFade, useEdges } from "../../ui/edge-fade";
import { Rise } from "../../ui/expressive";
import { Icons } from "../../ui/icons";
import { factsLabel, Page } from "../../ui/layout";
import { OverflowMenu } from "../../ui/menu";
import { PressScale } from "../../ui/press";
import type { SheetChoice } from "../../ui/sheet";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { CourseTile } from "../../ui/tile";
import { TopBar } from "../../ui/top-bar";
import { useRowContext } from "../presence/presence-screen";
import { AttendanceCard, nextClassParts } from "./attendance-line";
import { CourseSheet } from "./course-sheet";
import { GradesTab } from "./grades";
import { AnnouncementsTab, TasksTab } from "./lists";
import { MeetingsTab } from "./meetings";
import { ModulesTab } from "./modules";
import { MeetingNow } from "./now";
import { SaveOfflineProgress, useSaveOfflineChoice } from "./save-offline";

const TABS = ["modules", "meetings", "tasks", "grades", "announcements"] as const;
type Tab = (typeof TABS)[number];
/** The tabs' names: the desktop's, but "Tugas" alone, so five fit a phone's width better. */
const TAB_LABEL: Record<Tab, StringKey> = {
  modules: "course.tab.modules",
  meetings: "course.tab.meetings",
  tasks: "mobile.course.tab.tasks",
  grades: "course.tab.grades",
  announcements: "course.tab.announcements",
};

/**
 * `tab`: the tab shown, kept in the route (useNav().replace) as the Student picks it, so a link, an alert or a Task's
 * way up opens the same place.
 */
export function CourseScreen({ code, tab }: { code: string; tab?: string }) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const page = useCoursePage(code);
  const edunexState = useStatus("edunex").state;
  const edunexReading = edunexState === "connecting" || edunexState === "live";
  const todo = useTodo();
  const pull = usePullToRefresh();
  const { replace } = useNav();
  const [sheet, setSheet] = useState(false);
  // "Ubah target" from the exception: the target is changed in the course's sheet.
  const rows = useRowContext(() => setSheet(true));
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const [tabsAt, setTabsAt] = useState(0);
  // Where the page's own title ends (dp from the page's top): the top bar's title shows from there.
  const [titleBottom, setTitleBottom] = useState(120);
  const offset = useRef(0);
  const current: Tab = (TABS as readonly string[]).includes(tab ?? "") ? (tab as Tab) : "modules";
  usePerfDrawn(page !== undefined);
  // A tab tapped: its tab bar comes to the top, so what the tab holds is in view and not below the course's header.
  const pickTab = (next: Tab) => {
    replace({ screen: "course", code, tab: next });
    if (offset.current !== tabsAt) scroll.current?.scrollTo({ y: tabsAt, animated: offset.current < tabsAt });
  };
  // A module opens as its own screen, over the course: Back comes back to this list, where it was.
  const pickModule = (picked: number) => router.push(hrefOf({ screen: "course", code, module: picked }) as never);

  // Edunex's courses not read yet: placeholders while Edunex is being read, else why the page isn't here (signed out,
  // expired, failed), so a course seen only in SIX never shows placeholders for good.
  if (page === undefined)
    return edunexReading ? (
      <Loading />
    ) : (
      <Page testID="screen.course" background={theme.v4.page} header={<TopBar v4 title={t("nav.courses")} />}>
        <NotLoaded />
      </Page>
    );
  if (page === null)
    return (
      <Page testID="screen.course" background={theme.v4.page} header={<TopBar v4 title={t("nav.courses")} />}>
        <CourseMissing />
      </Page>
    );

  const loaded = page.materials !== undefined;
  // The course's "Belum selesai" on its tab: its Tasks and exams with a day still ahead, a take-home once.
  const open = todo ? todoCount(todoForCourse(todo.items, code)) : 0;
  const item = rows?.attendance.sixConnected ? rows.attendance.courses.find((c) => c.course.code === page.course.code) : undefined;
  const shownNext = item && rows ? nextClassParts(t, f, item, rows.context).start : null;
  const rise = `course:${page.course.code}`;

  let panel: ReactNode;
  if (current === "grades") panel = <GradesTab page={page} onOpenModules={() => pickTab("modules")} />;
  else if (!loaded) panel = <NotLoaded />;
  else if (current === "modules") panel = <ModulesTab page={page} onPick={pickModule} />;
  else if (current === "meetings") panel = <MeetingsTab page={page} />;
  else if (current === "tasks") panel = <TasksTab code={page.course.code} exams={page.exams} />;
  else panel = <AnnouncementsTab announcements={page.announcements} mainCourseId={page.course.edunex?.courseId ?? null} code={page.course.code} />;

  return (
    <Page
      testID="screen.course"
      background={theme.v4.page}
      header={<TopBar v4 title={page.course.name} titleFrom={titleBottom} actions={<MoreMenu page={page} />} />}
      scrollRef={scroll}
      // The tabs stay under the bar while a long tab scrolls.
      stickyHeaderIndices={[1]}
      onScroll={(event) => {
        offset.current = event.nativeEvent.contentOffset.y;
      }}
      scrollEventThrottle={64}
      {...pull}
    >
      <View>
        <Rise screen={rise} index={0}>
          <Header page={page} onOpen={() => setSheet(true)} onTitleEnd={(bottom) => setTitleBottom(space[4] + bottom + space[2])} />
        </Rise>
        {item && rows && (
          <Rise screen={rise} index={1} style={{ marginTop: space[5] }}>
            <AttendanceCard item={item} context={rows.context} onOpen={() => setSheet(true)} />
          </Rise>
        )}
        <MeetingNow page={page} shownNext={shownNext} card={item !== undefined} rise={rise} />
        <SaveOfflineProgress code={page.course.code} />
        <CourseSheet page={page} rows={rows} open={sheet} onClose={() => setSheet(false)} />
      </View>
      <View onLayout={(event: LayoutChangeEvent) => setTabsAt(event.nativeEvent.layout.y)} style={{ marginTop: space[4] }}>
        <TabBar
          value={current}
          onChange={pickTab}
          label={page.course.code}
          tabs={TABS.map((key) => ({ value: key, label: t(TAB_LABEL[key]), count: key === "tasks" && open > 0 ? open : undefined }))}
        />
      </View>
      <View style={{ paddingTop: space[3], minHeight: 480 }} testID={`panel.course.${current}`}>
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

/**
 * The page's one title: the course's tile and name in the display face, its code under it. A tap opens the course's
 * sheet (lecturer, SKS, attendance). `onTitleEnd`: where the block ends, for the bar's title to take over from there.
 */
function Header({ page, onOpen, onTitleEnd }: { page: CoursePage; onOpen: () => void; onTitleEnd: (bottom: number) => void }) {
  const t = useT();
  const v = useTheme().v4;
  const { course, outline } = page;
  const sks = course.sks ?? outline?.credits ?? null;
  const line = [course.code, sks !== null ? t("course.sks", { count: sks }) : null].filter(Boolean).join(" · ");
  return (
    <PressScale
      onPress={onOpen}
      accessibilityRole="header"
      accessibilityLabel={`${course.name}, ${line}`}
      accessibilityHint={t("mobile.course.aboutHint")}
      testID="action.courseAbout"
      style={{ flexDirection: "row", alignItems: "flex-start", gap: space[4] }}
    >
      <View
        onLayout={(event: LayoutChangeEvent) => onTitleEnd(event.nativeEvent.layout.y + event.nativeEvent.layout.height)}
        style={{ flexDirection: "row", gap: space[4], flex: 1 }}
      >
        <View style={{ paddingTop: 2 }}>
          <CourseTile code={course.code} name={course.name} size={48} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text size="headlineSmall" face="display" weight="bold" style={{ color: v.fg, fontSize: 24, lineHeight: 30, letterSpacing: -0.4 }}>
            {course.name}
          </Text>
          <Text size="bodyMedium" weight="medium" tabular style={{ color: v.muted, marginTop: space[1] }}>
            {line}
          </Text>
        </View>
      </View>
    </PressScale>
  );
}

/** ⋮: the rare actions. Its files for offline, the course's color, and its pages on Edunex and SIX. */
function MoreMenu({ page }: { page: CoursePage }) {
  const t = useT();
  const theme = useTheme();
  const open = useOpenExternal();
  const student = useDataset("six.student");
  const [picking, setPicking] = useState(false);
  const saveOffline = useSaveOfflineChoice(page);
  const { course } = page;
  const choices: SheetChoice[] = [
    ...(saveOffline ? [saveOffline] : []),
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
      <OverflowMenu label={t("course.more")} choices={choices} testID="action.courseMenu" />
      <CourseColorSheet code={course.code} open={picking} onClose={() => setPicking(false)} />
    </>
  );
}

/**
 * The tabs as pills on the page's grey, scrolling sideways; the picked one tonal in the brand's blue and brought into
 * view. Each pill gives on a press and is a full 48 dp to touch; Tugas carries how many are still open.
 */
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
  const v = useTheme().v4;
  const bar = useRef<ComponentRef<typeof ScrollView>>(null);
  const places = useRef(new Map<T, { x: number; width: number }>());
  const [width, setWidth] = useState(0);
  const fades = useEdges();
  useEffect(() => {
    const place = places.current.get(value);
    if (place && width) bar.current?.scrollTo({ x: Math.max(0, place.x + place.width / 2 - width / 2), animated: true });
  }, [value, width]);
  return (
    <View style={{ backgroundColor: v.page, marginHorizontal: -space.page }} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <ScrollView
        ref={bar}
        testID="tabs.course"
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="tablist"
        accessibilityLabel={label}
        onLayout={fades.onLayout}
        onContentSizeChange={fades.onContentSizeChange}
        onScroll={fades.onScroll}
        scrollEventThrottle={32}
        contentContainerStyle={{ paddingHorizontal: space.page, gap: space[2] }}
      >
        {tabs.map((tab) => {
          const on = tab.value === value;
          return (
            <PressScale
              key={tab.value}
              testID={`tab.course.${tab.value}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={tab.count !== undefined ? `${tab.label}, ${tab.count}` : tab.label}
              onPress={() => onChange(tab.value)}
              style={{ minHeight: 48, justifyContent: "center" }}
            >
              <View
                onLayout={(event) => places.current.set(tab.value, { x: event.nativeEvent.layout.x, width: event.nativeEvent.layout.width })}
                style={{
                  minHeight: 36,
                  borderRadius: 18,
                  paddingHorizontal: space[4],
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  backgroundColor: on ? v.brandTint : v.card,
                }}
              >
                <Text size="labelLarge" weight="semibold" numberOfLines={1} style={{ color: on ? v.brandInk : v.fg2 }}>
                  {tab.label}
                </Text>
                {tab.count !== undefined && (
                  <Text size="labelLarge" face="display" weight="bold" tabular style={{ color: on ? v.brandInk : v.muted }}>
                    {String(tab.count)}
                  </Text>
                )}
              </View>
            </PressScale>
          );
        })}
      </ScrollView>
      {fades.edges.left && <EdgeFade side="left" color={v.page} />}
      {fades.edges.right && <EdgeFade side="right" color={v.page} />}
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
          <Skeleton key={i} height={56} style={{ borderRadius: 16 }} />
        ))}
      </View>
    );
  return (
    <View>
      <EmptyState icon={<Icons.BookOpen size={20} color={theme.color.muted} />} title={t("course.unavailable")} />
      {status.state !== "expired" && status.state !== "signed-out" && (
        <BigButton variant="outline" onPress={busy ? undefined : () => void refresh("edunex")} testID="action.courseRetry">
          {t("action.tryAgain")}
        </BigButton>
      )}
    </View>
  );
}

function Loading() {
  const t = useT();
  const theme = useTheme();
  return (
    <Page testID="screen.course" background={theme.v4.page} header={<TopBar v4 title={t("nav.courses")} />}>
      <View accessibilityState={{ busy: true }}>
        <View style={{ flexDirection: "row", gap: space[4] }}>
          <Skeleton height={48} width={48} style={{ borderRadius: 15 }} />
          <View style={{ flex: 1, gap: space[2] }}>
            <Skeleton height={26} width="80%" />
            <Skeleton height={14} width="40%" />
          </View>
        </View>
        <Skeleton height={120} style={{ marginTop: space[5], borderRadius: 24 }} />
        <Skeleton height={36} style={{ marginTop: space[5], borderRadius: 18 }} />
      </View>
    </Page>
  );
}
