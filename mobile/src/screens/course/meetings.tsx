// The Pertemuan tab on the phone (round 3, after the blind reviews; src/app/screens/course/meetings.tsx): SIX's timetable
// (official time and room) merged with Edunex Presence (the window and what Edunex recorded) and meetings announced only
// in Edunex text. Two cards: "Sudah lewat", newest first, every past meeting the app knows with its mark at the end
// (Hadir, Tidak hadir, Belum dihitung, or a quiet "Tak tercatat" where nobody can say), and under them one quiet row
// for the meetings SIX counted that the app never saw one by one ("8 pertemuan sebelum 5 Nov", with how many of them
// were attended when SIX's count says it), so the list adds up to the meter at the top; then "Akan datang". The count
// itself is the header's meter and the course's sheet, not said again here (one fact, one place). The class on now,
// the next one and an open window are above the tabs (./now.tsx), so they aren't rows here. A row: the day's tile, the
// meeting's topic when it has one, else its time (the tile says the day). An exam period is a line before its
// meetings. Every row opens its sheet (the room, the window, the lecturer's note, the way to act). Signed out of SIX,
// Edunex's own tally here.
import { type ReactNode, useState } from "react";
import { View } from "react-native";
import { useAttendance } from "../../../../src/app/attendance";
import { useOpenExternal } from "../../../../src/app/hooks";
import { useFormat, useNow, useT } from "../../../../src/app/i18n";
import type { CoursePage } from "../../../../src/app/screens/course/data";
import { useDataset, useStatus } from "../../../../src/app/store";
import type { ClassResult, CountedIn } from "../../../../src/core/attendance";
import { type OutlineEntry, outlineEntries } from "../../../../src/core/course-materials";
import { type Meeting, meetingModules, meetingState, wibDay } from "../../../../src/core/course-meetings";
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
import { CardGroup, SectionTitle, StatusChip, TileRow } from "../../ui/v4-list";
import { Fact } from "./course-sheet";
import { type Earlier, earlierMeetings } from "./earlier";
import { shownAbove } from "./now";

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
  const modules = pageModules(page);
  const periods = (calendar?.events ?? []).filter((e) => e.kind === "uts" || e.kind === "uas");
  const periodOf = (meeting: Meeting) => periods.find((p) => wibDay(meeting.start) >= p.firstDay && wibDay(meeting.start) <= p.lastDay);
  // The class on now, the next one and an open window are above the tabs: not again here.
  const above = shownAbove(page, now);
  const listed = meetings.filter((m) => !above.has(m.key));
  const past = listed.filter((m) => m.end <= now).reverse();
  const coming = listed.filter((m) => m.end > now);
  // What SIX's count did after a class the app watched (the last two weeks), by SIX's meeting id.
  const results = attendance?.results ?? {};
  // The meetings SIX counted that the app never saw one by one (before the months it read): one quiet row under the
  // rest, so the list adds up to the count. Where Edunex keeps the count, every window is listed already.
  const earlier = countedIn === "six" || countedIn === "both" || countedIn === "unknown" ? earlierMeetings(meetings, now, health, results) : null;
  /** One card of rows, with an exam period's line before its first meeting (in the order shown). */
  const card = (list: readonly Meeting[], testID: string, after?: ReactNode) => (
    <CardGroup testID={testID}>
      {list.map((meeting, index) => {
        const period = periodOf(meeting);
        const startsPeriod = period !== undefined && (index === 0 || periodOf(list[index - 1]!) !== period);
        return (
          <View key={meeting.key}>
            {startsPeriod && <PeriodLine period={period} first={index === 0} />}
            <MeetingRow
              meeting={meeting}
              first={index === 0 || startsPeriod}
              countedIn={countedIn}
              result={meeting.six ? results[meeting.six.id] : undefined}
              moduleTitle={meetingModuleTitle(t, modules, meeting)}
              fallbackUrl={course.edunex ? edunexCourseUrl(course.edunex.courseId) : null}
            />
          </View>
        );
      })}
      {after}
    </CardGroup>
  );

  return (
    <View>
      {/* Signed out of SIX: Edunex's own tally, and the way back to SIX's count. */}
      {countedIn === "noSix" && !noEdunexPresence && health && <NoSixIntro recorded={health.edunexRecorded} closed={health.edunexClosed} />}
      {meetings.length === 0 && !earlier ? (
        sixSignedOut ? (
          <SixEmptyState icon={<Icons.Calendar size={20} color={theme.color.muted} />} title={t("meeting.noSix")} />
        ) : (
          <EmptyState icon={<Icons.Calendar size={20} color={theme.color.muted} />} title={t("meeting.none")} />
        )
      ) : (
        <View style={{ gap: space[2] }}>
          {(past.length > 0 || earlier) && (
            <View>
              <SectionTitle first>{t("mobile.meeting.past")}</SectionTitle>
              {card(past, "list.meetings.past", earlier ? <EarlierRow earlier={earlier} first={past.length === 0} /> : undefined)}
            </View>
          )}
          {coming.length > 0 && (
            <View style={past.length > 0 || earlier ? { marginTop: space[4] } : undefined}>
              <SectionTitle first>{t("meeting.state.upcoming")}</SectionTitle>
              {card(coming, "list.meetings.coming")}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

/** "8 pertemuan sebelum 5 Nov" under the listed ones, with "Hadir 4 · tidak hadir 4" when SIX's count tells it. */
function EarlierRow({ earlier, first }: { earlier: Earlier; first: boolean }) {
  const t = useT();
  const f = useFormat();
  const v = useTheme().v4;
  const title =
    earlier.before !== null
      ? t("mobile.meeting.earlier", { count: earlier.count, date: f.dayMonth(earlier.before) })
      : t("mobile.meeting.earlierAll", { count: earlier.count });
  const meta =
    earlier.attended !== null
      ? t("mobile.meeting.earlierSplit", { attended: earlier.attended, absent: earlier.count - earlier.attended })
      : t("mobile.meeting.totalOnly");
  return (
    <TileRow
      testID="row.meetingsEarlier"
      first={first}
      leading={
        <IconTile tint={v.chip}>
          <Icons.History size={20} color={v.muted} />
        </IconTile>
      }
      title={
        <Text size="bodyLarge" weight="medium" tabular style={{ color: v.fg2, lineHeight: 21 }}>
          {title}
        </Text>
      }
      meta={meta}
      label={`${title}, ${meta}`}
    />
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
      {/* An exam period, as Jadwal marks one (the flag); the cap is the Akademik tab's alone. */}
      <Icons.Flag size={16} color={v.ambFg} />
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

/** The day's tile: its date big, its month under it; past ones quiet. */
function DateTile({ at, past }: { at: number; past: boolean }) {
  const f = useFormat();
  const v = useTheme().v4;
  // "8 Okt" / "8 Oct": the day, then the month.
  const [day, month] = f.dayMonth(at).split(/\s+/);
  const fg = past ? v.muted : v.fg;
  return (
    <IconTile tint={v.chip}>
      <Text size="titleMedium" face="display" weight="bold" tabular style={{ color: fg, fontSize: 17, lineHeight: 19 }}>
        {day ?? ""}
      </Text>
      <Text size="labelSmall" weight="medium" style={{ color: fg, fontSize: 11, lineHeight: 13 }}>
        {month ?? ""}
      </Text>
    </IconTile>
  );
}

/** A past meeting's mark: what SIX's count or Edunex says about it, or nothing anyone can say ("Tak tercatat"). */
type Mark = { kind: "present" | "absent" | "missing" | "unknown"; words: string; label: string };

/**
 * What's known about one past meeting, the most official first: what SIX's count did after it (the app watched it
 * go up, or not); then Edunex's record where Edunex has one (Hadir), or where Edunex is the only record (not recorded
 * reads as absent there); else nobody can say: SIX gives totals only, and Edunex not recording it isn't an absence.
 */
function markOf(t: T, meeting: Meeting, countedIn: CountedIn, result: ClassResult | undefined, now: number): Mark {
  if (result?.result === "counted") return { kind: "present", words: t("meeting.state.present"), label: t("mobile.meeting.countedSix") };
  if (result?.result === "absent") return { kind: "absent", words: t("mobile.meeting.absent"), label: t("mobile.meeting.absentSix") };
  if (result?.result === "missing") return { kind: "missing", words: t("mobile.meeting.missing"), label: t("mobile.meeting.missingSix") };
  const state = meetingState(meeting, now);
  if (state === "present") return { kind: "present", words: t("meeting.state.present"), label: t("meeting.edunexPresent") };
  if ((state === "unmarked" || state === "recorded") && countedIn === "edunex")
    return { kind: "absent", words: t("mobile.meeting.absent"), label: t("meeting.edunexNotRecordedCounts") };
  return { kind: "unknown", words: t("mobile.meeting.untracked"), label: t("mobile.meeting.unknown") };
}

function MeetingRow({
  meeting,
  first,
  countedIn,
  result,
  moduleTitle,
  fallbackUrl,
}: {
  meeting: Meeting;
  first: boolean;
  countedIn: CountedIn;
  result: ClassResult | undefined;
  moduleTitle: string | null;
  fallbackUrl: string | null;
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
  // A topic only when something names it: its module, a name that isn't just "Kuliah" or "Pertemuan 3".
  const topic = moduleTitle ?? (named && !/^((pertemuan|meeting)\s*\d+|kuliah)$/i.test(named.trim()) ? named.trim() : null);
  const title = meetingTitle(t, meeting, moduleTitle);
  const date = `${f.weekdayShort(meeting.start)}, ${f.dayMonth(meeting.start)}`;
  const time = f.timeRange(meeting.start, meeting.end);
  // Without a topic the row is its time ("16:00–17:50": the tile says the day, round 3's third review); with one, the
  // time goes under it. Its weekday is in what TalkBack reads.
  const when = time;
  const past = meeting.end <= now;
  // Edunex's Presence window, when it isn't simply the meeting's time.
  const window =
    presence && (presence.opensAt !== meeting.start || presence.closesAt !== meeting.end) ? f.timeRange(presence.opensAt, presence.closesAt) : null;
  const presenceUrl = presence?.url ?? fallbackUrl;
  // An open window asks for you (amber): no system says whether the lecturer uses it. Without SIX (nobody can say),
  // the intro above says it once and the row stays calm.
  const quiet = countedIn === "noSix";
  const mark = past && state !== "open" ? markOf(t, meeting, countedIn, result, now) : null;
  const notInSix = meeting.notInSix ? t("meeting.notInSix") : null;

  // The row's one meta line is the time (and "Hanya di Edunex"); the room, the window and the notes are in its sheet.
  const facts = [
    six?.room ?? "",
    announced?.online ? (announced.note ?? t("course.online")) : "",
    window ? t("meeting.window", { range: window }) : "",
    presence?.note ?? "",
    announced && !presence && announced.note && !announced.online ? announced.note : "",
  ].filter(Boolean);
  // Not in SIX, and why, in the sheet (the desktop's tooltip).
  const warned = meeting.notInSix ? [t("meeting.notInSixWhy")] : [];

  // Something to do is the sheet's one button: the open window, or the online class to join.
  const join = announced?.link && meeting.end > now ? announced.link : null;
  const record = state === "open" && presenceUrl ? presenceUrl : null;
  const action = record ? { url: record, words: t("course.recordInEdunex") } : join ? { url: join, words: t("material.join") } : null;
  const status =
    state === "open" ? <StatusChip tone={quiet ? "neutral" : "amber"}>{t("meeting.state.open")}</StatusChip> : mark ? <MarkView mark={mark} /> : undefined;
  const label = [date, topic ?? f.weekday(meeting.start), time, ...facts, ...warned, state === "open" ? t("meeting.state.open") : mark?.label, notInSix]
    .filter(Boolean)
    .join(", ");
  return (
    <>
      <TileRow
        testID={`row.meeting.${meeting.key}`}
        first={first}
        leading={<DateTile at={meeting.start} past={past} />}
        title={
          <Text size="bodyLarge" weight="medium" tabular={!topic} numberOfLines={2} style={{ color: v.fg, lineHeight: 21 }}>
            {topic ?? when}
          </Text>
        }
        meta={topic || notInSix ? [topic ? time : null, notInSix].filter(Boolean).join(" · ") : undefined}
        status={status}
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
          {mark && mark.kind !== "unknown" && <Fact icon={(c) => <Icons.Flag size={22} color={c} />}>{mark.label}</Fact>}
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
        </View>
      </Sheet>
    </>
  );
}

/** A past meeting's mark at its row's end: an icon and a word in its tone ("Hadir"), or a quiet "Tak tercatat" nobody can fill. */
function MarkView({ mark }: { mark: Mark }) {
  const v = useTheme().v4;
  if (mark.kind === "unknown")
    return (
      <Text testID="mark.meeting.unknown" size="bodyMedium" weight="medium" style={{ color: v.muted, flexShrink: 0 }}>
        {mark.words}
      </Text>
    );
  const ink = mark.kind === "present" ? v.okFg : mark.kind === "absent" ? v.redFg : v.ambFg;
  const Glyph = mark.kind === "present" ? Icons.CheckCircle : Icons.AlertTriangle;
  return (
    <View testID={`mark.meeting.${mark.kind}`} style={{ flexDirection: "row", alignItems: "center", gap: space[1], flexShrink: 0 }}>
      <Glyph size={16} weight="fill" color={ink} />
      <Text size="bodyMedium" weight="semibold" style={{ color: ink }}>
        {mark.words}
      </Text>
    </View>
  );
}
