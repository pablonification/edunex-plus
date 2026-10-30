// The Pertemuan tab on the phone (src/app/screens/course/meetings.tsx): SIX's timetable (official
// time and room) merged with Edunex Presence (the window and what Edunex recorded) and meetings
// announced only in Edunex text. SIX's count is the official one; Edunex's record per meeting is a
// quiet second line, and a meeting Edunex didn't record never reads as an absence where SIX is (or,
// signed out of SIX, may be) the one that counts. One meeting a row: its day and time, then what
// it is with its facts, then its state and its one action under them.
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useAttendance } from "../../../../src/app/attendance";
import { useOpenExternal } from "../../../../src/app/hooks";
import { useFormat, useNow, useT } from "../../../../src/app/i18n";
import type { CoursePage } from "../../../../src/app/screens/course/data";
import { useDataset, useStatus } from "../../../../src/app/store";
import type { AfterClass, CountedIn } from "../../../../src/core/attendance";
import { type OutlineEntry, outlineEntries } from "../../../../src/core/course-materials";
import { type Meeting, meetingModules, meetingState, nextMeetingIndex, wibDay } from "../../../../src/core/course-meetings";
import { edunexCourseUrl } from "../../../../src/core/links";
import type { CalendarEvent } from "../../../../src/core/models";
import { dayStart } from "../../../../src/core/schedule";
import { SixEmptyState, useSignIn } from "../../shell/source-status";
import { Button } from "../../ui/controls";
import { EmptyState, LiveDot, Tag } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { Meta } from "../../ui/layout";
import { Text } from "../../ui/text";
import { radius, space, useTheme } from "../../ui/theme";

type T = ReturnType<typeof useT>;

/** Each meeting's Edunex module, where one goes with it (see meetingModules). From src/app/screens/course/meetings.tsx. */
export const pageModules = (page: CoursePage) =>
  meetingModules(page.meetings, page.outline && page.course.edunex ? outlineEntries(page.outline, page.course.edunex.courseId) : []);

/** "Modul 7 · Inovasi Pelayanan Publik" for a meeting known only as a class. From src/app/screens/course/meetings.tsx. */
export function meetingModuleTitle(t: T, modules: ReadonlyMap<string, OutlineEntry>, meeting: Meeting): string | null {
  const named = meeting.presence?.topic ?? meeting.six?.activity ?? null;
  // A meeting Edunex or SIX names or numbers keeps that: one number per meeting.
  if (meeting.announced || (named && !/^kuliah$/i.test(named.trim()))) return null;
  const entry = modules.get(meeting.key);
  return entry ? t("meeting.module", { no: entry.number, title: entry.module.title.trim() }) : null;
}

/** What a meeting is called, the same on its row and on the card above the tabs. From src/app/screens/course/meetings.tsx. */
export function meetingTitle(t: T, meeting: Meeting, moduleTitle: string | null): string {
  const named = meeting.presence?.topic?.trim() || meeting.six?.activity?.trim() || null;
  // SIX calls nearly every class "Kuliah": Edunex's number for it says more.
  const telling = named && !/^kuliah$/i.test(named) ? named : null;
  return moduleTitle ?? telling ?? (meeting.announced ? t("meeting.number", { no: meeting.announced.number }) : (named ?? t("meeting.untitled")));
}

export function MeetingsTab({ page }: { page: CoursePage }) {
  const t = useT();
  const now = useNow();
  const theme = useTheme();
  const attendance = useAttendance();
  const calendar = useDataset("itb.calendar");
  const { meetings, course, presence } = page;
  const health = attendance?.courses.find((c) => c.course.code === course.code)?.health;
  const countedIn = health?.countedIn ?? "unknown";
  const noEdunexPresence = presence !== undefined && presence.length === 0;
  const sixSignedOut = useStatus("six").state === "signed-out";
  const next = nextMeetingIndex(meetings, now);
  const modules = pageModules(page);
  const periods = (calendar?.events ?? []).filter((e) => e.kind === "uts" || e.kind === "uas");
  // The exam period a meeting falls in, said once, before its first meeting.
  const periodOf = (meeting: Meeting) => periods.find((p) => wibDay(meeting.start) >= p.firstDay && wibDay(meeting.start) <= p.lastDay);
  const intro = noEdunexPresence
    ? t("meeting.noEdunexPresence")
    : countedIn === "edunex"
      ? t("meeting.edunexCounts")
      : course.attendance && presence?.length
        ? t("meeting.sixTotalsOnly")
        : null;

  return (
    <View>
      {/* How SIX and Edunex share the count; the count itself is the header's meter, not said again here. */}
      {countedIn === "noSix" && !noEdunexPresence && health ? (
        <View style={{ marginBottom: space[5] }}>
          <NoSixIntro recorded={health.edunexRecorded} closed={health.edunexClosed} />
        </View>
      ) : intro ? (
        <Text size="small" tone="muted" style={{ marginBottom: space[5] }}>
          {intro}
        </Text>
      ) : null}
      {meetings.length === 0 ? (
        sixSignedOut ? (
          <SixEmptyState icon={<Icons.Calendar size={20} color={theme.color.muted} />} title={t("meeting.noSix")} />
        ) : (
          <EmptyState icon={<Icons.Calendar size={20} color={theme.color.muted} />} title={t("meeting.none")} />
        )
      ) : (
        <View style={[styles.list, { borderColor: theme.color.edge, backgroundColor: theme.color.surface }]}>
          {meetings.map((meeting, index) => {
            const period = periodOf(meeting);
            const firstInPeriod = period && (index === 0 || periodOf(meetings[index - 1]!) !== period);
            return (
              <MeetingRow
                key={meeting.key}
                meeting={meeting}
                index={index}
                next={index === next}
                countedIn={countedIn}
                moduleTitle={meetingModuleTitle(t, modules, meeting)}
                divider={firstInPeriod ? period : undefined}
                fallbackUrl={course.edunex ? edunexCourseUrl(course.edunex.courseId) : null}
                sixResult={meeting.six ? (attendance?.results[meeting.six.id]?.result ?? null) : null}
              />
            );
          })}
        </View>
      )}
    </View>
  );
}

/** Signed out of SIX: Edunex's own tally as a fact, and why it may not be the count that matters. */
function NoSixIntro({ recorded, closed }: { recorded: number; closed: number }) {
  const t = useT();
  const { signIn, busy } = useSignIn();
  return (
    <View style={{ gap: space[2], alignItems: "flex-start" }}>
      {closed > 0 && (
        <Text size="lead" weight="semibold">
          {t("presence.edunexTally", { recorded, closed })}
        </Text>
      )}
      <Text size="small" tone="muted">
        {t("meeting.noSixCount")}
      </Text>
      <Button busy={busy} onPress={() => void signIn("six")}>
        {t("presence.signInSix")}
      </Button>
    </View>
  );
}

function PeriodDivider({ period }: { period: CalendarEvent }) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space[2],
        paddingHorizontal: space[4],
        paddingVertical: space[1.5],
        backgroundColor: theme.color.warningBg,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: theme.color.line,
      }}
    >
      <Icons.GraduationCap size={14} color={theme.color.warningFg} />
      <Text size="small" weight="semibold" tone="warning">
        {t("meeting.examPeriod", {
          period: t(period.kind === "uts" ? "calendar.kind.uts" : "calendar.kind.uas"),
          from: f.dayMonth(dayStart(period.firstDay)),
          to: f.dayMonth(dayStart(period.lastDay)),
        })}
      </Text>
    </View>
  );
}

function MeetingRow({
  meeting,
  index,
  next,
  countedIn,
  moduleTitle,
  divider,
  fallbackUrl,
  sixResult,
}: {
  meeting: Meeting;
  index: number;
  next: boolean;
  countedIn: CountedIn;
  moduleTitle: string | null;
  divider: CalendarEvent | undefined;
  fallbackUrl: string | null;
  /** What SIX's count did after this class, where the app saw (never for two classes sharing one count). */
  sixResult: AfterClass | null;
}) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const theme = useTheme();
  const open = useOpenExternal();
  const state = meetingState(meeting, now);
  const { six, presence, announced } = meeting;
  const named = presence?.topic ?? six?.activity ?? null;
  // Unnamed, only numbered ("Pertemuan 3") or just "Kuliah", with no module to name it: said in a quieter color.
  const placeholder = !moduleTitle && (!named || /^((pertemuan|meeting)\s*\d+|kuliah)$/i.test(named.trim()));
  const title = meetingTitle(t, meeting, moduleTitle);
  // Edunex's Presence window, when it isn't simply the meeting's time.
  const window =
    presence && (presence.opensAt !== meeting.start || presence.closesAt !== meeting.end) ? f.timeRange(presence.opensAt, presence.closesAt) : null;
  const presenceUrl = presence?.url ?? fallbackUrl;
  const future = meeting.start > now;
  // An open window asks for you (amber, primary) only where Edunex may be what counts.
  const quiet = countedIn === "six" || countedIn === "noSix";
  const c = theme.color;
  // Where it is, how, when its window runs and what the lecturer added: one line of facts, "·" between them.
  const facts = [
    six?.room ? (
      <View key="room" style={styles.withIcon}>
        <Icons.MapPin size={12} color={c.muted} />
        <Text size="small" tone="muted">
          {six.room}
        </Text>
      </View>
    ) : (
      ""
    ),
    announced?.online ? (
      <View key="online" style={styles.withIcon}>
        <Icons.Video size={12} color={c.muted} />
        <Text size="small" tone="muted" style={{ flexShrink: 1 }}>
          {announced.note ?? t("course.online")}
        </Text>
      </View>
    ) : (
      ""
    ),
    window ? t("meeting.window", { range: window }) : "",
    presence?.note ?? "",
    announced && !presence && announced.note && !announced.online ? announced.note : "",
    meeting.notInSix ? (
      <Text key="notInSix" size="small" weight="medium" tone="warning">
        {t("meeting.notInSix")}
      </Text>
    ) : (
      ""
    ),
    sixResult === "counted" ? (
      <View key="six" style={styles.withIcon}>
        <Icons.CheckCircle size={12} color={c.successFg} weight="bold" />
        <Text size="small" tone="muted" style={{ flexShrink: 1 }}>
          {t("meeting.sixCounted")}
        </Text>
      </View>
    ) : sixResult ? (
      <Text key="six" size="small" weight="medium" tone="warning">
        {t("meeting.sixNotCounted")}
      </Text>
    ) : (
      ""
    ),
  ];

  let status: ReactNode = null;
  if (state === "present")
    status = (
      <Tag tone="success" size="md">
        <Icons.CheckCircle size={12} color={c.successFg} weight="bold" />
        <Text size="caption" weight="semibold" tone="success">
          {t("meeting.state.present")}
        </Text>
      </Tag>
    );
  else if (state === "open")
    status = (
      <Tag tone={quiet ? "neutral" : "warning"} size="md">
        <LiveDot />
        <Text size="caption" weight="semibold" style={{ color: quiet ? c.neutralFg : c.warningFg }} tabular>
          {t("meeting.state.open")}
          {presence ? (
            <Text size="caption" weight="regular" style={{ color: quiet ? c.neutralFg : c.warningFg }}>{`  ·  ${f.countdown(presence.closesAt)}`}</Text>
          ) : null}
        </Text>
      </Tag>
    );
  // Not recorded in Edunex: a warning only where Edunex is what counts; where SIX counts the intro says
  // it once and the row stays quiet; without SIX, a plain fact.
  else if (state === "unmarked")
    status =
      countedIn === "six" ? (
        <Text size="small" tone="faint">
          {t("meeting.done")}
        </Text>
      ) : (
        <Text size="small" tone={countedIn === "edunex" ? "warning" : "faint"} weight={countedIn === "edunex" ? "medium" : "regular"}>
          {t("meeting.edunexNotRecordedCounts")}
        </Text>
      );
  else if (state === "recorded")
    status = (
      <Text size="small" tone="faint">
        {t("meeting.state.recorded")}
      </Text>
    );
  else if (state === "held")
    status = (
      <Text size="small" tone="faint">
        {t("meeting.done")}
      </Text>
    );
  else if (next) status = <Tag tone="info">{t("meeting.next")}</Tag>;

  const join = announced?.link && meeting.end > now ? announced.link : null;
  const record = state === "open" && presenceUrl ? presenceUrl : null;

  return (
    <View testID={`row.meeting.${meeting.key}`} style={index > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line } : null}>
      {divider && <PeriodDivider period={divider} />}
      <View style={[styles.row, next && { backgroundColor: c.infoBg }]}>
        <View style={{ width: 92 }}>
          <Text size="body" weight="medium" tabular tone={future && !next ? "muted" : "fg"}>
            {`${f.weekdayShort(meeting.start)}, ${f.dayMonth(meeting.start)}`}
          </Text>
          <Text size="small" tone="muted" tabular>
            {f.timeRange(meeting.start, meeting.end)}
          </Text>
        </View>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text size="body" weight={placeholder ? "regular" : "medium"} tone={placeholder || (future && !next) ? "muted" : "fg"} numberOfLines={3}>
            {title}
          </Text>
          {facts.some(Boolean) && <Meta>{facts}</Meta>}
          {(status || join || record) && (
            <View style={{ marginTop: space[1.5], flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: space[2] }}>
              {status}
              {join && (
                <Button size="sm" icon={<Icons.Video size={14} />} onPress={() => open(join)}>
                  {t("material.join")}
                </Button>
              )}
              {record && (
                <Button
                  variant={quiet ? "secondary" : "primary"}
                  size="sm"
                  icon={<Icons.ArrowUpRight size={14} color={quiet ? c.fg : c.onAccent} />}
                  onPress={() => open(record)}
                >
                  {t("course.recordInEdunex")}
                </Button>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, overflow: "hidden" },
  row: { flexDirection: "row", gap: space[3], paddingHorizontal: space[4], paddingVertical: space[3] },
  withIcon: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 },
});
