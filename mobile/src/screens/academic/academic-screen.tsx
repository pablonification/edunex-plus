// Akademik (the tab that replaced Lainnya): where the Student's studies stand at a glance, then what
// to take care of this term, then every academic screen as a row that answers its own question.
// 1. One leading card: the IPK big, SKS passed beside it (the whole card opens Nilai; the avatar in the
//    top bar is the way to the account and Settings, so the card isn't a second one).
// 2. To-do chips, only while there's something to do (send the KRS, pay UKT, fill in the questionnaire
//    SIX hides grades behind), each opening its screen.
// 3. Nilai and Rencana studi's parts (Rencana, Kurikulum, KRS, UKT, Kalender akademik), each a stack
//    screen, each row with one line of its own state. The screens' content lives in their own files.
import { memo, type ReactNode, useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { useDeadlines, useThisTerm } from "../../../../src/app/deadlines";
import { useFormat, useNow, useT } from "../../../../src/app/i18n";
import { displayName } from "../../../../src/app/names";
import { type Badge as BadgeValue, usePlanTabBadges } from "../../../../src/app/shell/badges";
import { builtPlanTabs, type PlanTab } from "../../../../src/app/shell/built";
import { useDataset, useStatus } from "../../../../src/app/store";
import { usePlan, useStudentRecord } from "../../../../src/app/study-plan";
import { billUrgency, krsOverlaps, krsStage } from "../../../../src/core/academic";
import { checkPlan, passedSks, type Rule, type StudentRecord } from "../../../../src/core/planner";
import { useNav } from "../../nav";
import { SixEmptyState } from "../../shell/source-status";
import { Badge, Card, Skeleton } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { factsLabel, List, Row, Section } from "../../ui/layout";
import { Text, type TextTone } from "../../ui/text";
import { shape, space, TOUCH, useTheme } from "../../ui/theme";
import { shownIndex } from "../grades/transcript";

type IconKind = (typeof Icons)[keyof typeof Icons];

const PART_ICON: Readonly<Record<PlanTab, IconKind>> = {
  planner: Icons.Route,
  curriculum: Icons.Layers,
  krs: Icons.CalendarCheck,
  bills: Icons.Wallet,
  deadlines: Icons.CalendarClock,
};

/** What a to-do chip says, for a part whose badge is a warning (something the Student has to do now). */
const TODO: Partial<Record<PlanTab, "mobile.academic.todo.krs" | "mobile.academic.todo.bills" | "mobile.academic.todo.deadlines">> = {
  krs: "mobile.academic.todo.krs",
  bills: "mobile.academic.todo.bills",
  deadlines: "mobile.academic.todo.deadlines",
};

export function AcademicContent() {
  const t = useT();
  const badges = usePlanTabBadges();
  const record = useStudentRecord();
  const theme = useTheme();
  const six = useStatus("six");
  const student = useDataset("six.student");
  const todos = builtPlanTabs.filter((part) => TODO[part] && badges[part]?.tone === "warning");
  return (
    <View style={{ gap: space[6] }}>
      {record?.transcript ? (
        <Standing record={record} />
      ) : student || six.state === "connecting" || six.state === "live" ? (
        <StandingSkeleton />
      ) : (
        <SixEmptyState icon={<Icons.GraduationCap size={24} color={theme.color.onSecondaryContainer} />} title={t("mobile.academic.noIpk")} />
      )}
      {todos.length > 0 && <Todos parts={todos} />}
      <Section title={t("mobile.academic.screens")} first>
        <List>
          <ScreenRow icon={Icons.ClipboardCheck} title={t("nav.grades")} meta={<GradesMeta record={record} />} route="grades" testID="row.nav.grades" />
          {builtPlanTabs.map((part) => (
            <ScreenRow
              key={part}
              icon={PART_ICON[part]}
              title={t(`plan.tab.${part}`)}
              meta={<PartMeta part={part} record={record} />}
              badge={badges[part]}
              route={part}
              testID={`row.nav.plan.${part}`}
            />
          ))}
        </List>
      </Section>
    </View>
  );
}

// ------------------------------------------------------------ the leading card

/** The IPK and SKS passed, big: the answer the Student opens Akademik for. One target: Nilai. */
const Standing = memo(function Standing({ record }: { record: StudentRecord }) {
  const t = useT();
  const f = useFormat();
  const nav = useNav();
  const theme = useTheme();
  const account = useDataset("edunex.account");
  const student = useDataset("six.student");
  const name = account?.name ?? student?.name;
  const ipk = shownIndex(record.transcript!.ipk);
  const ipkText = ipk === null ? "-" : f.number(ipk, 2);
  const sks = passedSks(record);
  const sksText = sks === null ? "-" : String(sks);
  const who = factsLabel(name ? displayName(name) : null, account?.nim ?? student?.nim);
  return (
    <Card variant="raised" testID="card.profile">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={factsLabel(
          `${t("grades.chart.ipk")} ${ipkText}`,
          `${t("grades.sksPassed")} ${sksText} ${t("mobile.academic.sksOf", { need: record.graduationSks })}`,
          who,
        )}
        accessibilityHint={t("mobile.academic.openGrades")}
        onPress={() => nav.go({ screen: "grades" })}
        android_ripple={{ color: theme.color.selected }}
        style={{ padding: space[4], gap: space[3] }}
        testID="action.academic.grades"
      >
        {who ? (
          <Text size="bodyMedium" tone="muted" numberOfLines={2}>
            {who}
          </Text>
        ) : null}
        {/* Side by side while they fit; at a big font size the SKS goes under the IPK. */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", columnGap: space[8], rowGap: space[3] }}>
          <View>
            <Text size="labelLarge" tone="muted">
              {t("grades.chart.ipk")}
            </Text>
            <Text size="displaySmall" weight="semibold" tabular>
              {ipkText}
            </Text>
          </View>
          <View>
            <Text size="labelLarge" tone="muted">
              {t("grades.sksPassed")}
            </Text>
            <Text size="headlineMedium" weight="semibold" tabular>
              {sksText}
              <Text size="bodyLarge" tone="muted" tabular>
                {` ${t("mobile.academic.sksOf", { need: record.graduationSks })}`}
              </Text>
            </Text>
          </View>
        </View>
      </Pressable>
    </Card>
  );
});

/** The card's shape while SIX's record is on its way. */
function StandingSkeleton() {
  return (
    <Card variant="raised" style={{ padding: space[4], gap: space[3] }}>
      <Skeleton width="55%" height={14} />
      <View style={{ flexDirection: "row", gap: space[8] }}>
        <View style={{ gap: space[2] }}>
          <Skeleton width={40} height={14} />
          <Skeleton width={96} height={40} />
        </View>
        <View style={{ gap: space[2] }}>
          <Skeleton width={64} height={14} />
          <Skeleton width={96} height={32} />
        </View>
      </View>
    </Card>
  );
}

// ------------------------------------------------------------ to do

/** What to take care of this term, as assist chips: each opens its screen. */
function Todos({ parts }: { parts: readonly PlanTab[] }) {
  const t = useT();
  const nav = useNav();
  const theme = useTheme();
  const c = theme.color;
  return (
    <View style={{ gap: space[2] }} testID="section.academic.todo">
      <Text size="titleSmall" tone="muted" accessibilityRole="header">
        {t("mobile.academic.todo")}
      </Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>
        {parts.map((part) => {
          const Icon = part === "krs" ? Icons.CalendarCheck : part === "bills" ? Icons.Wallet : Icons.ClipboardCheck;
          return (
            <Pressable
              key={part}
              accessibilityRole="button"
              onPress={() => nav.go({ screen: "plan", tab: part })}
              hitSlop={{ top: (TOUCH - 32) / 2, bottom: (TOUCH - 32) / 2 }}
              android_ripple={{ color: c.selected }}
              testID={`action.todo.${part}`}
              style={{
                height: 32,
                flexDirection: "row",
                alignItems: "center",
                gap: space[2],
                paddingLeft: space[2],
                paddingRight: space[4],
                borderRadius: shape.sm,
                overflow: "hidden",
                backgroundColor: c.warningBg,
              }}
            >
              <Icon size={18} color={c.warningFg} />
              <Text size="labelLarge" tone="warning">
                {t(TODO[part]!)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// ------------------------------------------------------------ the screens

function ScreenRow({
  icon: Icon,
  title,
  meta,
  badge,
  route,
  testID,
}: {
  icon: IconKind;
  title: string;
  meta: ReactNode;
  badge?: BadgeValue;
  route: PlanTab | "grades";
  testID: string;
}) {
  const nav = useNav();
  const theme = useTheme();
  return (
    <Row
      leading={<Icon size={24} color={theme.color.onSurfaceVariant} />}
      title={title}
      meta={meta}
      // A clash still to come counts here, quietly; what must be done now is a chip above, and the tab's badge.
      trailing={badge && badge.tone !== "warning" ? <Badge>{badge.value}</Badge> : undefined}
      onPress={() => nav.go(route === "grades" ? { screen: "grades" } : { screen: "plan", tab: route })}
      testID={testID}
    />
  );
}

function MetaLine({ text, tone = "muted", icon }: { text: string | null; tone?: TextTone; icon?: ReactNode }) {
  if (!text) return null;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[1] }}>
      {icon}
      <Text size="bodyMedium" tone={tone} style={{ flexShrink: 1 }}>
        {text}
      </Text>
    </View>
  );
}

function GradesMeta({ record }: { record: StudentRecord | undefined }) {
  const t = useT();
  const f = useFormat();
  const text = useMemo(() => {
    if (!record?.transcript) return null;
    const ipk = shownIndex(record.transcript.ipk);
    if (ipk === null) return null;
    const last = record.transcript.terms.filter((term) => term.term !== record.term && shownIndex(term.ip) !== null).at(-1);
    const ip = last ? shownIndex(last.ip) : null;
    return ip === null
      ? t("mobile.academic.meta.gradesIpk", { ipk: f.number(ipk, 2) })
      : t("mobile.academic.meta.grades", { ipk: f.number(ipk, 2), ip: f.number(ip, 2) });
  }, [record, t, f]);
  return <MetaLine text={text} />;
}

function PartMeta({ part, record }: { part: PlanTab; record: StudentRecord | undefined }) {
  switch (part) {
    case "planner":
      return record ? <PlannerMeta record={record} /> : <NeedSixMeta />;
    case "curriculum":
      return record ? <CurriculumMeta record={record} /> : <NeedSixMeta />;
    case "krs":
      return <KrsMeta />;
    case "bills":
      return <BillsMeta />;
    case "deadlines":
      return <DeadlinesMeta />;
  }
}

function NeedSixMeta() {
  const t = useT();
  const six = useStatus("six");
  return six.state === "signed-out" || six.state === "expired" ? <MetaLine text={t("mobile.academic.meta.needSix")} /> : null;
}

/**
 * When the plan graduates. The plan's projection is the heaviest thing here, so it's worked out once the tab has
 * drawn, never on its first frame.
 */
function PlannerMeta({ record }: { record: StudentRecord }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // When the JS thread is idle (the tab is mounted ahead, at start-up), at the latest after a second.
    const task = requestIdleCallback(() => setReady(true), { timeout: 1000 });
    return () => cancelIdleCallback(task);
  }, []);
  return ready ? <PlannerFinish record={record} /> : null;
}

const PlannerFinish = memo(function PlannerFinish({ record }: { record: StudentRecord }) {
  const t = useT();
  const state = usePlan(record);
  const finish = useMemo(
    () =>
      state ? checkPlan(state.record, state.plan, state.projection).find((rule): rule is Extract<Rule, { id: "finish" }> => rule.id === "finish") : undefined,
    [state],
  );
  if (!finish) return null;
  if (finish.blocked) return <MetaLine text={t("mobile.academic.meta.plannerShort")} tone="warning" />;
  return <MetaLine text={t("mobile.academic.meta.plannerSemester", { n: finish.semester })} />;
});

function CurriculumMeta({ record }: { record: StudentRecord }) {
  const t = useT();
  const left = record.requiredLeft.length;
  return (
    <MetaLine
      text={factsLabel(
        t("mobile.academic.meta.curriculum", { passed: passedSks(record) ?? "-", need: record.graduationSks }),
        left ? t("mobile.academic.meta.curriculumRequired", { count: left }) : null,
      )}
    />
  );
}

function KrsMeta() {
  const t = useT();
  const now = useNow();
  const plan = useDataset("six.krs");
  const schedule = useDataset("six.schedule");
  const text = useMemo(() => {
    if (!plan) return null;
    const stage = krsStage(plan);
    const clashes = krsOverlaps(
      plan.courses.map((c) => c.code),
      schedule ?? [],
      now,
    ).filter((o) => o.upcoming).length;
    return {
      text: factsLabel(t(`krs.stage.${stage}`), clashes ? t("mobile.academic.meta.krsClash", { count: clashes }) : null),
      tone: (stage === "send" || stage === "ukt" || clashes ? "warning" : stage === "done" ? "success" : "muted") as TextTone,
    };
  }, [plan, schedule, now, t]);
  if (!plan) return <NeedSixMeta />;
  return <MetaLine text={text?.text ?? null} tone={text?.tone} />;
}

function BillsMeta() {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const bills = useDataset("six.bills");
  const term = useThisTerm();
  if (!bills) return <NeedSixMeta />;
  const billed = bills.filter((b) => b.status !== "not-billed");
  const bill = (term && bills.find((b) => b.term === term)) || billed.at(-1);
  if (!bill) return null;
  const urgency = billUrgency(bill, now);
  if (urgency === "overdue") return <MetaLine text={t("bills.status.overdue")} tone="danger" />;
  if ((urgency === "soon" || urgency === "due") && bill.nextDueAt !== null)
    return <MetaLine text={t("mobile.academic.meta.billsDue", { date: f.dayMonth(bill.nextDueAt) })} tone={urgency === "soon" ? "warning" : "muted"} />;
  return <MetaLine text={t(`bills.status.${bill.status}`)} tone={bill.status === "paid" ? "success" : "muted"} />;
}

function DeadlinesMeta() {
  const t = useT();
  const f = useFormat();
  const { upcoming } = useDeadlines();
  const next = upcoming[0];
  if (!next) return null;
  const what = t(`deadline.kind.${next.event.kind}` as Parameters<typeof t>[0]);
  return (
    <MetaLine
      text={
        next.when === "now"
          ? t("mobile.academic.meta.deadlineNow", { what })
          : t("mobile.academic.meta.deadlineNext", { what, date: f.dayMonth(next.event.start) })
      }
    />
  );
}
