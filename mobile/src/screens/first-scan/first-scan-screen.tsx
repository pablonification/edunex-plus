// The first-run scan (A8, #81, spec story 68), the desktop's dialog (src/app/shell/first-scan.tsx)
// as a screen: once the first full sync of Edunex (and SIX when connected) is done, what the app
// found, each line with its number and the screen that shows it. It opens by itself once (./watch.tsx,
// a setting remembers) and only with something to say; Settings opens it again. The findings come
// from src/core/first-scan.ts.
import type { ComponentType } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useFormat, useT } from "../../../../src/app/i18n";
import { isBuilt } from "../../../../src/app/shell/built";
import { type Finding, notable, scanSummary } from "../../../../src/core/first-scan";
import type { Route } from "../../../../src/core/route";
import { useNav } from "../../nav";
import { BottomBar } from "../../parts/bottom-bar";
import { Button } from "../../ui/controls";
import { EmptyState } from "../../ui/display";
import { type IconProps, Icons } from "../../ui/icons";
import { Meta, Page } from "../../ui/layout";
import { Text } from "../../ui/text";
import { radius, space, useTheme } from "../../ui/theme";
import { TopBar } from "../../ui/top-bar";
import { describe, useScan } from "./scan";

const ICON: Record<Finding["kind"], ComponentType<IconProps>> = {
  attendance: Icons.Hand,
  clash: Icons.Overlap,
  unusedPresence: Icons.EyeOff,
  exams: Icons.GraduationCap,
  notInSix: Icons.CalendarClock,
  edited: Icons.PenLine,
  ipk: Icons.Flag,
  unread: Icons.AlertTriangle,
};

const TONE = { danger: "dangerFg", warning: "warningFg", info: "infoFg", success: "successFg" } as const;

export function FirstScanScreen() {
  const t = useT();
  const { go } = useNav();
  const theme = useTheme();
  const { saved, statuses, findings } = useScan(true);
  const summary = scanSummary(saved, statuses);
  const count = notable(findings);
  const heading =
    count === 0
      ? null
      : summary.read.length === 1
        ? t(summary.read[0] === "edunex" ? "scan.title.edunex" : "scan.title.six", { count })
        : t("scan.title", { count });
  return (
    <View style={{ flex: 1, backgroundColor: theme.color.canvas }}>
      <Page testID="screen.firstScan" header={<TopBar title={t("scan.heading")} />}>
        <Summary summary={summary} />
        {/* The answer, as big as one in a card, naming the list under it. */}
        {heading && (
          <Text size="heading" weight="semibold" style={{ marginTop: space[1.5], letterSpacing: -0.2 }} accessibilityRole="header">
            {heading}
          </Text>
        )}
        {findings.length ? (
          <View
            style={{
              marginTop: space[4],
              borderRadius: radius.xl,
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: theme.color.edge,
              backgroundColor: theme.color.surface,
              overflow: "hidden",
            }}
          >
            {findings.map((finding, i) => (
              <View key={finding.kind} style={i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.color.line } : undefined}>
                <Line finding={finding} onGo={go} />
              </View>
            ))}
          </View>
        ) : (
          <View style={{ marginTop: space[4] }}>
            <EmptyState icon={<Icons.CheckCircle size={20} color={theme.color.successFg} />} title={t("scan.empty")} />
          </View>
        )}
        <Text size="small" tone="muted" style={{ marginTop: space[5], textAlign: "center" }}>
          {t("scan.later")}
        </Text>
      </Page>
      {/* Always in reach, however long the list. */}
      <BottomBar>
        <Button variant="primary" size="lg" onPress={() => go({ screen: "home" })} style={{ flex: 1 }} testID="action.scanHome">
          {t("scan.goHome")}
        </Button>
      </BottomBar>
    </View>
  );
}

/**
 * "Edunex dan SIX terhubung · 5 mata kuliah, 10 tugas dibaca". No meeting count: the reading step
 * hands over before SIX's timetable is in, so its running count would look contradicted here.
 */
function Summary({ summary }: { summary: ReturnType<typeof scanSummary> }) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  if (!summary.read.length) return null;
  const names = summary.connected.map((source) => t(`source.${source}`));
  const connected = names.length ? t("scan.connected", { sources: f.list(names) }) : null;
  const read = [t("scan.read.courses", { count: summary.courses }), summary.tasks ? t("scan.read.tasks", { count: summary.tasks }) : null].filter(Boolean);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
      <Icons.CheckCircle size={16} color={theme.color.successFg} weight="bold" />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Meta>
          {connected}
          {t("scan.read", { list: read.join(", ") })}
        </Meta>
      </View>
    </View>
  );
}

/** One finding: its number in the title, a few specifics, and the screen that shows it. */
function Line({ finding, onGo }: { finding: Finding; onGo: (route: Route) => void }) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const Icon = ICON[finding.kind];
  const { title, lines, note } = describe(finding, t, f);
  const route = finding.routes.find(isBuilt) ?? { screen: "home" };
  return (
    <Pressable
      testID={`row.finding.${finding.kind}`}
      accessibilityRole="button"
      onPress={() => onGo(route)}
      android_ripple={{ color: theme.color.selected }}
      style={{ flexDirection: "row", alignItems: "flex-start", gap: space[3.5], paddingHorizontal: space[4], paddingVertical: space[3.5] }}
    >
      <View style={{ marginTop: 3 }}>
        <Icon size={16} color={theme.color[TONE[finding.tone]]} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size="body" weight="semibold">
          {title}
        </Text>
        {(lines.length > 0 || note) && (
          <View style={{ marginTop: space[1], gap: 2 }}>
            {lines.map((line) => (
              <Meta key={line}>{line}</Meta>
            ))}
            {note && (
              <Text size="small" tone="muted">
                {note}
              </Text>
            )}
          </View>
        )}
      </View>
      <View style={{ marginTop: 3 }}>
        <Icons.ChevronRight size={16} color={theme.color.faint} />
      </View>
    </Pressable>
  );
}
