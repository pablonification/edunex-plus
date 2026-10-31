// Presensi on the phone (src/app/screens/presence.tsx), "absences left": am I OK, and what do I
// do? Under the title, the answer for the next class day ("Hari ini ada 4 kuliah. Hanya PL3002 yang
// masih ada jatah absen."), and the targets a press away (a sheet). Then only what needs the
// Student now, then every course grouped by what it asks of them (out of reach, no absences left,
// absences to spare, …), each row its next class, SIX's share over its absences as a bar with
// words, and one exception at most. How it's recorded and that later dates are estimated is said
// once, under the groups. Same order, data and words as the desktop, in one column.
import { type ReactNode, useState } from "react";
import { View } from "react-native";
import { type Attendance, type CourseAttendance, useAttendance } from "../../../../src/app/attendance";
import { useFormat, useNow, useT } from "../../../../src/app/i18n";
import { useCourseNames } from "../../../../src/app/schedule-data";
import { useDataset, useSettings } from "../../../../src/app/store";
import { dayAnswer, type PresenceGroup } from "../../../../src/core/attendance";
import { wibDay } from "../../../../src/core/course-meetings";
import { SixPageNote, useChangedPage } from "../../parts/six-page-note";
import { Button } from "../../ui/controls";
import { EmptyState, Skeleton } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { List, PageHeader } from "../../ui/layout";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { CourseRow } from "./course-row";
import { Footer, HowCounted } from "./footer";
import { dayLabel, groupLabel, groupsOf, noonOf, nowZone, type RowContext, type Still, targetRange } from "./logic";
import { NowZone } from "./now";
import { TargetsSheet } from "./targets-sheet";

/**
 * Everything under the tab's header; the route puts it in a Page with pull to refresh. Kuliah (the tab it lives in now)
 * names the page in its top bar, so `title` is left out there.
 */
export function PresenceContent({ title }: { title?: string } = {}) {
  const t = useT();
  const attendance = useAttendance();
  const now = useNow();
  const student = useDataset("six.student");
  const checkIns = useDataset("six.checkIn");
  const unread = useDataset("six.scheduleUnread");
  const calendar = useDataset("itb.calendar");
  const { attendanceTargets } = useSettings();
  const name = useCourseNames();
  const [targets, setTargets] = useState<{ open: boolean; focus: string | null }>({ open: false, focus: null });
  const [still, setStill] = useState<Still | null>(null);
  // SIX changed its course table before it read: the note at the top says why there's nothing to list.
  const listChanged = useChangedPage(["six.courses"]) !== undefined;
  if (!attendance) return <Loading />;
  const { courses, sixConnected } = attendance;
  const signedOut = !sixConnected;
  const groups = groupsOf(courses, signedOut, still);
  const openTargets = (open: boolean, focus: string | null = null) => {
    setTargets({ open, focus: open ? focus : null });
    setStill(open ? groups.map(({ group, items }) => ({ group, codes: items.map((c) => c.course.code) })) : null);
  };
  const zone = nowZone(attendance, { now, student, checkIns, events: calendar?.events ?? [] });
  const lectures = attendance.lastDay !== null && wibDay(now) > attendance.lastDay;
  const context: RowContext = {
    now,
    student,
    checkIns: checkIns ?? {},
    events: calendar?.events ?? [],
    zone,
    signedOut,
    schedule: attendance.schedule,
    unread: unread ?? [],
    own: attendanceTargets,
    soFar: attendance.period === null,
    onChangeTarget: (code) => openTargets(true, code),
  };
  const showTargets = sixConnected && courses.length > 0;

  return (
    <>
      <PageHeader
        title={title}
        description={showTargets ? <DayLine attendance={attendance} /> : undefined}
        actions={showTargets ? <TargetsButton range={targetRange(courses)} onPress={() => openTargets(true)} /> : undefined}
      />

      {/* What needs the Student now, then the groups, 32 apart (a part with nothing to say takes no room). */}
      <View style={{ gap: space[8] }}>
        <SixPageNote datasets={["six.courses", "six.schedule"]} />
        <NowZone zone={zone} attendance={attendance} />
        {courses.length === 0
          ? !listChanged && <EmptyState icon={<Icons.Hand size={20} />} title={t("presence.empty")} description={t("presence.emptyHint")} />
          : groups.map(({ group, items }) => (
              <View key={group} testID={`group.presence.${group}`}>
                <GroupTitle group={group} items={items} />
                <List>
                  {items.map((item) => (
                    <CourseRow key={item.course.code} item={item} group={group} context={context} />
                  ))}
                </List>
              </View>
            ))}
      </View>

      {courses.length > 0 && sixConnected && !lectures && <Footer attendance={attendance} />}
      {courses.length > 0 && <HowCounted lastDay={attendance.lastDay} />}

      {showTargets && (
        <TargetsSheet
          courses={courses.map((c) => ({ code: c.course.code, name: name(c.course.code, c.course.name), color: c.course.color }))}
          open={targets.open}
          onClose={() => openTargets(false)}
          focus={targets.focus}
        />
      )}
    </>
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

/** "Target 80%": the targets, a sheet away. */
function TargetsButton({ range, onPress }: { range: string; onPress: () => void }) {
  const t = useT();
  return (
    <Button icon={<Icons.Target size={16} />} onPress={onPress} testID="action.target">
      <Text size="small" weight="semibold">
        {t("presence.targets.button")}{" "}
        <Text size="small" tone="muted" tabular>
          {range}
        </Text>
      </Text>
    </Button>
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
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], marginBottom: space[3] }}>
      <Icon size={18} color={theme.color[tone]} weight={bold ? "bold" : "regular"} />
      <Text size="title" weight="semibold" accessibilityRole="header" style={{ flex: 1 }}>
        {groupLabel(t, group, items)}
        <Text size="title" weight="medium" tone="faint" tabular>
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
    <Text size="lead" tone="muted">
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
