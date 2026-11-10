// The bell: the history of everything the app noticed (src/app/shell/alerts.tsx), as a screen (round 2, v4). Every
// alert the engine raised joined with the changes it can see in the data itself (src/core/needs.ts alertFeed), so
// Beranda's "Yang berubah" is a preview of this list. On direction B's white page, by day (Hari ini, Kemarin, then the
// date), flat rows with a hairline between them: the kind's bare glyph in its course's colour (amber for what presses), the title with the course's
// name, one meta line (what changed, old → new, or the action and its deadline; a room on its own line, never cut), and
// at the row's end the time the thing itself happened (a Task posted, a Presence opening); none when only the time the
// app noticed it is known (SIX never dates a moved class: "00:45" read as the class's time). A small calm dot on each unread row, and the bell's dot on every tab, until "Tandai
// semua dibaca", the bar's one action while something is unread: both say the same thing. Nothing is ever marked in
// Edunex. A class's or a Presence's alert whose window is over says what happened, with no action left in it, and opens
// the course; a deadline's, once it has passed, says whether the Task was handed in, and opens the Task; an exam SIX lists in two weeks is a row per sitting, each
// with its full date, time and room (../src/screens/alerts/past.ts, ../../src/core/exam-sittings.ts: two dates in one
// row were hard to read); a meeting and its Teams link or material posted close by are one row
// (../src/screens/alerts/same-meeting.ts).
import { router } from "expo-router";
import { type ComponentType, useMemo, useState } from "react";
import { View } from "react-native";
import { useTermCourses } from "../../src/app/courses";
import { useHomeWorld } from "../../src/app/home-world";
import { useOpenCheckIn } from "../../src/app/hooks";
import { type Format, type Translate, useFormat, useNow, useT } from "../../src/app/i18n";
import { useBridge, useDataset, useStatus } from "../../src/app/store";
import { examSittings, sittingsLine } from "../../src/core/exam-sittings";
import type { Alert, AlertKind, ClassSession } from "../../src/core/models";
import { alertFeed } from "../../src/core/needs";
import { useNav } from "../src/nav";
import { changeLines, eventTime } from "../src/parts/change-meta";
import { NotificationsOff, useNotificationPermission } from "../src/parts/notifications-off";
import { usePerfDrawn } from "../src/perf";
import { type Outcome, type PastAlert, pastAlert } from "../src/screens/alerts/past";
import { type MeetingExtra, sameMeeting } from "../src/screens/alerts/same-meeting";
import { useShortCourseName } from "../src/screens/home/parts";
import { CourseMark, KindMark } from "../src/screens/search/parts";
import { BHeading, BRow, useB } from "../src/ui/b";
import { IconButton } from "../src/ui/controls";
import { Skeleton } from "../src/ui/display";
import { Rise } from "../src/ui/expressive";
import { haptic } from "../src/ui/haptics";
import { type IconProps, Icons } from "../src/ui/icons";
import { factsLabel, Page } from "../src/ui/layout";
import { Text } from "../src/ui/text";
import { space } from "../src/ui/theme";
import { TopBar } from "../src/ui/top-bar";

const KIND_ICON: Record<AlertKind, ComponentType<IconProps>> = {
  newTask: Icons.ListChecks,
  newMaterial: Icons.FileText,
  deadline: Icons.Clock,
  presenceOpen: Icons.Hand,
  presenceClosing: Icons.Hand,
  taskEdited: Icons.PenLine,
  taskHandedBack: Icons.HandedBack,
  taskComment: Icons.Chat,
  scheduleChanged: Icons.CalendarClock,
  meeting: Icons.Megaphone,
  attendanceRisk: Icons.AlertTriangle,
  exam: Icons.GraduationCap,
  grade: Icons.Star,
  krs: Icons.ShieldCheck,
  bill: Icons.Wallet,
  academic: Icons.CalendarClock,
  classSoon: Icons.MapPin,
};
const PRESSING = new Set<AlertKind>(["deadline", "presenceOpen", "presenceClosing", "attendanceRisk"]);

/** Days after the first rise together: the rest is below the fold anyway. */
const RISE_STEPS = 4;

/** A row: the alert, when it happened (null: not known), and the moment that places it. */
interface Row {
  /** The alert's id, or with its sitting's for an exam SIX lists more than once. */
  key: string;
  item: Alert;
  happened: number | null;
  at: number;
  /** Its class or Presence window is over: what happened. */
  past: PastAlert | null;
  /** An exam SIX lists more than once: this row's sitting. */
  sitting: ClassSession | null;
  /** A meeting's row: its Teams link or material, posted close by, folded into it. */
  joined: { material: Alert; extra: MeetingExtra } | null;
}

/** A day's rows, newest day first: 0 is today (a raised alert a minute ahead of the screen's clock too), -1 yesterday. */
interface Day {
  offset: number;
  /** When its newest row came (the day's date). */
  at: number;
  rows: Row[];
}

/** The day's heading: Hari ini, Kemarin, then the day the one way the app writes it ("Sen, 5 Okt"). */
function dayTitle(day: Day, t: Translate, f: Format): string {
  if (day.offset === 0) return t("alerts.period.today");
  if (day.offset === -1) return t("alerts.period.yesterday");
  return f.relativeDay(day.at);
}

export default function Alerts() {
  usePerfDrawn(true);
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const b = useB();
  const bridge = useBridge();
  const nav = useNav();
  const openCheckIn = useOpenCheckIn();
  const history = useDataset("app.alerts");
  const sixOut = useStatus("six").state === "signed-out";
  const world = useHomeWorld();
  const name = useShortCourseName();
  // Android's permission for notifications: off, the notice and its one button lead the page (as in Settings).
  const permission = useNotificationPermission();
  // Read up to: what the engine keeps (the bell's dot reads the same), or the moment the Student said so here.
  const [markedAt, setMarkedAt] = useState(0);
  const readAt = Math.max(history?.readAt ?? 0, markedAt);
  const items = useMemo(() => (world ? alertFeed(world, history?.items ?? []) : (history?.items ?? [])), [world, history]);
  const raised = useMemo(() => new Set((history?.items ?? []).map((item) => item.id)), [history]);
  // Each row's moment: when the thing happened, or, unknown, when the app saw it (only to place it under a day).
  const rows = useMemo(() => {
    const { sittings, folded } = examSittings(items, world?.schedule);
    // A meeting and its link or material: one row.
    const meetings = sameMeeting(items);
    // A class or window that's over: one row, its newest alert's place.
    const over = new Set<string>();
    return items
      .filter((item) => !folded.has(item.id) && !meetings.folded.has(item.id))
      .flatMap((item): Row[] => {
        const happened = eventTime(item, raised.has(item.id), world);
        const joined = meetings.joined.get(item.id) ?? null;
        const row = { key: item.id, item, happened, at: happened ?? item.at, past: pastAlert(item, world, now), sitting: null, joined };
        const each = sittings.get(item.id);
        // A row per sitting, each with its own date, time and room.
        return each?.length ? each.map((sitting) => ({ ...row, key: `${item.id}:${sitting.id}`, sitting })) : [row];
      })
      .sort((a, b) => b.at - a.at)
      .filter((row) => {
        if (!row.past) return true;
        if (over.has(row.past.key)) return false;
        over.add(row.past.key);
        return true;
      });
  }, [items, raised, world, now]);
  const isUnread = (item: Alert) => raised.has(item.id) && item.at > readAt;
  const anyUnread = items.some(isUnread);
  const days = useMemo(() => {
    const byOffset = new Map<number, Row[]>();
    for (const row of rows) {
      const offset = Math.min(0, f.dayOffset(row.at));
      const day = byOffset.get(offset);
      if (day) day.push(row);
      else byOffset.set(offset, [row]);
    }
    return [...byOffset].map(([offset, dayRows]): Day => ({ offset, at: dayRows[0]?.at ?? now, rows: dayRows })).sort((a, b) => b.offset - a.offset);
  }, [rows, f, now]);

  // One state for the list: the rows' shapes only while nothing at all has come; rows the moment any have; the empty
  // line once the history is read and there's nothing. Never placeholders beside real rows.
  const view: "loading" | "rows" | "empty" = rows.length > 0 ? "rows" : history === undefined ? "loading" : "empty";

  const markAllRead = () => {
    setMarkedAt(now);
    void bridge.invoke("alerts.markRead", {}).catch(() => undefined);
    haptic.confirm();
  };

  return (
    <Page
      testID="screen.alerts"
      background={b.page}
      header={
        <TopBar
          title={t("alerts.title")}
          actions={
            anyUnread ? (
              <IconButton label={t("alerts.markAllRead")} onPress={markAllRead} testID="action.markAllRead">
                <Icons.CheckCircle size={24} color={b.fg} />
              </IconButton>
            ) : undefined
          }
        />
      }
    >
      <NotificationsOff state={permission} />
      {view === "loading" && (
        // Still being read from the phone: the rows' shapes stand in, so nothing jumps when they come.
        <View testID="alerts.loading" style={{ gap: space[4], paddingTop: space[4] }}>
          {[0, 1, 2].map((at) => (
            <View key={at} style={{ flexDirection: "row", gap: space[4], alignItems: "center" }}>
              <Skeleton width={28} height={28} style={{ borderRadius: 14 }} />
              <View style={{ flex: 1, gap: space[2] }}>
                <Skeleton width="70%" />
                <Skeleton width="45%" height={12} />
              </View>
            </View>
          ))}
        </View>
      )}
      {view === "empty" && (
        // Calm: the bell, bare, and one line. Atur notifikasi under it is the next step.
        <Rise screen="alerts" index={0} style={{ alignItems: "center", gap: space[3], paddingTop: space[12], paddingBottom: space[6] }}>
          <Icons.Bell size={48} color={b.muted} />
          <Text size="bodyLarge" style={{ color: b.fg2, textAlign: "center" }} testID="alerts.empty">
            {t("alerts.empty")}
          </Text>
        </Rise>
      )}
      {view === "rows" &&
        days.map((day, index) => (
          <Rise key={day.offset} screen="alerts" index={Math.min(index, RISE_STEPS)}>
            <BHeading style={{ marginTop: index === 0 ? space[2] : space[6], marginBottom: space[1] }}>{dayTitle(day, t, f)}</BHeading>
            <View>
              {day.rows.map(({ key, item, happened, past, sitting, joined }, i) => {
                const unread = isUnread(item) || (joined !== null && isUnread(joined.material));
                const lines = changeLines(t, item, name);
                const outcome = past ? outcomeOf(t, past.outcome) : null;
                const title = past ? pastTitle(t, past, name(past.code)) : lines.title;
                // One fact once: a part of the meta line the title already says (a date in a material's name) is left out.
                const said = (text: string | null) =>
                  text
                    ? text
                        .split(" · ")
                        .filter((part) => !title.includes(part))
                        .join(" · ") || null
                    : null;
                const meta = past
                  ? (outcome?.text ?? null)
                  : sitting
                    ? sittingsLine(f, [sitting], { room: false })
                    : joined
                      ? t(joined.extra === "link" ? "mobile.change.meeting.withLink" : "mobile.change.meeting.withMaterial", { when: said(lines.meta) ?? "" })
                      : said(lines.meta);
                // A sitting's room on its own line, so it's never cut.
                const room = sitting?.room ?? null;
                const spoken = past ? [title, outcome?.text ?? null] : sitting || joined ? [lines.title, meta, room] : lines.spoken;
                // Every row its time, in one place and one form (the day is the heading's): when the thing happened, else
                // when the app saw it.
                const time = f.time(happened ?? item.at);
                // With a course, its glyph leads alone and the kind sits small before the second line (as Tugas's rows).
                const Kind = typeof item.title.vars?.course === "string" ? KIND_ICON[item.kind] : null;
                return (
                  <BRow
                    key={key}
                    testID={`row.alert.${key}`}
                    last={i === day.rows.length - 1}
                    // Unread first in what's read out, as the dot says it to the eye.
                    accessibilityLabel={factsLabel(unread ? t("alerts.unread") : null, ...spoken, time)}
                    leading={<KindTile item={item} past={past !== null} />}
                    title={title}
                    // One meta line: what changed, old → new, or the action and its deadline (short where the desktop's runs
                    // long or says how, ../src/parts/change-meta.ts).
                    meta={
                      outcome ? (
                        <View style={{ flexDirection: "row", alignItems: "center", gap: space[1] }}>
                          <outcome.Icon size={14} weight="bold" color={outcomeInk(b, outcome.ink)} />
                          <Text size="bodyMedium" style={{ color: outcomeInk(b, outcome.ink), flexShrink: 1 }}>
                            {outcome.text}
                          </Text>
                        </View>
                      ) : meta ? (
                        // One line, what changed (old → new) and a sitting's room after it; it wraps only when it must, never cut.
                        <View style={{ flexDirection: "row", gap: space[1] }}>
                          {Kind && (
                            <View style={{ height: 20, justifyContent: "center" }}>
                              <Kind size={16} color={b.muted} />
                            </View>
                          )}
                          <Text size="bodyMedium" tabular style={{ color: b.muted, flex: 1 }}>
                            {factsLabel(meta, room)}
                          </Text>
                        </View>
                      ) : undefined
                    }
                    // The time, under it a small calm dot while unread (its shape says it, never the colour alone), then the
                    // rows' shared chevron: every row opens something.
                    trailing={
                      <View style={{ alignItems: "flex-end", gap: space[1] }}>
                        <Text size="labelMedium" tabular style={{ color: b.muted }}>
                          {time}
                        </Text>
                        {unread && <View testID={`row.alert.${key}.unread`} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: b.brand }} />}
                      </View>
                    }
                    chevron
                    onPress={() =>
                      past
                        ? nav.go(past.kind === "class" ? { screen: "course", code: past.code } : item.target)
                        : item.checkIn
                          ? openCheckIn(item.checkIn.meetingId, item.checkIn.url)
                          : // A meeting with its link or material: where that is (the module), the one thing to open.
                            nav.go(joined ? joined.material.target : item.target)
                    }
                  />
                );
              })}
            </View>
          </Rise>
        ))}
      <Rise screen="alerts" index={Math.min(days.length, RISE_STEPS + 1)} style={{ marginTop: items.length ? space[6] : 0 }}>
        <BRow
          last
          testID="action.alertSettings"
          accessibilityLabel={t("alerts.settings")}
          leading={<KindMark icon={Icons.Settings} code={null} />}
          // The page is "Notifikasi": the row says what's set, not the page's name again (TalkBack hears it whole).
          title={t("mobile.alerts.choose")}
          onPress={() => router.push({ pathname: "/settings", params: { at: "alerts" } })}
        />
        {/* Without SIX the bell hears only Edunex: said once, quietly, where the bell's settings are. */}
        {sixOut && (
          <Text size="bodySmall" style={{ color: b.muted, marginTop: space[3] }}>
            {t("alerts.footnoteEdunex")}
          </Text>
        )}
      </Rise>
    </Page>
  );
}

/**
 * A notification's mark: its course's own glyph in the course's colour, alone (Search's CourseMark), so every row
 * starts the same way; what kind of change it is sits small before the row's second line. The kind's glyph alone,
 * neutral, when it has no course.
 * One that presses (a deadline, presence, attendance at risk; `past`: no longer) carries a small amber dot on its corner,
 * the same shape, so the course is still the one you know.
 */
function KindTile({ item, past }: { item: Alert; past: boolean }) {
  const b = useB();
  const courses = useTermCourses();
  const code = typeof item.title.vars?.course === "string" ? item.title.vars.course : null;
  const pressing = PRESSING.has(item.kind) && !past;
  if (!code) return <KindMark icon={KIND_ICON[item.kind]} code={null} color={pressing ? b.amber : undefined} />;
  return (
    <View>
      <CourseMark code={code} name={courses?.find((one) => one.code === code)?.name} />
      {pressing && (
        <View
          style={{
            position: "absolute",
            top: 4,
            right: 4,
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: b.amber,
            borderWidth: 2,
            borderColor: b.page,
          }}
        />
      )}
    </View>
  );
}

/** An outcome's ink on B's page. */
function outcomeInk(b: ReturnType<typeof useB>, ink: "okFg" | "redFg" | "muted"): string {
  return ink === "okFg" ? b.ok : ink === "redFg" ? b.red : b.muted;
}

/** A row's title once it's over: "Kuliah selesai · {course}", "Presensi ditutup · {course}", "Tenggat lewat · {Task}". */
function pastTitle(t: Translate, past: PastAlert, course: string): string {
  if (past.kind === "class") return t("mobile.alert.classOver", { course });
  if (past.kind === "presence") return t("mobile.alert.presenceOver", { course });
  return t("mobile.alert.deadlineOver", { task: past.task ?? course });
}

/** What happened, once the class, the window or the deadline is over: its word, its icon and its ink. Null: not known (the title says it's over). */
function outcomeOf(t: Translate, outcome: Outcome): { text: string; Icon: ComponentType<IconProps>; ink: "okFg" | "redFg" | "muted" } | null {
  switch (outcome) {
    case "counted":
    case "present":
      return { text: t("mobile.alert.present"), Icon: Icons.CheckCircle, ink: "okFg" };
    case "absent":
      return { text: t("home.today.absent"), Icon: Icons.X, ink: "redFg" };
    case "notRecorded":
      return { text: t("mobile.alert.notRecorded"), Icon: Icons.X, ink: "redFg" };
    case "handedIn":
      return { text: t("taskStatus.submitted"), Icon: Icons.CheckCircle, ink: "okFg" };
    case "notHandedIn":
      return { text: t("mobile.alert.notHandedIn"), Icon: Icons.X, ink: "redFg" };
    case "missing":
      return { text: t("home.today.notCounted"), Icon: Icons.Clock, ink: "muted" };
    default:
      return null;
  }
}
