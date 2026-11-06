// The bell: the history of everything the app noticed (src/app/shell/alerts.tsx), as a screen (round 2, v4). Every
// alert the engine raised joined with the changes it can see in the data itself (src/core/needs.ts alertFeed), so
// Beranda's "Yang berubah" is a preview of this list. On v4's grey page, by day (Hari ini, Kemarin, then the date), each
// day a white card of rows: the kind's icon on its course's colour (amber for what presses), the title, one meta line
// (the time and what it's about). Opening it clears the badge; the dots stay until "Tandai semua dibaca", the bar's one
// action while something is unread. Nothing is ever marked in Edunex.
import * as Haptics from "expo-haptics";
import { router } from "expo-router";
import { ChecksIcon } from "phosphor-react-native/src/icons/Checks";
import { type ComponentType, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { useHomeWorld } from "../../src/app/home-world";
import { useOpenCheckIn } from "../../src/app/hooks";
import { type Format, type Translate, useFormat, useNow, useT } from "../../src/app/i18n";
import { useBridge, useDataset, useStatus } from "../../src/app/store";
import type { Alert, AlertKind } from "../../src/core/models";
import { alertFeed } from "../../src/core/needs";
import { useNav } from "../src/nav";
import { changeLines } from "../src/parts/change-meta";
import { usePerfDrawn } from "../src/perf";
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

/** A day's items, newest day first: 0 is today (a raised alert a minute ahead of the screen's clock too), -1 yesterday. */
interface Day {
  offset: number;
  /** When its newest item came (the day's date). */
  at: number;
  items: Alert[];
}

/** The day's heading: Hari ini, Kemarin, then the day as the desktop's rows date it ("Sen 5 Okt"). */
function dayTitle(day: Day, t: Translate, f: Format): string {
  if (day.offset === 0) return t("alerts.period.today");
  if (day.offset === -1) return t("alerts.period.yesterday");
  return `${f.weekdayShort(day.at)} ${f.dayMonth(day.at)}`;
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
  // What counted as read when the Student opened it: the dots stay on what came since, until they say so.
  const [readAt, setReadAt] = useState(() => history?.readAt ?? 0);
  useEffect(() => {
    void bridge.invoke("alerts.markRead", {}).catch(() => undefined);
  }, [bridge]);
  const items = useMemo(() => (world ? alertFeed(world, history?.items ?? []) : (history?.items ?? [])), [world, history]);
  const raised = useMemo(() => new Set((history?.items ?? []).map((item) => item.id)), [history]);
  const isUnread = (item: Alert) => raised.has(item.id) && item.at > readAt;
  const anyUnread = items.some(isUnread);
  const days = useMemo(() => {
    const byOffset = new Map<number, Alert[]>();
    for (const item of items) {
      const offset = Math.min(0, f.dayOffset(item.at));
      const day = byOffset.get(offset);
      if (day) day.push(item);
      else byOffset.set(offset, [item]);
    }
    return [...byOffset].map(([offset, dayItems]): Day => ({ offset, at: dayItems[0]?.at ?? now, items: dayItems })).sort((a, b) => b.offset - a.offset);
  }, [items, f, now]);

  const markAllRead = () => {
    setReadAt(now);
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
            {day.items.map((item, i) => {
              const unread = isUnread(item);
              const { title, meta, spoken } = changeLines(t, item);
              const time = f.time(item.at);
              return (
                <GroupRow
                  key={item.id}
                  testID={`row.alert.${item.id}`}
                  first={i === 0}
                  // Unread first in what's read out, as the dot says it to the eye.
                  accessibilityLabel={factsLabel(unread ? t("alerts.unread") : null, ...spoken, time)}
                  leading={<KindTile item={item} />}
                  title={
                    <Text size="bodyLarge" weight={unread ? "semibold" : undefined} numberOfLines={2} style={{ color: v.fg, lineHeight: 21 }}>
                      {title}
                    </Text>
                  }
                  // One meta line, what changed (short where the desktop's runs long, ../src/parts/change-meta.ts); the time at
                  // the row's end.
                  meta={
                    meta ? (
                      <Text size="bodyMedium" numberOfLines={1} style={{ color: v.muted }}>
                        {meta}
                      </Text>
                    ) : undefined
                  }
                  // Unread: a dot and the semibold title, never the colour alone.
                  trailing={
                    <View style={{ alignItems: "flex-end", gap: space[1] }}>
                      <Text size="labelMedium" tabular style={{ color: v.muted }}>
                        {time}
                      </Text>
                      {unread && <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: v.brand }} />}
                    </View>
                  }
                  onPress={() => (item.checkIn ? openCheckIn(item.checkIn.meetingId, item.checkIn.url) : nav.go(item.target))}
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

/** A notification's tile: its kind's icon, amber when it presses (a deadline, presence, attendance at risk), else on its course's colour, else the brand's. */
function KindTile({ item }: { item: Alert }) {
  const Icon = KIND_ICON[item.kind];
  const glyph = (color: string) => <Icon size={22} color={color} />;
  const code = typeof item.title.vars?.course === "string" ? item.title.vars.course : null;
  if (PRESSING.has(item.kind)) return <IconTile tone="amber" icon={glyph} />;
  if (code) return <CourseIconTile code={code} icon={glyph} />;
  return <IconTile tone="brand" icon={glyph} />;
}
