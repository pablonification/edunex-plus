// Kuliah on the phone (the super-app round; the desktop's Presensi, src/app/screens/presence.tsx): in three seconds,
// is my attendance safe in every course, and the way into each. On the white page under the bar's "Kuliah", read top
// to bottom: "Hari ini", always there (./now.tsx: the class on now as a block in its colour with "Isi Presensi", else
// one quiet line on today's classes; a clash), then "Semester ini", every course as a flat row (./course-card.tsx):
// its glyph in its colour, its name whole, its absences as dots and one short label, a chevron. The courses at
// risk come first, the rest after them with no heading between (the state's colour says which is which; "Aman" as a
// heading pushed the safe ones off the first screen). Without SIX the count is unknown: said once, on a line at the
// top, never on each course. The targets and how it's counted are in ⋮ (./footer.tsx's sheet).
import { useState } from "react";
import { View } from "react-native";
import { type Attendance, useAttendance } from "../../../../src/app/attendance";
import { useNow, useT } from "../../../../src/app/i18n";
import { useCourseNames } from "../../../../src/app/schedule-data";
import { useDataset, useSettings } from "../../../../src/app/store";
import { BTabHeader } from "../../parts/b-header";
import { SixPageNote, useChangedPage } from "../../parts/six-page-note";
import { usePerfDrawn } from "../../perf";
import { BHeading, useB } from "../../ui/b";
import { EmptyState, Skeleton } from "../../ui/display";
import { Rise } from "../../ui/expressive";
import { Icons } from "../../ui/icons";
import { Page } from "../../ui/layout";
import { OverflowMenu } from "../../ui/menu";
import { Part } from "../../ui/parts";
import { space, useTheme } from "../../ui/theme";
import { CourseCard } from "./course-card";
import { FactsSheet } from "./footer";
import { SignInCard } from "./lead";
import { groupsOf, nowZone, type RowContext, type Still, targetRange, type Zone } from "./logic";
import { NowZone, todayShown } from "./now";
import { TargetsSheet } from "./targets-sheet";

/**
 * What every course's row reads besides its own course (the clock, SIX's check-ins, the timetable, the targets): Kuliah
 * builds it for its rows, a course's page for its own line. `onChangeTarget`: "Ubah target" on a course out of reach.
 */
export function useRowContext(onChangeTarget: (code: string) => void): { attendance: Attendance; context: RowContext; zone: Zone } | undefined {
  const attendance = useAttendance();
  const now = useNow();
  const student = useDataset("six.student");
  const checkIns = useDataset("six.checkIn");
  const unread = useDataset("six.scheduleUnread");
  const calendar = useDataset("itb.calendar");
  const { attendanceTargets } = useSettings();
  if (!attendance) return undefined;
  const zone = nowZone(attendance, { now, student, checkIns, events: calendar?.events ?? [] });
  const context: RowContext = {
    now,
    student,
    checkIns: checkIns ?? {},
    events: calendar?.events ?? [],
    zone,
    signedOut: !attendance.sixConnected,
    schedule: attendance.schedule,
    unread: unread ?? [],
    own: attendanceTargets,
    soFar: attendance.period === null,
    onChangeTarget,
  };
  return { attendance, context, zone };
}

/** How many courses are drawn with the screen's first frame; the rest come a frame later (../../ui/parts.tsx). */
const FIRST = 4;

/**
 * Kuliah (round 3): what needs the Student now, then the courses, at risk first under their heading, each a row that
 * opens its page. The targets, the day's answer and how it's counted are in ⋮.
 */
export function CoursesScreen({ onRefresh, refreshing }: { onRefresh: () => void; refreshing: boolean }) {
  const t = useT();
  const theme = useTheme();
  const b = useB();
  const name = useCourseNames();
  const [targets, setTargets] = useState<{ open: boolean; focus: string | null }>({ open: false, focus: null });
  const [facts, setFacts] = useState(false);
  const [still, setStill] = useState<Still | null>(null);
  const rows = useRowContext((code) => openTargets(true, code));
  // SIX changed its course table before it read: the note at the top says why there's nothing to list.
  const listChanged = useChangedPage(["six.courses"]) !== undefined;
  const courses = rows?.attendance.courses ?? [];
  const groups = rows ? groupsOf(courses, rows.context.signedOut, still) : [];
  const openTargets = (open: boolean, focus: string | null = null) => {
    setTargets({ open, focus: open ? focus : null });
    setStill(open ? groups.map(({ group, items }) => ({ group, codes: items.map((c) => c.course.code) })) : null);
  };
  const connected = Boolean(rows?.attendance.sixConnected);
  const showTargets = connected && courses.length > 0;
  usePerfDrawn(rows !== undefined);
  const muted = theme.color.onSurfaceVariant;
  const choices = [
    ...(showTargets
      ? [
          {
            label: t("mobile.courses.targets"),
            hint: targetRange(courses),
            icon: <Icons.Target size={20} color={muted} />,
            onPress: () => openTargets(true),
            testID: "action.target",
          },
        ]
      : []),
    ...(courses.length > 0
      ? [{ label: t("presence.how"), icon: <Icons.Info size={20} color={muted} />, onPress: () => setFacts(true), testID: "action.howCounted" }]
      : []),
  ];
  const menu = choices.length ? <OverflowMenu testID="action.coursesMenu" choices={choices} /> : undefined;
  // At risk first (the desktop's order), one list: each course says its own state.
  const list = groups.flatMap(({ group, items }) => items.map((item) => ({ group, item })));
  // "Hari ini" is always there while there's a timetable to read (./now.tsx): Presensi's fixed place.
  const today = rows ? courses.length > 0 && todayShown(rows.zone, rows.attendance) : false;
  return (
    <Page
      testID="screen.courses"
      header={<BTabHeader title={t("mobile.tab.courses")} actions={menu} />}
      background={b.page}
      onRefresh={onRefresh}
      refreshing={refreshing}
    >
      {!rows ? (
        <Loading />
      ) : (
        <View>
          <SixPageNote datasets={["six.courses", "six.schedule"]} />
          {!connected && courses.length > 0 && <SignInCard quiet={rows.zone.windows.length > 0} />}
          {/* Each line comes and goes with its window (Appear, in ./now.tsx): no second move around them. */}
          {today && (
            <View testID="section.coursesNow">
              <BHeading style={{ marginBottom: space[1] }}>{t("mobile.kuliah.today")}</BHeading>
              <NowZone zone={rows.zone} attendance={rows.attendance} now={rows.context.now} />
            </View>
          )}
          {courses.length === 0 ? (
            !listChanged && (
              <EmptyState
                icon={<Icons.BookOpen size={24} color={theme.color.onSecondaryContainer} />}
                title={t("presence.empty")}
                description={t("presence.emptyHint")}
              />
            )
          ) : (
            <Rise screen="courses" index={0}>
              {/* A heading only when something sits above the courses: alone under the bar's "Kuliah" they need none. */}
              {today && <BHeading style={{ marginTop: space[3], marginBottom: space[1] }}>{t("mobile.kuliah.term")}</BHeading>}
              <View testID="list.courses" style={{ marginTop: !today && !connected ? space[2] : 0 }}>
                {list.slice(0, FIRST).map(({ group, item }) => (
                  <CourseCard key={item.course.code} item={item} group={group} context={rows.context} />
                ))}
                {/* The courses past the first few: on the frame after the first (the tab's first frame stays light). */}
                <Part at={1}>
                  {list.slice(FIRST).map(({ group, item }) => (
                    <CourseCard key={item.course.code} item={item} group={group} context={rows.context} />
                  ))}
                </Part>
              </View>
            </Rise>
          )}
        </View>
      )}
      {rows && courses.length > 0 && <FactsSheet attendance={rows.attendance} open={facts} onClose={() => setFacts(false)} />}
      {showTargets && (
        <TargetsSheet
          courses={courses.map((c) => ({ code: c.course.code, name: name(c.course.code, c.course.name), color: c.course.color }))}
          open={targets.open}
          onClose={() => openTargets(false)}
          focus={targets.focus}
        />
      )}
    </Page>
  );
}

/** Kuliah's shape before its data: the courses' blocks, a name over its status. Never a spinner on a blank page. */
function Loading() {
  return (
    <View accessibilityState={{ busy: true }} testID="courses.loading" style={{ gap: space[2] }}>
      {[0, 1, 2, 3, 4, 5].map((row) => (
        <Skeleton key={row} height={68} style={{ borderRadius: 16 }} />
      ))}
    </View>
  );
}
