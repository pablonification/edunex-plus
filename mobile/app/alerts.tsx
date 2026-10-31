// The bell: the history of everything the app noticed (src/app/shell/alerts.tsx), as a screen. Every
// alert the engine raised joined with the changes it can see in the data itself (src/core/needs.ts
// alertFeed), so Beranda's "Yang berubah" is a preview of this list. Grouped Hari ini / Kemarin /
// Minggu ini / Sebelumnya; each row opens its screen. Opening it clears the badge; the dots stay until
// "Tandai semua dibaca". Nothing is ever marked in Edunex.
import { router } from "expo-router";
import { type ComponentType, useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useCourseColor } from "../../src/app/courses";
import { useHomeWorld } from "../../src/app/home-world";
import { useOpenCheckIn } from "../../src/app/hooks";
import { type Format, useFormat, useNow, useT } from "../../src/app/i18n";
import { useBridge, useDataset, useStatus } from "../../src/app/store";
import type { Alert, AlertKind } from "../../src/core/models";
import { alertFeed } from "../../src/core/needs";
import { useNav } from "../src/nav";
import { usePerfDrawn } from "../src/perf";
import { CourseDot, EmptyState } from "../src/ui/display";
import { type IconProps, Icons } from "../src/ui/icons";
import { List, Meta, Page, Section } from "../src/ui/layout";
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

type Period = "today" | "yesterday" | "week" | "earlier";
const PERIODS: Period[] = ["today", "yesterday", "week", "earlier"];
const periodOf = (f: Format, at: number): Period => {
  const ago = -f.dayOffset(at);
  return ago <= 0 ? "today" : ago === 1 ? "yesterday" : ago < 7 ? "week" : "earlier";
};

export default function Alerts() {
  usePerfDrawn(true);
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const theme = useTheme();
  const bridge = useBridge();
  const nav = useNav();
  const openCheckIn = useOpenCheckIn();
  const history = useDataset("app.alerts");
  const sixOut = useStatus("six").state === "signed-out";
  const world = useHomeWorld();
  const colorOf = useCourseColor();
  // What counted as read when the Student opened it: the dots stay on what came since, until they say so.
  const [readAt, setReadAt] = useState(() => history?.readAt ?? 0);
  useEffect(() => {
    void bridge.invoke("alerts.markRead", {}).catch(() => undefined);
  }, [bridge]);
  const items = useMemo(() => (world ? alertFeed(world, history?.items ?? []) : (history?.items ?? [])), [world, history]);
  const raised = useMemo(() => new Set((history?.items ?? []).map((item) => item.id)), [history]);
  const isUnread = (item: Alert) => raised.has(item.id) && item.at > readAt;
  const anyUnread = items.some(isUnread);
  const groups = PERIODS.map((period) => ({ period, items: items.filter((item) => periodOf(f, item.at) === period) })).filter((group) => group.items.length);

  return (
    <Page
      testID="screen.alerts"
      header={
        <TopBar
          title={t("alerts.title")}
          actions={
            anyUnread ? (
              <Pressable
                onPress={() => setReadAt(now)}
                accessibilityRole="button"
                hitSlop={8}
                style={{ paddingHorizontal: space[3] }}
                testID="action.markAllRead"
              >
                <Text size="small" weight="medium" tone="accent">
                  {t("alerts.markAllRead")}
                </Text>
              </Pressable>
            ) : undefined
          }
        />
      }
    >
      {items.length === 0 && (
        <EmptyState
          icon={<Icons.Bell size={18} color={theme.color.muted} />}
          title={t("alerts.empty")}
          description={t(sixOut ? "alerts.emptyHintEdunex" : "alerts.emptyHint")}
        />
      )}
      {groups.map(({ period, items: group }, index) => (
        <Section key={period} title={t(`alerts.period.${period}`)} first={index === 0}>
          <List>
            {group.map((item) => {
              const Icon = KIND_ICON[item.kind];
              const unread = isUnread(item);
              const code = typeof item.title.vars?.course === "string" ? item.title.vars.course : null;
              return (
                <Pressable
                  key={item.id}
                  testID={`row.alert.${item.id}`}
                  accessibilityRole="button"
                  android_ripple={{ color: theme.color.selected }}
                  onPress={() => (item.checkIn ? openCheckIn(item.checkIn.meetingId, item.checkIn.url) : nav.go(item.target))}
                  style={{ flexDirection: "row", gap: space[3], paddingHorizontal: space[4], paddingVertical: space[3] }}
                >
                  <View style={{ marginTop: 2, alignSelf: "flex-start" }}>
                    <Icon size={18} color={PRESSING.has(item.kind) ? theme.color.warningFg : theme.color.faint} />
                    {code && (
                      <View style={{ position: "absolute", right: -4, bottom: -2 }}>
                        <CourseDot color={colorOf(code)} size={8} />
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text size="small" weight={unread ? "semibold" : "regular"}>
                      {t(item.title.key, item.title.vars)}
                    </Text>
                    {item.body && <Meta size="caption">{t(item.body.key, item.body.vars)}</Meta>}
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[2], paddingTop: 2 }}>
                    <Text size="caption" tone="faint" tabular>
                      {period === "today" || period === "yesterday" ? f.time(item.at) : `${f.weekdayShort(item.at)} ${f.dayMonth(item.at)}`}
                    </Text>
                    {/* The dot says "belum dibaca" to a screen reader too, as the desktop's does. */}
                    <View
                      accessible={unread}
                      accessibilityLabel={unread ? t("alerts.unread") : undefined}
                      style={{ width: 8, height: 8, marginTop: 4, borderRadius: 4, backgroundColor: unread ? theme.color.accent : "transparent" }}
                    />
                  </View>
                </Pressable>
              );
            })}
          </List>
        </Section>
      ))}
      <View style={{ marginTop: space[6], flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: space[3] }}>
        <View style={{ flex: 1, minWidth: 200 }}>
          <Meta size="caption">{t(sixOut ? "alerts.footnoteEdunex" : "alerts.footnote")}</Meta>
        </View>
        <Pressable
          onPress={() => router.push({ pathname: "/settings", params: { at: "alerts" } })}
          accessibilityRole="button"
          hitSlop={8}
          style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
          testID="action.alertSettings"
        >
          <Icons.Settings size={14} color={theme.color.accentFg} />
          <Text size="small" weight="medium" tone="accent">
            {t("alerts.settings")}
          </Text>
        </Pressable>
      </View>
    </Page>
  );
}
