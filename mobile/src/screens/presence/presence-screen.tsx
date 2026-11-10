// Kuliah on the phone (round 3; the desktop's Presensi, src/app/screens/presence.tsx): in three seconds, which course
// is at risk, and the way into each. On v4's grey page under the bar's "Kuliah": what needs the Student now
// (./now.tsx), then every course as a row in a white card: its tile, its whole name, and under it the state of its
// absences in plain words ("Absen lewat 1×", "Jatah absen habis" in the risk's ink, "Sisa 2×" quiet). The
// courses at risk (out of reach, none left, finished below) come first under "Perlu perhatian", the rest under "Aman"
// (or "Lainnya" while some have no count yet), in the desktop's order. The row opens the course. The day's answer, the
// target and how it's counted are in ⋮ (./footer.tsx's sheet), beside the targets. Same data and words as the desktop.
import { useState } from "react";
import { View } from "react-native";
import { type Attendance, useAttendance } from "../../../../src/app/attendance";
import { useNow, useT } from "../../../../src/app/i18n";
import { useCourseNames } from "../../../../src/app/schedule-data";
import { useDataset, useSettings } from "../../../../src/app/store";
import type { PresenceGroup } from "../../../../src/core/attendance";
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

/** The groups that ask the most of the Student: their courses share the first card. */
const AT_RISK: readonly PresenceGroup[] = ["out", "none", "missed"];
/** The groups with absences to spare or the target met: their card is "Aman"; with any course still uncounted, "Lainnya". */
const CALM: readonly PresenceGroup[] = ["spare", "met"];

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
  const bands = [groups.filter((g) => AT_RISK.includes(g.group)), groups.filter((g) => !AT_RISK.includes(g.group))].filter((band) => band.length > 0);
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
            : bands.map((band, i) => (
                // The courses past the first card: a part of their own on a first draw ahead (../../ui/parts.tsx).
                <Part key={band[0]!.group} at={i === 0 ? 0 : 1}>
                  <Rise screen="courses" index={2 + i}>
                    {/* With both bands, each under its name (said once for all its courses): never the rest under "Perlu perhatian". */}
                    {bands.length > 1 && (
                      <BHeading style={i > 0 ? { marginTop: space[4] } : undefined}>
                        {t(i === 0 ? "mobile.kuliah.attention" : band.every((g) => CALM.includes(g.group)) ? "mobile.kuliah.calm" : "mobile.kuliah.rest")}
                      </BHeading>
                    )}
                    {/* Two across, as the official app lists courses: each a card of its own, in its colour. */}
                    <View style={{ gap: space[5] }}>
                      {pairs(band.flatMap(({ group, items }) => items.map((item) => ({ group, item })))).map((pair) => (
                        <View key={pair[0]!.item.course.code} style={{ flexDirection: "row", gap: space[4] }}>
                          {pair.map(({ group, item }) => (
                            <CourseCard key={item.course.code} item={item} group={group} context={rows.context} />
                          ))}
                          {pair.length === 1 && <View style={{ flex: 1 }} />}
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

/** A list two by two. */
function pairs<T>(list: readonly T[]): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += 2) out.push(list.slice(i, i + 2));
  return out;
}

/** Kuliah's shape before its data: a card of rows, each a name over its meter. Never a spinner on a blank page. */
function Loading() {
  return (
    <View accessibilityState={{ busy: true }} testID="courses.loading" style={{ gap: space[5] }}>
      {[0, 1, 2].map((row) => (
        <View key={row} style={{ flexDirection: "row", gap: space[4] }}>
          {[0, 1].map((i) => (
            <View key={i} style={{ flex: 1, gap: space[2] }}>
              <Skeleton height={96} style={{ borderRadius: 20 }} />
              <Skeleton height={16} width={i ? "60%" : "80%"} />
              <Skeleton height={12} width={96} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
