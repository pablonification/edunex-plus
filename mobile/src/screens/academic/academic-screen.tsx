// Akademik (the tab that replaced Lainnya): who the Student is and where their studies stand at a
// glance (IPK, SKS passed), then every academic screen as a row of its own: Nilai, then Rencana studi's
// parts (Rencana, Kurikulum, KRS, UKT, Kalender akademik), each a stack screen with Android's Back,
// each row with its own count. Settings and the account are behind the avatar in the top bar (and the
// Student's own row here). The screens' content belongs to their own helpers; this is the way in.
import { router } from "expo-router";
import { View } from "react-native";
import { useFormat, useT } from "../../../../src/app/i18n";
import { displayName, initials } from "../../../../src/app/names";
import { type Badge as BadgeValue, usePlanTabBadges } from "../../../../src/app/shell/badges";
import { builtPlanTabs, type PlanTab } from "../../../../src/app/shell/built";
import { useDataset } from "../../../../src/app/store";
import { useStudentRecord } from "../../../../src/app/study-plan";
import { passedSks } from "../../../../src/core/planner";
import { useNav } from "../../nav";
import { Badge, Card } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { factsLabel, List, Row, Section, Stat, StatRow } from "../../ui/layout";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { shownIndex } from "../grades/transcript";

const PART_ICON: Readonly<Record<PlanTab, (typeof Icons)[keyof typeof Icons]>> = {
  planner: Icons.Route,
  curriculum: Icons.Layers,
  krs: Icons.CalendarCheck,
  bills: Icons.Wallet,
  deadlines: Icons.CalendarClock,
};

export function AcademicContent() {
  const t = useT();
  const nav = useNav();
  const theme = useTheme();
  const badges = usePlanTabBadges();
  const glyph = (Icon: (typeof Icons)[keyof typeof Icons]) => <Icon size={24} color={theme.color.onSurfaceVariant} />;
  const count = (badge: BadgeValue | undefined) => (badge ? <Badge tone={badge.tone === "warning" ? "warning" : "neutral"}>{badge.value}</Badge> : undefined);
  return (
    <View style={{ gap: space[6] }}>
      <Profile />
      <Section title={t("mobile.academic.screens")} first>
        <List>
          <Row leading={glyph(Icons.ClipboardCheck)} title={t("nav.grades")} onPress={() => nav.go({ screen: "grades" })} testID="row.nav.grades" />
          {builtPlanTabs.map((part) => (
            <Row
              key={part}
              leading={glyph(PART_ICON[part])}
              title={t(`plan.tab.${part}`)}
              trailing={count(badges[part])}
              onPress={() => nav.go({ screen: "plan", tab: part })}
              testID={`row.nav.plan.${part}`}
            />
          ))}
        </List>
      </Section>
    </View>
  );
}

/** The Student, as the desktop's sidebar footer shows them, and their IPK and SKS: one card, the way to the account. */
function Profile() {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const account = useDataset("edunex.account");
  const student = useDataset("six.student");
  const record = useStudentRecord();
  const name = account?.name ?? student?.name;
  const ipk = record?.transcript ? shownIndex(record.transcript.ipk) : null;
  const sks = record ? passedSks(record) : null;
  return (
    <Card variant="raised" testID="card.profile">
      <Row
        leading={
          <View
            style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: theme.color.primaryContainer, alignItems: "center", justifyContent: "center" }}
          >
            {name ? (
              <Text size="titleMedium" tone="onPrimaryContainer">
                {initials(name)}
              </Text>
            ) : (
              <Icons.User size={22} color={theme.color.onPrimaryContainer} />
            )}
          </View>
        }
        title={
          <Text size="titleMedium" numberOfLines={2}>
            {name ? displayName(name) : t("nav.settings")}
          </Text>
        }
        meta={name ? factsLabel(account?.nim ?? student?.nim, student?.program) || undefined : undefined}
        onPress={() => router.push("/settings")}
        label={name ? `${displayName(name)}, ${t("mobile.account.open")}` : t("mobile.account.open")}
        testID="row.nav.account"
      />
      {record?.transcript && (
        <View style={{ paddingHorizontal: space[4], paddingBottom: space[4], paddingTop: space[1] }}>
          <StatRow>
            <Stat label={t("grades.chart.ipk")} value={ipk === null ? "-" : f.number(ipk, 2)} />
            <Stat label={t("grades.sksPassed")} value={sks === null || sks === undefined ? "-" : String(sks)} />
          </StatRow>
        </View>
      )}
    </Card>
  );
}
