// Kuliah on the phone (round 2; the desktop's Presensi, src/app/screens/presence.tsx): in three seconds, which course
// is at risk and the way into each. The answer for the next class day under the top bar ("Hari ini ada 4 kuliah.
// Hanya PL3002 yang masih ada jatah absen."), what needs the Student now, then every course grouped by what it asks of
// them (out of reach, no absences left, absences to spare, …) as a slim row: colour, name, code, its next class, what's
// left of its absences on a chip. The row opens the course, where the bar, the count and the one exception are. The
// targets are in ⋮. Same order, data and words as the desktop.
import { type ReactNode, useState } from "react";
import { View } from "react-native";
import { type Attendance, type CourseAttendance, useAttendance } from "../../../../src/app/attendance";
import { useFormat, useNow, useT } from "../../../../src/app/i18n";
import { useCourseNames } from "../../../../src/app/schedule-data";
import { useDataset, useSettings } from "../../../../src/app/store";
import { dayAnswer, type PresenceGroup } from "../../../../src/core/attendance";
import { wibDay } from "../../../../src/core/course-meetings";
import { SixPageNote, useChangedPage } from "../../parts/six-page-note";
import { usePerfDrawn } from "../../perf";
import { TabHeader } from "../../shell/source-status";
import { EmptyState, Skeleton } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { List, Page } from "../../ui/layout";
import { OverflowMenu } from "../../ui/menu";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { CourseRow } from "./course-row";
import { Footer, HowCounted } from "./footer";
import { dayLabel, groupLabel, groupsOf, noonOf, nowZone, type RowContext, type Still, targetRange, type Zone } from "./logic";
import { NowZone } from "./now";
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
 * Kuliah (round 2): which course is at risk, and the way into each. Under the top bar the answer for the next class
 * day, then what needs the Student now, then the courses grouped by what they ask (out of reach first), each a slim
 * row that opens its page. The targets are in ⋮. How attendance is counted is said once, at the end.
 */
export function CoursesScreen({ onRefresh, refreshing }: { onRefresh: () => void; refreshing: boolean }) {
  const t = useT();
  const theme = useTheme();
  const name = useCourseNames();
  const [targets, setTargets] = useState<{ open: boolean; focus: string | null }>({ open: false, focus: null });
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
  const showTargets = Boolean(rows?.attendance.sixConnected) && courses.length > 0;
  usePerfDrawn(rows !== undefined);
  const menu = showTargets ? (
    <OverflowMenu
      testID="action.coursesMenu"
      choices={[
        {
          label: t("mobile.courses.targets"),
          hint: targetRange(courses),
          icon: <Icons.Target size={20} color={theme.color.onSurfaceVariant} />,
          onPress: () => openTargets(true),
          testID: "action.target",
        },
      ]}
    />
  ) : undefined;
  return (
    <Page testID="screen.courses" header={<TabHeader title={t("mobile.tab.courses")} actions={menu} />} onRefresh={onRefresh} refreshing={refreshing}>
      {!rows ? (
        <Loading />
      ) : (
        <>
          {showTargets && (
            <View style={{ marginBottom: space[6] }}>
              <DayLine attendance={rows.attendance} />
            </View>
          )}
          <View style={{ gap: space[6] }}>
            <SixPageNote datasets={["six.courses", "six.schedule"]} />
            <NowZone zone={rows.zone} attendance={rows.attendance} />
            {courses.length === 0
              ? !listChanged && <EmptyState icon={<Icons.BookOpen size={24} color={theme.color.onSecondaryContainer} />} title={t("presence.empty")} description={t("presence.emptyHint")} />
              : groups.map(({ group, items }) => (
                  <View key={group} testID={`group.presence.${group}`}>
                    <GroupTitle group={group} items={items} />
                    <List>
                      {items.map((item) => (
                        <CourseRow key={item.course.code} item={item} group={group} context={rows.context} />
                      ))}
                    </List>
                  </View>
                ))}
          </View>
          {courses.length > 0 && rows.attendance.sixConnected && !(rows.attendance.lastDay !== null && wibDay(rows.context.now) > rows.attendance.lastDay) && (
            <Footer attendance={rows.attendance} />
          )}
          {courses.length > 0 && <HowCounted lastDay={rows.attendance.lastDay} />}
        </>
      )}
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

function Loading() {
  return (
    <View accessibilityState={{ busy: true }} style={{ gap: space[3] }}>
      <Skeleton height={32} width={160} />
      <Skeleton height={20} width="85%" />
      <Skeleton height={360} style={{ marginTop: space[5], borderRadius: 12 }} />
    </View>
  );
}

const GROUP_ICON: Record<
  PresenceGroup,
  { Icon: (typeof Icons)[keyof typeof Icons]; tone: "dangerFg" | "warningFg" | "successFg" | "muted" | "faint"; bold: boolean }
> = {
  out: { Icon: Icons.AlertTriangle, tone: "dangerFg", bold: true },
  none: { Icon: Icons.AlertTriangle, tone: "warningFg", bold: true },
  edunex: { Icon: Icons.Hand, tone: "muted", bold: false },
  spare: { Icon: Icons.CheckCircle, tone: "successFg", bold: true },
  unknown: { Icon: Icons.Circle, tone: "faint", bold: false },
  missed: { Icon: Icons.AlertTriangle, tone: "dangerFg", bold: true },
  met: { Icon: Icons.CheckCircle, tone: "successFg", bold: true },
  courses: { Icon: Icons.BookOpen, tone: "faint", bold: false },
};

/** The group's heading with its count, in one line of text: "Tak bisa lagi capai 80%  1". */
function GroupTitle({ group, items }: { group: PresenceGroup; items: readonly CourseAttendance[] }) {
  const t = useT();
  const theme = useTheme();
  const { Icon, tone, bold } = GROUP_ICON[group];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], marginBottom: space[2], paddingHorizontal: space[1] }}>
      <Icon size={18} color={theme.color[tone]} weight={bold ? "bold" : "regular"} />
      <Text size="titleSmall" accessibilityRole="header" style={{ flex: 1 }}>
        {groupLabel(t, group, items)}
        <Text size="titleSmall" tone="muted" tabular>
          {`  ${items.length}`}
        </Text>
      </Text>
    </View>
  );
}

/** "Hari ini ada 4 kuliah. Hanya PL3002 yang masih ada jatah absen.", or the next class day, or when lectures ended. */
function DayLine({ attendance }: { attendance: Attendance }): ReactNode {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const unread = useDataset("six.scheduleUnread");
  const answer = dayAnswer(
    attendance.courses.map((c) => c.health),
    attendance.schedule,
    attendance.period,
    now,
    unread,
  );
  if (!answer) return null;
  const line = (text: string) => (
    <Text size="bodyLarge" tone="muted">
      {text}
    </Text>
  );
  if (answer.kind === "ended") return line(t("presence.ended", { date: dayLabel(f, noonOf(answer.lastDay)) }));
  // A class SIX shows that the app couldn't read: counted on its day, and said, with where to look.
  const unreadLine = answer.unread ? ` ${t("presence.day.unread", { count: answer.unread })}` : "";
  if (answer.kind === "next") return line(`${t("presence.day.next", { day: dayLabel(f, answer.at) })}${unreadLine}`);
  const first = `${t(answer.day === "today" ? "presence.day.today" : "presence.day.tomorrow", { count: answer.count })}${unreadLine}`;
  const { spare } = answer;
  // Said only of the courses SIX has a count for; with some still uncounted, they're named instead of "only" or "each".
  const second = !spare
    ? ""
    : spare.of < spare.courses
      ? spare.codes.length
        ? t("presence.day.some", { codes: f.list(spare.codes), count: spare.codes.length })
        : ""
      : spare.of === 1
        ? t(spare.codes.length ? "presence.day.one" : "presence.day.oneNone")
        : spare.codes.length === spare.of
          ? t("presence.day.all")
          : spare.codes.length === 0
            ? t("presence.day.none")
            : t("presence.day.only", { codes: f.list(spare.codes), count: spare.codes.length });
  return line(second ? `${first} ${second}` : first);
}
