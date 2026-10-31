// The bell: the history of everything the app noticed (src/app/shell/alerts.tsx), as a screen. Every
// alert the engine raised joined with the changes it can see in the data itself (src/core/needs.ts
// alertFeed), so Beranda's "Yang berubah" is a preview of this list. Grouped Hari ini / Kemarin /
// Minggu ini / Sebelumnya; each row opens its screen. Opening it clears the badge; the dots stay until
// "Tandai semua dibaca". Nothing is ever marked in Edunex.
import { router } from "expo-router";
import { type ComponentType, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useCourseColor } from "../../src/app/courses";
import { useHomeWorld } from "../../src/app/home-world";
import { useOpenCheckIn } from "../../src/app/hooks";
import { type Format, useFormat, useNow, useT } from "../../src/app/i18n";
import { useBridge, useDataset, useStatus } from "../../src/app/store";
import type { Alert, AlertKind } from "../../src/core/models";
import { alertFeed } from "../../src/core/needs";
import { useNav } from "../src/nav";
import { usePerfDrawn } from "../src/perf";
import { Button } from "../src/ui/controls";
import { CourseDot, EmptyState } from "../src/ui/display";
import { type IconProps, Icons } from "../src/ui/icons";
import { factsLabel, List, Meta, Page, Section } from "../src/ui/layout";
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
  const c = theme.color;
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
              <Button variant="ghost" onPress={() => setReadAt(now)} testID="action.markAllRead" style={{ marginRight: space[2] }}>
                {t("alerts.markAllRead")}
              </Button>
            ) : undefined
          }
        />
      }
    >
      {items.length === 0 && (
        <EmptyState
          icon={<Icons.Bell size={24} color={c.onSecondaryContainer} />}
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
              const pressing = PRESSING.has(item.kind);
              const code = typeof item.title.vars?.course === "string" ? item.title.vars.course : null;
              const title = t(item.title.key, item.title.vars);
              const body = item.body ? t(item.body.key, item.body.vars) : null;
              const when = period === "today" || period === "yesterday" ? f.time(item.at) : `${f.weekdayShort(item.at)} ${f.dayMonth(item.at)}`;
              return (
                <Pressable
                  key={item.id}
                  testID={`row.alert.${item.id}`}
                  accessibilityRole="button"
                  // Unread first in what's read out, as the dot says it first to the eye.
                  accessibilityLabel={factsLabel(unread ? t("alerts.unread") : null, title, body, when)}
                  android_ripple={{ color: c.selected }}
                  onPress={() => (item.checkIn ? openCheckIn(item.checkIn.meetingId, item.checkIn.url) : nav.go(item.target))}
                  style={styles.row}
                >
                  <View style={[styles.mark, { backgroundColor: pressing ? c.warningBg : c.secondaryContainer }]}>
                    <Icon size={20} color={pressing ? c.warningFg : c.onSecondaryContainer} />
                    {code && (
                      <View style={{ position: "absolute", right: 0, bottom: 0 }}>
                        <CourseDot color={colorOf(code)} size={10} />
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
                    <Text size="bodyLarge" weight={unread ? "semibold" : undefined} numberOfLines={3}>
                      {title}
                    </Text>
                    {body && <Meta size="small">{body}</Meta>}
                  </View>
                  <View style={styles.end}>
                    <Text size="bodySmall" tone={unread ? "primary" : "muted"} weight={unread ? "semibold" : undefined} tabular>
                      {when}
                    </Text>
                    {/* Unread: a dot and the bold title, never the colour alone. */}
                    {unread && <View style={[styles.dot, { backgroundColor: c.primary }]} />}
                  </View>
                </Pressable>
              );
            })}
          </List>
        </Section>
      ))}
      <View style={{ marginTop: space[8] }}>
        <List>
          <Pressable
            onPress={() => router.push({ pathname: "/settings", params: { at: "alerts" } })}
            accessibilityRole="button"
            android_ripple={{ color: c.selected }}
            style={styles.row}
            testID="action.alertSettings"
          >
            <View style={[styles.mark, { backgroundColor: c.secondaryContainer }]}>
              <Icons.Settings size={20} color={c.onSecondaryContainer} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text size="bodyLarge">{t("alerts.settings")}</Text>
              <Text size="bodyMedium" tone="muted">
                {t("mobile.alerts.settingsHint")}
              </Text>
            </View>
          </Pressable>
        </List>
        <View style={{ marginTop: space[3], paddingHorizontal: space[4] }}>
          <Meta size="caption">{t(sixOut ? "alerts.footnoteEdunex" : "alerts.footnote")}</Meta>
        </View>
      </View>
    </Page>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "flex-start", gap: space[4], paddingHorizontal: space[4], paddingVertical: space[3], minHeight: 72 },
  mark: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  end: { alignItems: "flex-end", gap: space[2], paddingTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
