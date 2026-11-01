// Kuliah on the phone (round 2, v4; the desktop's Presensi, src/app/screens/presence.tsx): in three seconds, which
// course is at risk, and the way into each. On v4's grey page under the bar's "Kuliah": one white card led by a big
// number (how many courses can't reach the target anymore, else have no absences left, …: ./lead.tsx), what needs the
// Student now (./now.tsx), then every course as a row in a white card: its tile, name and code, what's left of its
// absences on a chip. The courses at risk (out of reach, none left, finished below) come first in a card of their own,
// the rest in another, in the desktop's order. The row opens the course. The day's answer ("Hari ini ada 4 kuliah.
// Hanya PL3002 yang masih ada jatah absen."), the target and how it's counted are one tap deeper, in the big number's
// sheet (./footer.tsx), also in ⋮ beside the targets. Same data and words as the desktop.
import { useState } from "react";
import { View } from "react-native";
import { type Attendance, useAttendance } from "../../../../src/app/attendance";
import { useNow, useT } from "../../../../src/app/i18n";
import { useCourseNames } from "../../../../src/app/schedule-data";
import { useDataset, useSettings } from "../../../../src/app/store";
import type { PresenceGroup } from "../../../../src/core/attendance";
import { SixPageNote, useChangedPage } from "../../parts/six-page-note";
import { usePerfDrawn } from "../../perf";
import { TabHeader } from "../../shell/source-status";
import { EmptyState, Skeleton } from "../../ui/display";
import { Rise } from "../../ui/expressive";
import { Icons } from "../../ui/icons";
import { Page } from "../../ui/layout";
import { OverflowMenu } from "../../ui/menu";
import { space, useTheme } from "../../ui/theme";
import { CardGroup } from "../../ui/v4-list";
import { useCardStyle } from "../home/now";
import { CourseRow } from "./course-row";
import { FactsSheet } from "./footer";
import { LeadCard, leadOf, SignInCard } from "./lead";
import { groupsOf, nowZone, type RowContext, type Still, targetRange, type Zone } from "./logic";
import { NowNotes, NowZone, nowShown } from "./now";
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

/**
 * Kuliah (round 2, v4): the big number, what needs the Student now, then the courses, at risk first, each a row that
 * opens its page. The targets and how it's counted are in ⋮; the day's answer is in the big number's sheet.
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
  const lead = rows && connected ? leadOf(t, courses) : null;
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
          {!connected && courses.length > 0 ? (
            <Rise screen="courses" index={0}>
              <SignInCard quiet={rows.zone.windows.length > 0} />
            </Rise>
          ) : (
            lead && (
              <Rise screen="courses" index={0}>
                <LeadCard lead={lead} onPress={() => setFacts(true)} />
              </Rise>
            )
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
                <Rise key={band[0]!.group} screen="courses" index={2 + i} style={i > 0 ? { marginTop: -space[1] } : undefined}>
                  <CardGroup>
                    {band.map(({ group, items }, g) => (
                      <View key={group} testID={`group.presence.${group}`}>
                        {items.map((item, r) => (
                          <CourseRow key={item.course.code} item={item} group={group} context={rows.context} first={g === 0 && r === 0} />
                        ))}
                      </View>
                    ))}
                  </CardGroup>
                </Rise>
              ))}
          <NowNotes zone={rows.zone} />
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

/** Kuliah's shape before its data: the big number's card, then a card of rows. Never a spinner on a blank page. */
function Loading() {
  const surface = useCardStyle();
  const v = useTheme().v4;
  return (
    <View accessibilityState={{ busy: true }} testID="courses.loading" style={{ gap: space[4] }}>
      <View style={[surface, { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: space[4], paddingHorizontal: space[5] }]}>
        <Skeleton height={52} width={40} style={{ borderRadius: 12 }} />
        <View style={{ flex: 1, gap: space[2] }}>
          <Skeleton height={16} width="80%" />
          <Skeleton height={16} width="55%" />
        </View>
      </View>
      <View style={{ backgroundColor: v.card, borderRadius: 20, overflow: "hidden" }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: 14, paddingVertical: space[3], minHeight: 68 }}>
            <Skeleton height={44} width={44} style={{ borderRadius: 14 }} />
            <View style={{ flex: 1, gap: space[2] }}>
              <Skeleton height={16} width={i % 2 ? "60%" : "80%"} />
              <Skeleton height={12} width={64} />
            </View>
            <Skeleton height={26} width={64} style={{ borderRadius: 999 }} />
          </View>
        ))}
      </View>
    </View>
  );
}
