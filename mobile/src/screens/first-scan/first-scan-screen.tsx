// The first-run scan (A8, #81, spec story 68), the desktop's dialog (src/app/shell/first-scan.tsx)
// as a screen: once the first full sync of Edunex (and SIX when connected) is done, what the app
// found. One title (the count, big, folding into the top bar on scroll), each finding as one line
// that opens the screen showing it, the first few at once; Lihat semua shows them all with their
// specifics and what the read took in. Beranda's
// "Semua siap" opens it once; Settings opens it again. The findings come from src/core/first-scan.ts.
import { type ComponentType, useState } from "react";
import { type LayoutChangeEvent, View } from "react-native";
import { useFormat, useT } from "../../../../src/app/i18n";
import { isBuilt } from "../../../../src/app/shell/built";
import { type Finding, notable, scanSummary } from "../../../../src/core/first-scan";
import { useNav } from "../../nav";
import { BigButton } from "../../ui/big-button";
import { Group, GroupRow, IconTile, type PillTone } from "../../ui/group";
import { type IconProps, Icons } from "../../ui/icons";
import { useBottomInset } from "../../ui/insets";
import { Page } from "../../ui/layout";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { TopBar } from "../../ui/top-bar";
import { describe, useScan } from "./scan";

const ICON: Record<Finding["kind"], ComponentType<IconProps>> = {
  attendance: Icons.Hand,
  clash: Icons.Overlap,
  exams: Icons.GraduationCap,
  notInSix: Icons.CalendarClock,
  edited: Icons.PenLine,
  ipk: Icons.Flag,
  unread: Icons.AlertTriangle,
};

const TONE: Record<Finding["tone"], PillTone> = { danger: "red", warning: "amber", info: "brand", success: "ok" };

/** Findings shown before Lihat semua. */
const FIRST = 3;

export function FirstScanScreen() {
  const t = useT();
  const f = useFormat();
  const { go } = useNav();
  const theme = useTheme();
  const v = theme.v4;
  const bottom = useBottomInset();
  const { saved, statuses, findings } = useScan(true);
  const [all, setAll] = useState(false);
  const [titleEnd, setTitleEnd] = useState(80);
  const summary = scanSummary(saved, statuses);
  const count = notable(findings);
  const title =
    count === 0
      ? t("scan.heading")
      : summary.read.length === 1
        ? t(summary.read[0] === "edunex" ? "scan.title.edunex" : "scan.title.six", { count })
        : t("scan.title", { count });
  const shown = all ? findings : findings.slice(0, FIRST);
  return (
    <View style={{ flex: 1, backgroundColor: v.page }}>
      <Page testID="screen.firstScan" background={v.page} header={<TopBar v4 title={title} titleFrom={titleEnd} />}>
        {/* The screen's one title, folding into the bar once scrolled past. */}
        <Text
          size="headlineSmall"
          face="display"
          weight="bold"
          accessibilityRole="header"
          onLayout={(event: LayoutChangeEvent) => setTitleEnd(event.nativeEvent.layout.y + event.nativeEvent.layout.height)}
          style={{ color: v.fg, fontSize: 24, lineHeight: 30, letterSpacing: -0.4, marginTop: space[2], marginBottom: space[6] }}
        >
          {title}
        </Text>
        {findings.length ? (
          <Group>
            {shown.map((finding, i) => {
              const Icon: ComponentType<IconProps> = ICON[finding.kind];
              const { title: line, lines, note } = describe(finding, t, f);
              // Lihat semua: each finding's specifics under its line, quiet.
              const more = all ? [...lines, ...(note ? [note] : [])] : [];
              return (
                <GroupRow
                  key={finding.kind}
                  first={i === 0}
                  testID={`row.finding.${finding.kind}`}
                  accessibilityRole="button"
                  leading={<IconTile tone={TONE[finding.tone]} icon={(color) => <Icon size={22} color={color} />} />}
                  title={line}
                  onPress={() => go(finding.routes.find(isBuilt) ?? { screen: "home" })}
                >
                  {more.map((fact) => (
                    <Text key={fact} size="bodyMedium" style={{ color: v.muted, marginTop: 2 }}>
                      {fact}
                    </Text>
                  ))}
                </GroupRow>
              );
            })}
            {!all && (
              <GroupRow
                testID="action.firstScan.all"
                accessibilityRole="button"
                title={
                  <Text size="labelLarge" style={{ color: v.brandInk }}>
                    {t("home.changes.all")}
                  </Text>
                }
                onPress={() => setAll(true)}
              />
            )}
          </Group>
        ) : (
          <Group>
            <GroupRow first leading={<IconTile tone="ok" icon={(color) => <Icons.CheckCircle size={22} color={color} />} />} title={t("scan.empty")} />
          </Group>
        )}
        {all && <ReadLine summary={summary} />}
      </Page>
      {/* Always in reach, however long the list. */}
      <View style={{ backgroundColor: v.page, paddingHorizontal: space.page, paddingTop: space[3], paddingBottom: space[3] + bottom }}>
        <BigButton onPress={() => go({ screen: "home" })} testID="action.scanHome">
          {t("scan.goHome")}
        </BigButton>
      </View>
    </View>
  );
}

/** "Edunex dan SIX terhubung · 5 mata kuliah, 10 tugas dibaca": what the first read took in, under Lihat semua. */
function ReadLine({ summary }: { summary: ReturnType<typeof scanSummary> }) {
  const t = useT();
  const f = useFormat();
  const v = useTheme().v4;
  if (!summary.read.length) return null;
  const names = summary.connected.map((source) => t(`source.${source}`));
  const read = [t("scan.read.courses", { count: summary.courses }), summary.tasks ? t("scan.read.tasks", { count: summary.tasks }) : null].filter(Boolean);
  const facts = [names.length ? t("scan.connected", { sources: f.list(names) }) : null, t("scan.read", { list: read.join(", ") })].filter(Boolean);
  return (
    <Text size="bodyMedium" style={{ color: v.muted, marginTop: space[4], marginHorizontal: space[1] }}>
      {facts.join(" · ")}
    </Text>
  );
}
