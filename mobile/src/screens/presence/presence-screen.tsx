// Kuliah on the phone (round 4; the desktop's Presensi, src/app/screens/presence.tsx): in three seconds, which course
// is at risk, and the way into each. On v4's grey page under the bar's "Kuliah": what needs the Student now
// (./now.tsx), then every course as a card in a grid two across, filled with the course's own colour (./course-row.tsx):
// its glyph, its short name and its absences as dots. The courses at risk (out of reach, none left, finished below)
// come first, in the desktop's order. The card opens the course. The day's answer, the target and how it's counted are
// in ⋮ (./footer.tsx's sheet), beside the targets. Same data and words as the desktop.
import { useState } from "react";
import { View } from "react-native";
import { type Attendance, useAttendance } from "../../../../src/app/attendance";
import { useNow, useT } from "../../../../src/app/i18n";
import { useCourseNames } from "../../../../src/app/schedule-data";
import { useDataset, useSettings } from "../../../../src/app/store";
import { SixPageNote, useChangedPage } from "../../parts/six-page-note";
import { usePerfDrawn } from "../../perf";
import { TabHeader } from "../../shell/source-status";
import { EmptyState, Skeleton } from "../../ui/display";
import { Rise } from "../../ui/expressive";
import { Icons } from "../../ui/icons";
import { Page } from "../../ui/layout";
import { OverflowMenu } from "../../ui/menu";
import { Part } from "../../ui/parts";
import { space, useTheme } from "../../ui/theme";
import { CARD_HEIGHT, CourseCard } from "./course-row";
import { FactsSheet } from "./footer";
import { SignInCard } from "./lead";
import { groupsOf, nowZone, type RowContext, type Still, targetRange, type Zone } from "./logic";
import { NowZone, nowShown } from "./now";
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

/**
 * Kuliah (round 4): what needs the Student now, then the courses as a grid of their own colours, at risk first, each a
 * card that opens its page. The targets, the day's answer and how it's counted are in ⋮.
 */
export function CoursesScreen({ onRefresh, refreshing }: { onRefresh: () => void; refreshing: boolean }) {
  const t = useT();
  const theme = useTheme();
  const v = theme.v4;
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
  // Every course in the groups' order (at risk first), two to a line; the first card of each group carries its name.
  const cards = groups.flatMap(({ group, items }) => items.map((item, i) => ({ item, group, first: i === 0 })));
  const lines = Array.from({ length: Math.ceil(cards.length / 2) }, (_, i) => cards.slice(i * 2, i * 2 + 2));
  const parts = [lines.slice(0, FIRST_LINES), lines.slice(FIRST_LINES)].filter((part) => part.length > 0);
  return (
    <Page
      testID="screen.courses"
      header={<TabHeader v4 title={t("mobile.tab.courses")} actions={menu} />}
      background={v.page}
      onRefresh={onRefresh}
      refreshing={refreshing}
    >
      {!rows ? (
        <Loading />
      ) : (
        <View style={{ gap: space[4] }}>
          <SixPageNote datasets={["six.courses", "six.schedule"]} />
          {!connected && courses.length > 0 && (
            <Rise screen="courses" index={0}>
              <SignInCard quiet={rows.zone.windows.length > 0} />
            </Rise>
          )}
          {nowShown(rows.zone) && (
            <Rise screen="courses" index={1}>
              <NowZone zone={rows.zone} attendance={rows.attendance} />
            </Rise>
          )}
          {courses.length === 0
            ? !listChanged && (
                <EmptyState
                  icon={<Icons.BookOpen size={24} color={theme.color.onSecondaryContainer} />}
                  title={t("presence.empty")}
                  description={t("presence.emptyHint")}
                />
              )
            : parts.map((part, i) => (
                // The cards past the first screen: a part of their own on a first draw ahead (../../ui/parts.tsx).
                <Part key={i === 0 ? "first" : "rest"} at={i === 0 ? 0 : 1}>
                  <Rise screen="courses" index={2 + i}>
                    <View style={{ gap: GAP }}>
                      {part.map((line) => (
                        <View key={line[0]!.item.course.code} style={{ flexDirection: "row", gap: GAP }}>
                          {line.map(({ item, group, first }) => (
                            <View key={item.course.code} testID={first ? `group.presence.${group}` : undefined} style={{ flex: 1, flexDirection: "row" }}>
                              <CourseCard item={item} group={group} context={rows.context} />
                            </View>
                          ))}
                          {line.length === 1 && <View style={{ flex: 1 }} />}
                        </View>
                      ))}
                    </View>
                  </Rise>
                </Part>
              ))}
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

/** The grid's gap, between cards and between lines. */
const GAP = 12;
/** The lines of two drawn with the screen; the rest a frame later. */
const FIRST_LINES = 3;

/** Kuliah's shape before its data: the grid of cards, two across. Never a spinner on a blank page. */
function Loading() {
  return (
    <View accessibilityState={{ busy: true }} testID="courses.loading" style={{ gap: GAP }}>
      {[0, 1, 2].map((line) => (
        <View key={line} style={{ flexDirection: "row", gap: GAP }}>
          {[0, 1].map((i) => (
            <View key={i} style={{ flex: 1 }}>
              <Skeleton height={CARD_HEIGHT} style={{ borderRadius: 20 }} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
