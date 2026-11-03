// The Pertemuan tab on the phone (round 2, v4; src/app/screens/course/meetings.tsx): SIX's timetable (official time
// and room) merged with Edunex Presence (the window and what Edunex recorded) and meetings announced only in Edunex
// text, as rows in one white card. A row: the day's tile, what the meeting is, one line of its facts (time, room, the
// window, the lecturer's note), and its one status as a chip (Presensi dibuka, Hadir, Berikutnya). An exam period is a
// line in the card before its first meeting. A row with something to do is one target: the open window, or joining.
// How SIX and Edunex share the count is said in the course's sheet; signed out of SIX, Edunex's own tally here.
import { useState } from "react";
import { View } from "react-native";
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
import { BigButton } from "../../ui/big-button";
import { EmptyState } from "../../ui/display";
import { IconTile } from "../../ui/icon-tile";
import { Icons } from "../../ui/icons";
import { Sheet } from "../../ui/sheet";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { CardGroup, type ChipTone, StatusChip, TileRow } from "../../ui/v4-list";
import { Fact } from "./course-sheet";

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

  return (
    <View>
      {/* Signed out of SIX: Edunex's own tally, and the way back to SIX's count. */}
      {countedIn === "noSix" && !noEdunexPresence && health && <NoSixIntro recorded={health.edunexRecorded} closed={health.edunexClosed} />}
      {meetings.length === 0 ? (
        sixSignedOut ? (
          <SixEmptyState icon={<Icons.Calendar size={20} color={theme.color.muted} />} title={t("meeting.noSix")} />
        ) : (
          <EmptyState icon={<Icons.Calendar size={20} color={theme.color.muted} />} title={t("meeting.none")} />
        )
      ) : (
        <CardGroup testID="list.meetings">
          {meetings.map((meeting, index) => {
            const period = periodOf(meeting);
            const firstInPeriod = period !== undefined && (index === 0 || periodOf(meetings[index - 1]!) !== period);
            return (
              <View key={meeting.key}>
                {firstInPeriod && <PeriodLine period={period} first={index === 0} />}
                <MeetingRow
                  meeting={meeting}
                  first={index === 0 || firstInPeriod}
                  next={index === next}
                  countedIn={countedIn}
                  moduleTitle={meetingModuleTitle(t, modules, meeting)}
                  fallbackUrl={course.edunex ? edunexCourseUrl(course.edunex.courseId) : null}
                  sixResult={meeting.six ? (attendance?.results[meeting.six.id]?.result ?? null) : null}
                />
              </View>
            );
          })}
        </CardGroup>
      )}
    </View>
  );
}

/** Signed out of SIX: Edunex's own tally as a fact, and why it may not be the count that matters. */
function NoSixIntro({ recorded, closed }: { recorded: number; closed: number }) {
  const t = useT();
  const v = useTheme().v4;
  const { signIn, busy } = useSignIn();
  return (
    <View style={{ gap: space[2], marginBottom: space[4] }}>
      {closed > 0 && (
        <Text size="titleMedium" face="display" weight="bold" tabular style={{ color: v.fg }}>
          {t("presence.edunexTally", { recorded, closed })}
        </Text>
      )}
      <Text size="bodyMedium" style={{ color: v.muted }}>
        {t("meeting.noSixCount")}
      </Text>
      <BigButton variant="outline" onPress={busy ? undefined : () => void signIn("six")}>
        {t("presence.signInSix")}
      </BigButton>
    </View>
  );
}

/** "UTS · 12 Okt–16 Okt": a line in the card before the period's first meeting. */
function PeriodLine({ period, first }: { period: CalendarEvent; first: boolean }) {
  const t = useT();
  const f = useFormat();
  const v = useTheme().v4;
  return (
    <View
      accessibilityRole="header"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space[2],
        paddingHorizontal: 14,
        paddingVertical: space[2],
        backgroundColor: v.ambBg,
        ...(first ? {} : { borderTopWidth: 1, borderTopColor: v.line }),
      }}
    >
      <Icons.GraduationCap size={16} color={v.ambFg} />
      <Text size="labelLarge" weight="semibold" tabular style={{ color: v.ambFg }}>
        {t("meeting.examPeriod", {
          period: t(period.kind === "uts" ? "calendar.kind.uts" : "calendar.kind.uas"),
          from: f.dayMonth(dayStart(period.firstDay)),
          to: f.dayMonth(dayStart(period.lastDay)),
        })}
      </Text>
    </View>
  );
}

/** The day's tile: its date big, its month under it; the next meeting's in the brand's tint, past ones quiet. */
function DateTile({ at, next, past }: { at: number; next: boolean; past: boolean }) {
  const f = useFormat();
  const v = useTheme().v4;
  // "8 Okt" / "8 Oct": the day, then the month.
  const [day, month] = f.dayMonth(at).split(/\s+/);
  const [bg, fg] = next ? [v.brandTint, v.brandInk] : [v.chip, past ? v.muted : v.fg];
  return (
    <IconTile tint={bg}>
      <Text size="titleMedium" face="display" weight="bold" tabular style={{ color: fg, fontSize: 17, lineHeight: 19 }}>
        {day ?? ""}
      </Text>
      <Text size="labelSmall" weight="medium" style={{ color: fg, fontSize: 11, lineHeight: 13 }}>
        {month ?? ""}
      </Text>
    </IconTile>
  );
}

function MeetingRow({
  meeting,
  first,
  next,
  countedIn,
  moduleTitle,
  fallbackUrl,
  sixResult,
}: {
  meeting: Meeting;
  first: boolean;
  next: boolean;
  countedIn: CountedIn;
  moduleTitle: string | null;
  fallbackUrl: string | null;
  /** What SIX's count did after this class, where the app saw (never for two classes sharing one count). */
  sixResult: AfterClass | null;
}) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const v = useTheme().v4;
  const open = useOpenExternal();
  const [sheet, setSheet] = useState(false);
  const state = meetingState(meeting, now);
  const { six, presence, announced } = meeting;
  const named = presence?.topic ?? six?.activity ?? null;
  // Unnamed, only numbered ("Pertemuan 3") or just "Kuliah", with no module to name it: said in a quieter colour.
  const placeholder = !moduleTitle && (!named || /^((pertemuan|meeting)\s*\d+|kuliah)$/i.test(named.trim()));
  const title = meetingTitle(t, meeting, moduleTitle);
  const date = `${f.weekdayShort(meeting.start)}, ${f.dayMonth(meeting.start)}`;
  // Edunex's Presence window, when it isn't simply the meeting's time.
  const window =
    presence && (presence.opensAt !== meeting.start || presence.closesAt !== meeting.end) ? f.timeRange(presence.opensAt, presence.closesAt) : null;
  const presenceUrl = presence?.url ?? fallbackUrl;
  // An open window asks for you (amber) only where Edunex may be what counts.
  const quiet = countedIn === "six" || countedIn === "noSix";

  // The one status: what asks something first, then what happened, then what's next.
  let status: { tone: ChipTone; text: string } | null = null;
  if (state === "open") status = { tone: quiet ? "neutral" : "amber", text: t("meeting.state.open") };
  else if (state === "present") status = { tone: "ok", text: t("meeting.state.present") };
  else if (next) status = { tone: "brand", text: t("meeting.next") };
  // Not recorded in Edunex: said only where Edunex is (or, without SIX, may be) what counts.
  else if (state === "unmarked" && countedIn !== "six")
    status = { tone: countedIn === "edunex" ? "amber" : "neutral", text: t("meeting.edunexNotRecordedCounts") };
  else if (state === "recorded") status = { tone: "neutral", text: t("meeting.state.recorded") };
  // A meeting that's over and asks nothing: "Selesai", quietly, at the end of its line.
  const done = !status && (state === "held" || state === "unmarked");
  // Not in SIX: the chip when there's no other, else in the line.
  const notInSix = meeting.notInSix && !status ? { tone: "amber" as const, text: t("meeting.notInSix") } : null;
  const chip = status ?? notInSix;

  // The row's one meta line is the time; the room, the window, the notes and what SIX did are in its sheet.
  const time = f.timeRange(meeting.start, meeting.end);
  const facts = [
    six?.room ?? "",
    announced?.online ? (announced.note ?? t("course.online")) : "",
    window ? t("meeting.window", { range: window }) : "",
    presence?.note ?? "",
    announced && !presence && announced.note && !announced.online ? announced.note : "",
  ].filter(Boolean);
  const warned = [meeting.notInSix && !notInSix ? t("meeting.notInSix") : "", sixResult && sixResult !== "counted" ? t("meeting.sixNotCounted") : ""].filter(
    Boolean,
  );
  const quietFacts = [sixResult === "counted" ? t("meeting.sixCounted") : "", done ? t("meeting.done") : ""].filter(Boolean);

  // Something to do is the sheet's one button: the open window, or the online class to join.
  const join = announced?.link && meeting.end > now ? announced.link : null;
  const record = state === "open" && presenceUrl ? presenceUrl : null;
  const action = record ? { url: record, words: t("course.recordInEdunex") } : join ? { url: join, words: t("material.join") } : null;
  const label = [date, title, time, ...facts, ...warned, ...quietFacts, chip?.text].filter(Boolean).join(", ");
  return (
    <>
      <TileRow
        testID={`row.meeting.${meeting.key}`}
        first={first}
        leading={<DateTile at={meeting.start} next={next} past={meeting.end <= now} />}
        title={
          <Text size="bodyLarge" weight="medium" numberOfLines={2} style={{ color: placeholder ? v.muted : v.fg, lineHeight: 21 }}>
            {title}
          </Text>
        }
        meta={time}
        status={chip ? <StatusChip tone={chip.tone}>{chip.text}</StatusChip> : undefined}
        // Every meeting opens its sheet: one target, one outcome.
        onPress={() => setSheet(true)}
        label={label}
      />
      <Sheet
        open={sheet}
        onClose={() => setSheet(false)}
        background={v.card}
        testID="sheet.meeting"
        title={
          <View style={{ gap: 2 }}>
            <Text size="bodyMedium" weight="medium" tabular style={{ color: v.muted }}>
              {date}
            </Text>
            <Text size="titleLarge" face="display" weight="bold" accessibilityRole="header" style={{ color: v.fg, fontSize: 20, lineHeight: 26 }}>
              {title}
            </Text>
          </View>
        }
        footer={
          action ? (
            <BigButton
              icon={<Icons.ArrowUpRight size={18} color={v.onBrand} />}
              onPress={() => {
                setSheet(false);
                open(action.url);
              }}
              testID="action.meeting"
            >
              {action.words}
            </BigButton>
          ) : undefined
        }
      >
        <View style={{ paddingBottom: space[2] }}>
          <Fact icon={(c) => <Icons.Clock size={22} color={c} />}>{time}</Fact>
          {chip && <Fact icon={(c) => <Icons.Flag size={22} color={c} />}>{chip.text}</Fact>}
          {facts.map((text) => (
            <Fact key={text} icon={(c) => <Icons.Info size={22} color={c} />}>
              {text}
            </Fact>
          ))}
          {warned.map((text) => (
            <Fact key={text} tone="warning" icon={(c) => <Icons.AlertTriangle size={22} color={c} />}>
              {text}
            </Fact>
          ))}
          {quietFacts.map((text) => (
            <Fact key={text} icon={(c) => <Icons.Check size={22} color={c} />}>
              {text}
            </Fact>
          ))}
        </View>
      </Sheet>
    </>
  );
}
