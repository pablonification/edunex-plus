// Materi (/material), behind Beranda's "Materi" tile: the way to a file, the way a student looks for one ("the slides
// for <course>, <module>"), as on Edunex: a course, its modules in the lecturer's order, the file. All on one screen:
// the term's courses are chips under the bar (the course's own glyph in its colour and its code; a dot when something
// came this week), the picked course's name under them, then every module of it, open, each a heading (its number, its
// title) over its material: the very rows a module's page has (../course/modules.tsx, MaterialRow), one tap to open.
// Nothing is sorted by date. The page opens on the course last picked (the first time: the one something was posted to
// last), at the module that course is on, marked "Minggu ini" or "Terbaru" as the course's own tab marks it; what's
// new says "Baru" on its row. A long module shows its first five and one row for the rest (./courses.ts).
// Only material is here: a module that just holds a Task is on Tugas. No new request: it reads what the app holds.
import { FlashList } from "@shopify/flash-list";
import { type ComponentRef, memo, useCallback, useMemo, useRef, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useTermCourses } from "../../../../src/app/courses";
import { useNow, useT } from "../../../../src/app/i18n";
import { useDataset, useStatus } from "../../../../src/app/store";
import { useNav } from "../../nav";
import { useArrivalId } from "../../parts/arrival";
import { usePerfDrawn } from "../../perf";
import { ProblemBanner, usePullToRefresh, useSignIn } from "../../shell/source-status";
import { BHeading, useB } from "../../ui/b";
import { Button, Chip } from "../../ui/controls";
import { EmptyState, Skeleton } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { useBottomInset } from "../../ui/insets";
import { factsLabel } from "../../ui/layout";
import { CrossFade } from "../../ui/moves";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { CourseGlyph, CourseTile, useCourseTile } from "../../ui/tile";
import { TopBar } from "../../ui/top-bar";
import { SectionTitle, StatusChip, TileRow } from "../../ui/v4-list";
import { MaterialRow, NumberTile } from "../course/modules";
import {
  courseLines,
  lineType,
  type MaterialCourse,
  type MaterialItem,
  type MaterialLine,
  type MaterialModule,
  materialCourses,
  pickCourse,
  startIndex,
} from "./courses";

/** The course last picked, for as long as the app is open: the page comes back to it. */
let lastPicked: string | null = null;

const NO_MODULES: ReadonlySet<string> = new Set();

export function MaterialScreen() {
  const t = useT();
  const b = useB();
  const theme = useTheme();
  const now = useNow();
  const bottom = useBottomInset();
  const pull = usePullToRefresh();
  const termCourses = useTermCourses();
  const outline = useDataset("edunex.outline");
  const materials = useDataset("edunex.materials");
  const tasks = useDataset("edunex.tasks");
  const edunex = useStatus("edunex").state;
  const courses = useMemo(() => {
    if (!termCourses || !materials) return null;
    const all = Array.isArray(tasks) ? tasks : [];
    return materialCourses(
      termCourses.map((course) => ({
        course,
        outline: outline?.[course.code],
        materials: materials[course.code],
        tasks: all.filter((task) => task.courseCode === course.code),
      })),
      t,
      now,
    );
  }, [termCourses, outline, materials, tasks, t, now]);
  // The course picked here, else the one the page opened on: a refresh while it's open never moves it to another.
  const [chosen, setChosen] = useState(lastPicked);
  const code = useMemo(() => (courses ? pickCourse(courses, chosen) : null), [courses, chosen]);
  if (code !== null && chosen !== code) setChosen(code);
  const course = courses?.find((item) => item.code === code);
  // The long modules a tap opened whole.
  const [opened, setOpened] = useState(NO_MODULES);
  const lines = useMemo(() => (course ? courseLines(course, opened) : []), [course, opened]);
  // Where the list opens: the module the course is on. Worked out once per course, so opening a long module above it
  // doesn't move the list.
  const start = useMemo(() => (course ? startIndex(courseLines(course, NO_MODULES)) : 0), [course]);
  usePerfDrawn(courses !== null);
  const pick = useCallback((next: string) => {
    lastPicked = next;
    setChosen(next);
  }, []);
  const openModule = useCallback((module: string) => setOpened((was) => new Set(was).add(module)), []);
  const renderItem = useCallback(
    ({ item: line }: { item: MaterialLine }) => <Line line={line} course={course?.name} onMore={openModule} />,
    [openModule, course?.name],
  );
  const loading = courses === null && (edunex === "connecting" || edunex === "live");
  const arrival = useArrivalId(!loading);
  // Courses to pick from only when one of them has something: a term with nothing posted says so once.
  const any = courses?.some((item) => item.modules.length > 0) ?? false;
  return (
    // The list ends above the phone's own bar, scrolled or not (as Page does): no row under Back, Home and Recents.
    <View testID="screen.material" style={{ flex: 1, backgroundColor: b.page, paddingBottom: bottom }}>
      {/* The bar in the page's own colour in both themes (v4's page is the dark page; the light one is the surface). */}
      <TopBar v4={b.dark} title={t("mobile.material.title")} />
      {/* The skeleton becoming the page: it fades through, once, when the data comes while the Student looks. */}
      <CrossFade id={arrival} style={{ flex: 1 }}>
        {/* What couldn't be read stays in sight wherever the list is scrolled to. */}
        <View style={{ paddingHorizontal: space.page }}>
          <ProblemBanner belowBar />
        </View>
        {any && courses && course && <CoursePicker courses={courses} picked={course} onPick={pick} />}
        <FlashList
          // A course's list is its own: it opens at that course's module, not where the last one was scrolled to.
          key={code ?? "none"}
          testID="list.material"
          data={any ? lines : []}
          keyExtractor={(line) => line.key}
          getItemType={lineType}
          renderItem={renderItem}
          initialScrollIndex={any && start > 0 ? start : undefined}
          ListEmptyComponent={loading ? <Loading /> : any ? <NothingHere /> : <Nothing signedOut={edunex === "signed-out"} />}
          contentContainerStyle={{ paddingHorizontal: space.page, paddingBottom: space[10] }}
          refreshControl={
            <RefreshControl
              refreshing={pull.refreshing}
              onRefresh={pull.onRefresh}
              colors={[theme.color.primary]}
              progressBackgroundColor={theme.color.surfaceContainerHigh}
            />
          }
        />
      </CrossFade>
    </View>
  );
}

/**
 * The term's courses, one tap each, in the term's order (a chip never moves): the course's glyph in its colour, its
 * code, and a dot when something came this week. The picked one's name is said once, under the chips. The row opens
 * with the picked chip in sight.
 */
function CoursePicker({ courses, picked, onPick }: { courses: readonly MaterialCourse[]; picked: MaterialCourse; onPick: (code: string) => void }) {
  const t = useT();
  const v = useTheme().v4;
  const row = useRef<ComponentRef<typeof ScrollView>>(null);
  const placed = useRef(false);
  return (
    <View testID="material.courses">
      <ScrollView
        ref={row}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: space[2], paddingHorizontal: space.page, paddingVertical: space[2] }}
      >
        {courses.map((course) => {
          const selected = course.code === picked.code;
          return (
            <View
              key={course.code}
              onLayout={
                selected && !placed.current
                  ? (event) => {
                      placed.current = true;
                      const { x } = event.nativeEvent.layout;
                      if (x > space.page) row.current?.scrollTo({ x: x - space.page, animated: false });
                    }
                  : undefined
              }
            >
              <Chip
                selected={selected}
                check={false}
                onPress={() => onPick(course.code)}
                testID={`chip.material.${course.code}`}
                label={factsLabel(course.name, course.fresh > 0 ? t("mobile.material.newCount", { count: course.fresh }) : null)}
              >
                <CourseGlyph code={course.code} name={course.name} size={18} />
                <Text size="labelLarge" tone={selected ? "onSecondaryContainer" : "muted"} style={{ flexShrink: 0 }}>
                  {course.code}
                </Text>
                {course.fresh > 0 && <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: v.brandInk }} />}
              </Chip>
            </View>
          );
        })}
      </ScrollView>
      <View style={{ paddingHorizontal: space.page, paddingTop: space[2], paddingBottom: space[1] }}>
        <BHeading style={{ marginBottom: 0 }}>{picked.name}</BHeading>
      </View>
    </View>
  );
}

/** One line of the list. Plain cells: nothing here moves a cell while the list measures it. */
const Line = memo(function Line({ line, course, onMore }: { line: MaterialLine; course: string | undefined; onMore: (module: string) => void }) {
  const t = useT();
  const v = useTheme().v4;
  if (line.type === "joint") return <SectionTitle>{t("course.jointClass")}</SectionTitle>;
  if (line.type === "module") return <ModuleHeading module={line.module} course={course} first={line.first} />;
  // The rest of a long module, one tap away: a row as the items are, its words where theirs start.
  if (line.type === "more")
    return (
      <TileRow
        testID={`action.material.more.${line.module}`}
        leading={<View style={{ width: 44 }} />}
        title={t("mobile.material.more", { count: line.count })}
        status={<Icons.ChevronDown size={20} color={v.muted} />}
        onPress={() => onMore(line.module)}
      />
    );
  // Keyed by the item: a recycled cell never keeps another file's download.
  return <Item key={line.key} item={line.item} first={line.first} />;
});

/**
 * Whose material follows: the module's number as the course's tab draws it (in the course's ink; on a filled circle
 * for the module the course is on) and its title, with that tab's own mark ("Minggu ini", "Terbaru"). A heading, not
 * a row: its material is already under it, so there is nothing to tap.
 */
function ModuleHeading({ module, course, first }: { module: MaterialModule; course: string | undefined; first: boolean }) {
  const t = useT();
  const v = useTheme().v4;
  const code = module.items[0]?.code ?? "";
  const ink = useCourseTile()(code).ink;
  const number = module.label === null ? null : t("course.module", { no: module.label });
  const whose = module.parent ? t("course.jointClass") : null;
  const mark = module.current === "week" ? t("course.thisWeek") : module.current === "latest" ? t("course.latest") : null;
  return (
    <View
      testID={`heading.material.${module.id}`}
      accessible
      accessibilityRole="header"
      accessibilityLabel={factsLabel(number, module.title, whose, mark)}
      style={{ flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 48, marginTop: first ? space[1] : space[5] }}
    >
      {module.label === null ? <CourseTile code={code} name={course} bare /> : <NumberTile no={module.label} ink={ink} here={module.current !== null} />}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size="bodyLarge" weight="bold" numberOfLines={2} style={{ color: v.fg }}>
          {module.title}
        </Text>
      </View>
      {mark && <StatusChip tone="brand">{mark}</StatusChip>}
    </View>
  );
}

/** One thing to open, as its module's page lists it; a note or a picture opens that page, where it's read in full. */
function Item({ item, first }: { item: MaterialItem; first: boolean }) {
  const t = useT();
  const { go } = useNav();
  return (
    <MaterialRow
      material={item.material}
      first={first}
      fresh={item.fresh ? t("course.new") : undefined}
      onRead={() => go({ screen: "course", code: item.code, module: item.module })}
    />
  );
}

/** The page's shape while Edunex's part is on its way: the courses, the picked one's name, a module over its rows. */
function Loading() {
  return (
    <View testID="skeleton.material" accessibilityState={{ busy: true }} style={{ paddingTop: space[2] }}>
      <View style={{ flexDirection: "row", gap: space[2] }}>
        {[104, 96, 104].map((width, chip) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: still placeholders
          <Skeleton key={chip} height={32} width={width} />
        ))}
      </View>
      <Skeleton height={20} width={190} style={{ marginTop: space[5] }} />
      {[3, 2].map((rows, group) => (
        <View key={rows} style={{ marginTop: group ? space[5] : space[3] }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[3], height: 48 }}>
            <Skeleton height={24} width={24} style={{ marginHorizontal: 10 }} />
            <Skeleton height={16} width={group ? 150 : 200} />
          </View>
          {Array.from({ length: rows }, (_, row) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: still placeholders
            <View key={row} style={{ flexDirection: "row", alignItems: "center", gap: space[3], height: 68 }}>
              <Skeleton height={24} width={24} style={{ marginHorizontal: 10 }} />
              <View style={{ flex: 1, gap: space[2] }}>
                <Skeleton height={16} width={row === 1 ? "58%" : "80%"} />
                <Skeleton height={12} width={130} />
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

/** The picked course has nothing posted: the words its own tab says. */
function NothingHere() {
  const t = useT();
  const theme = useTheme();
  return <EmptyState icon={<Icons.BookOpen size={24} color={theme.color.onSecondaryContainer} />} title={t("course.noMaterials")} />;
}

/** Nothing to list: no Edunex (said once, with the way in), or a term nothing was posted in yet. */
function Nothing({ signedOut }: { signedOut: boolean }) {
  const t = useT();
  const theme = useTheme();
  const { signIn, busy } = useSignIn();
  const icon = <Icons.BookOpen size={24} color={theme.color.onSecondaryContainer} />;
  if (signedOut)
    return (
      <EmptyState icon={icon} title={t("mobile.material.noEdunex")}>
        <Button variant="primary" busy={busy} onPress={() => void signIn("edunex")} testID="action.signIn.edunex">
          {t("action.signInTo", { source: "Edunex" })}
        </Button>
      </EmptyState>
    );
  return <EmptyState icon={icon} title={t("mobile.material.empty")} description={t("mobile.material.emptyHint")} />;
}
