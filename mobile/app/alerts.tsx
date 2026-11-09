// The bell: the history of everything the app noticed (src/app/shell/alerts.tsx), as a screen (round 2, v4). Every
// alert the engine raised joined with the changes it can see in the data itself (src/core/needs.ts alertFeed), so
// Beranda's "Yang berubah" is a preview of this list. On v4's grey page, by day (Hari ini, Kemarin, then the date), each
// day a white card of rows: the kind's icon on its course's colour (amber for what presses), the title with the course's
// name, one meta line (what changed, old → new, or the action and its deadline), and at the row's end the time the
// thing itself happened (a Task posted, a Presence opening), else when the app noticed it (SIX never dates a moved
// class). A small calm dot on each unread row, and the bell's dot on every tab, until "Tandai
// semua dibaca", the bar's one action while something is unread: both say the same thing. Nothing is ever marked in
// Edunex. A class's or a Presence's alert whose window is over says what happened, with no action left in it, and opens
// the course; a deadline's, once it has passed, says whether the Task was handed in, and opens the Task; an exam SIX lists in two weeks is one row with both days (../src/screens/alerts/past.ts,
// ../../src/core/exam-sittings.ts); a meeting and its Teams link or material posted close by are one row
// (../src/screens/alerts/same-meeting.ts).
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { ChecksIcon } from "phosphor-react-native/src/icons/Checks";
import { type ComponentType, useMemo, useState } from "react";
import { View } from "react-native";
import { useHomeWorld } from "../../src/app/home-world";
import { useOpenCheckIn } from "../../src/app/hooks";
import { type Format, type Translate, useFormat, useNow, useT } from "../../src/app/i18n";
import { useBridge, useDataset, useStatus } from "../../src/app/store";
import { examSittings, sittingsLine } from "../../src/core/exam-sittings";
import type { Alert, AlertKind, ClassSession } from "../../src/core/models";
import { alertFeed } from "../../src/core/needs";
import { useNav } from "../src/nav";
import { changeLines, eventTime } from "../src/parts/change-meta";
import { usePerfDrawn } from "../src/perf";
import { type Outcome, type PastAlert, pastAlert } from "../src/screens/alerts/past";
import { type MeetingExtra, sameMeeting } from "../src/screens/alerts/same-meeting";
import { useShortCourseName } from "../src/screens/home/parts";
import { IconButton } from "../src/ui/controls";
import { CourseIconTile } from "../src/ui/course-icon-tile";
import { Rise } from "../src/ui/expressive";
import { Group, GroupRow, Heading, IconTile } from "../src/ui/group";
import { type IconProps, Icons } from "../src/ui/icons";
import { factsLabel, Page } from "../src/ui/layout";
import { Text } from "../src/ui/text";
import { space, useTheme } from "../src/ui/theme";
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
  item: Alert;
  happened: number | null;
  at: number;
  /** Its class or Presence window is over: what happened. */
  past: PastAlert | null;
  /** An exam SIX lists more than once: every sitting. */
  sittings: readonly ClassSession[] | null;
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
  const v = useTheme().v4;
  const bridge = useBridge();
  const nav = useNav();
  const openCheckIn = useOpenCheckIn();
  const history = useDataset("app.alerts");
  const sixOut = useStatus("six").state === "signed-out";
  const world = useHomeWorld();
  const name = useShortCourseName();
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
      .map((item): Row => {
        const happened = eventTime(item, raised.has(item.id), world);
        const joined = meetings.joined.get(item.id) ?? null;
        return { item, happened, at: happened ?? item.at, past: pastAlert(item, world, now), sittings: sittings.get(item.id) ?? null, joined };
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

  const markAllRead = () => {
    setMarkedAt(now);
    void bridge.invoke("alerts.markRead", {}).catch(() => undefined);
    void Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Confirm).catch(() => undefined);
  };

  return (
    <Page
      testID="screen.alerts"
      background={v.page}
      header={
        <TopBar
          title={t("alerts.title")}
          actions={
            anyUnread ? (
              <IconButton label={t("alerts.markAllRead")} onPress={markAllRead} testID="action.markAllRead">
                <ChecksIcon size={24} color={v.fg} />
              </IconButton>
            ) : undefined
          }
        />
      }
    >
      {items.length === 0 && (
        // Calm: the bell and one line. Atur notifikasi under it is the next step.
        <Rise screen="alerts" index={0} style={{ alignItems: "center", gap: space[4], paddingTop: space[12], paddingBottom: space[4] }}>
          <IconTile size={64} icon={(color) => <Icons.Bell size={30} color={color} />} />
          <Text size="bodyLarge" style={{ color: v.fg2, textAlign: "center" }}>
            {t("alerts.empty")}
          </Text>
        </Rise>
      )}
      {days.map((day, index) => (
        <Rise key={day.offset} screen="alerts" index={Math.min(index, RISE_STEPS)}>
          <Heading first={index === 0}>{dayTitle(day, t, f)}</Heading>
          <Group>
            {day.rows.map(({ item, happened, past, sittings, joined }, i) => {
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
                : sittings
                  ? sittingsLine(f, sittings)
                  : joined
                    ? t(joined.extra === "link" ? "mobile.change.meeting.withLink" : "mobile.change.meeting.withMaterial", { when: said(lines.meta) ?? "" })
                    : said(lines.meta);
              const spoken = past ? [title, outcome?.text ?? null] : sittings || joined ? [lines.title, meta] : lines.spoken;
              // Every row has a time: when the thing happened, else when the app noticed it.
              const time = f.time(happened ?? item.at);
              return (
                <GroupRow
                  key={item.id}
                  testID={`row.alert.${item.id}`}
                  first={i === 0}
                  // Unread first in what's read out, as the dot says it to the eye.
                  accessibilityLabel={factsLabel(unread ? t("alerts.unread") : null, ...spoken, time)}
                  leading={<KindTile item={item} past={past !== null} />}
                  title={
                    <Text size="bodyLarge" numberOfLines={2} style={{ color: v.fg, lineHeight: 21 }}>
                      {title}
                    </Text>
                  }
                  // One meta line: what changed, old → new, or the action and its deadline (short where the desktop's runs
                  // long or says how, ../src/parts/change-meta.ts).
                  meta={
                    outcome ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: space[1] }}>
                        <outcome.Icon size={14} weight="bold" color={v[outcome.ink]} />
                        <Text size="bodyMedium" numberOfLines={1} style={{ color: v[outcome.ink], flexShrink: 1 }}>
                          {outcome.text}
                        </Text>
                      </View>
                    ) : meta ? (
                      // One short line: the whole of it is in the row's spoken name and on what the row opens.
                      <Text size="bodyMedium" numberOfLines={1} style={{ color: v.muted }}>
                        {meta}
                      </Text>
                    ) : undefined
                  }
                  // The time it happened, and under it a small calm dot while unread (its shape says it, never the colour alone).
                  trailing={
                    <View style={{ alignItems: "flex-end", gap: space[1] }}>
                      <Text size="labelMedium" tabular style={{ color: v.muted }}>
                        {time}
                      </Text>
                      {unread && <View testID={`row.alert.${item.id}.unread`} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: v.brand }} />}
                    </View>
                  }
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
          </Group>
        </Rise>
      ))}
      <Rise screen="alerts" index={Math.min(days.length, RISE_STEPS + 1)} style={{ marginTop: items.length ? space[6] : 0 }}>
        <Group>
          <GroupRow
            first
            testID="action.alertSettings"
            leading={<IconTile tone="plain" icon={(color) => <Icons.Settings size={22} color={color} />} />}
            title={t("alerts.settings")}
            trailing={<Icons.ChevronRight size={20} color={v.muted} />}
            onPress={() => router.push({ pathname: "/settings", params: { at: "alerts" } })}
          />
        </Group>
        {/* Without SIX the bell hears only Edunex: said once, quietly, where the bell's settings are. */}
        {sixOut && (
          <Text size="bodySmall" style={{ color: v.muted, marginTop: space[3], marginHorizontal: space[4] }}>
            {t("alerts.footnoteEdunex")}
          </Text>
        )}
      </Rise>
    </Page>
  );
}

/**
 * A notification's tile: its kind's icon, amber while it presses (a deadline, presence, attendance at risk; `past`: no
 * longer), else on its course's colour, else the brand's.
 */
function KindTile({ item, past }: { item: Alert; past: boolean }) {
  const Icon = KIND_ICON[item.kind];
  const glyph = (color: string) => <Icon size={22} color={color} />;
  const code = typeof item.title.vars?.course === "string" ? item.title.vars.course : null;
  if (PRESSING.has(item.kind) && !past) return <IconTile tone="amber" icon={glyph} />;
  if (code) return <CourseIconTile code={code} icon={glyph} />;
  return <IconTile tone="brand" icon={glyph} />;
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
