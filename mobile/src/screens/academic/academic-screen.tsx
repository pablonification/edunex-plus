// Profil (direction B; the tab that was Akademik): the Student, then everything Akademik held.
// 1. Who: the initials big in a filled circle, the name, the NIM and the program, centred on the white page.
// 2. Counts to tap, the official app's logbook numbers: the IPK (opens Nilai), the SKS passed (Kurikulum), the semester
//    (Rencana). While SIX's record is on its way they stand in their shape; without SIX, the way to connect.
// 3. To-do chips, only while something's due (send the KRS, pay UKT, fill in the questionnaire), each opening its screen.
// 4. "Studi": Nilai and Rencana studi's parts as rows on the page, each with its round mark (the same glyph and colour
//    as on Beranda's grid), the one line that answers it and at most one status pill.
// 5. "Aplikasi": the account and Settings, and reporting a problem.

import { router } from "expo-router";
import { memo, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { useDeadlines, useThisTerm } from "../../../../src/app/deadlines";
import { useFormat, useNow, useT } from "../../../../src/app/i18n";
import { displayName, initials } from "../../../../src/app/names";
import { usePlanTabBadges } from "../../../../src/app/shell/badges";
import { builtPlanTabs, type PlanTab } from "../../../../src/app/shell/built";
import { useDataset, useStatus } from "../../../../src/app/store";
import { usePlan, useStudentRecord } from "../../../../src/app/study-plan";
import { billUrgency, type KrsStage, krsOverlaps, krsStage } from "../../../../src/core/academic";
import { checkPlan, passedSks, type Rule, type StudentRecord } from "../../../../src/core/planner";
import { useNav } from "../../nav";
import { together } from "../../parts/day-word";
import { useSignIn } from "../../shell/source-status";
import { BHeading, BRow, CountCell, CountStrip, ServiceCircle, type ServiceTone, useB } from "../../ui/b";
import { BigButton } from "../../ui/big-button";
import { Skeleton } from "../../ui/display";
import { Rise } from "../../ui/expressive";
import { Fluent, type FluentName } from "../../ui/fluent";
import { IconTile, Panel, Pill, type PillTone } from "../../ui/group";
import { Icons } from "../../ui/icons";
import { factsLabel } from "../../ui/layout";
import { Part } from "../../ui/parts";
import { PressScale } from "../../ui/press";
import { Text } from "../../ui/text";
import { space, TOUCH, useTheme } from "../../ui/theme";
import { shownIndex } from "../grades/transcript";

type IconKind = (typeof Icons)[keyof typeof Icons];
type MetaTone = "muted" | "red" | "amber" | "ok";

/** Each screen's round mark: the glyph and colour it has on Beranda's grid. */
const MARK: Readonly<Record<PlanTab | "grades", { icon: FluentName; tone: ServiceTone }>> = {
  grades: { icon: "Ribbon24Filled", tone: "amber" },
  planner: { icon: "HatGraduation24Filled", tone: "magenta" },
  curriculum: { icon: "Library24Filled", tone: "lime" },
  krs: { icon: "Form24Filled", tone: "indigo" },
  bills: { icon: "Wallet24Filled", tone: "teal" },
  deadlines: { icon: "CalendarLtr24Filled", tone: "blue" },
};

/** What a to-do chip says, for a part whose badge is a warning (something the Student has to do now). */
const TODO: Partial<Record<PlanTab, { key: "mobile.academic.todo.krs" | "mobile.academic.todo.bills" | "mobile.academic.todo.deadlines"; icon: IconKind }>> = {
  krs: { key: "mobile.academic.todo.krs", icon: Icons.CalendarCheck },
  bills: { key: "mobile.academic.todo.bills", icon: Icons.Wallet },
  deadlines: { key: "mobile.academic.todo.deadlines", icon: Icons.PenLine },
};

/** The KRS row's pill for each stage: amber while the Student has something to do, green once it's official. */
const KRS_TONE: Readonly<Record<KrsStage, PillTone>> = { send: "amber", advisor: "plain", ukt: "amber", official: "brand", done: "ok" };

/** A source's first read is still running: what it brings stands in its shape until it's here. */
function useFirstRead(source: "six" | "itb"): boolean {
  const status = useStatus(source);
  return status.state === "connecting" || (status.state === "live" && status.updatedAt === null);
}

export function AcademicContent() {
  const t = useT();
  const badges = usePlanTabBadges();
  const record = useStudentRecord();
  const six = useStatus("six");
  const student = useDataset("six.student");
  const todos = builtPlanTabs.filter((part) => TODO[part] && badges[part]?.tone === "warning");
  return (
    <View>
      <Rise screen="academic" index={0}>
        <Who />
        {record?.transcript ? (
          <Standing record={record} />
        ) : student || six.state === "connecting" || six.state === "live" ? (
          <StandingPending />
        ) : (
          <ConnectSix />
        )}
      </Rise>
      {todos.length > 0 && (
        <Rise screen="academic" index={1} style={{ marginTop: space[4] }}>
          <Todos parts={todos} />
        </Rise>
      )}
      {/* The screens under the counts: a part of their own on a first draw ahead (../../ui/parts.tsx). */}
      <Part at={1}>
        <Rise screen="academic" index={2} style={{ marginTop: space[6] }}>
          <BHeading>{t("mobile.profile.studies")}</BHeading>
          <View testID="section.academic.screens">
            <GradesRow record={record} />
            <PlannerRow record={record} />
            <CurriculumRow record={record} />
            <KrsRow />
            <BillsRow />
            <DeadlinesRow />
          </View>
        </Rise>
        <Rise screen="academic" index={3} style={{ marginTop: space[6] }}>
          <BHeading>{t("mobile.profile.app")}</BHeading>
          <AppRows />
        </Rise>
      </Part>
    </View>
  );
}

// ------------------------------------------------------------ who

/** The Student: their initials in a filled circle, the name, the NIM and the program. */
function Who() {
  const b = useB();
  const account = useDataset("edunex.account");
  const student = useDataset("six.student");
  const name = account?.name ?? student?.name;
  const facts = factsLabel(account?.nim ?? student?.nim, student?.program);
  return (
    <View
      testID="card.profile"
      accessible
      accessibilityLabel={factsLabel(name ? displayName(name) : null, facts)}
      style={{ alignItems: "center", paddingTop: space[2] }}
    >
      <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: b.brand, alignItems: "center", justifyContent: "center" }}>
        {name ? (
          <Text size="headlineMedium" face="display" weight="bold" style={{ color: b.onBrand, letterSpacing: -0.5 }}>
            {initials(name)}
          </Text>
        ) : (
          <Fluent name="Person24Filled" color={b.onBrand} size={40} />
        )}
      </View>
      {name ? (
        <Text
          size="titleLarge"
          face="display"
          weight="bold"
          numberOfLines={2}
          style={{ color: b.fg, letterSpacing: -0.3, textAlign: "center", marginTop: space[3] }}
        >
          {displayName(name)}
        </Text>
      ) : null}
      {facts ? (
        <Text size="bodyMedium" numberOfLines={2} style={{ color: b.muted, textAlign: "center", marginTop: 2 }}>
          {facts}
        </Text>
      ) : null}
    </View>
  );
}

// ------------------------------------------------------------ the counts

/** The IPK, the SKS passed and the semester, as counts to tap: each opens the screen with its detail. */
const Standing = memo(function Standing({ record }: { record: StudentRecord }) {
  const t = useT();
  const f = useFormat();
  const nav = useNav();
  const ipk = shownIndex(record.transcript!.ipk);
  const sks = passedSks(record);
  return (
    <View style={{ marginTop: space[5] }}>
      <CountStrip testID="profile.counts">
        <CountCell
          value={ipk === null ? "-" : f.number(ipk, 2)}
          label={t("grades.chart.ipk")}
          onPress={() => nav.go({ screen: "grades" })}
          accessibilityHint={t("mobile.academic.openGrades")}
          testID="action.academic.grades"
        />
        <CountCell
          value={sks === null ? "-" : String(sks)}
          label={t("grades.sksPassed")}
          onPress={() => nav.go({ screen: "plan", tab: "curriculum" })}
          testID="action.academic.sks"
        />
        {record.semesterNow !== null ? (
          <CountCell
            value={String(record.semesterNow)}
            label={t("mobile.profile.semester")}
            onPress={() => nav.go({ screen: "plan", tab: "planner" })}
            testID="action.academic.semester"
          />
        ) : null}
      </CountStrip>
    </View>
  );
});

/** The counts' shape while SIX's record is on its way. */
function StandingPending() {
  const t = useT();
  const nav = useNav();
  return (
    <View accessibilityState={{ busy: true }} testID="academic.loading" style={{ marginTop: space[5] }}>
      <CountStrip>
        <CountCell pending value="" label={t("grades.chart.ipk")} onPress={() => nav.go({ screen: "grades" })} />
        <CountCell pending value="" label={t("grades.sksPassed")} onPress={() => nav.go({ screen: "plan", tab: "curriculum" })} />
      </CountStrip>
    </View>
  );
}

/** No SIX to read the IPK from: whose record it is (from Edunex), where the IPK will show, and the way to connect while SIX isn't signed in. */
function ConnectSix() {
  const t = useT();
  const v = useTheme().v4;
  const status = useStatus("six");
  const { signIn, busy } = useSignIn();
  return (
    <Panel style={{ padding: space[5], gap: space[4], marginTop: space[5] }} testID="academic.noSix">
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
        <IconTile icon={(color) => <Icons.GraduationCap size={24} color={color} />} />
        <Text size="bodyLarge" style={{ color: v.fg, flex: 1 }}>
          {t("mobile.academic.noIpk")}
        </Text>
      </View>
      {status.state === "signed-out" && (
        // Quiet: the outline one, so the empty card doesn't shout. Disabled while the sign-in page is open.
        <BigButton variant="outline" onPress={busy ? undefined : () => void signIn("six")} testID="action.academic.signIn">
          {t("action.signInTo", { source: "SIX" })}
        </BigButton>
      )}
    </Panel>
  );
}

// ------------------------------------------------------------ to do

/** What to take care of this term, as tonal chips: each opens its screen. */
function Todos({ parts }: { parts: readonly PlanTab[] }) {
  const t = useT();
  const nav = useNav();
  const v = useTheme().v4;
  return (
    <View accessibilityLabel={t("mobile.academic.todo")} style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }} testID="section.academic.todo">
      {parts.map((part) => {
        const { key, icon: Icon } = TODO[part]!;
        return (
          <PressScale
            key={part}
            onPress={() => nav.go({ screen: "plan", tab: part })}
            testID={`action.todo.${part}`}
            style={{
              minHeight: TOUCH,
              flexDirection: "row",
              alignItems: "center",
              gap: space[2],
              paddingLeft: space[3.5],
              paddingRight: space[4],
              borderRadius: TOUCH / 2,
              backgroundColor: v.ambBg,
            }}
          >
            <Icon size={20} color={v.ambFg} />
            <Text size="labelLarge" weight="semibold" style={{ color: v.ambFg }}>
              {t(key)}
            </Text>
          </PressScale>
        );
      })}
    </View>
  );
}

// ------------------------------------------------------------ the screens

/** A screen's row on the page: its round mark, its name, the one line that answers it (or that line's shape while SIX reads), one pill. */
function ScreenRow({
  title,
  meta,
  tone = "muted",
  pill,
  route,
  last = false,
  testID,
}: {
  title: string;
  /** The line; `"pending"` while what it says is still on its way. */
  meta: string | null | "pending";
  tone?: MetaTone;
  pill?: { tone: PillTone; text: string } | null;
  route: PlanTab | "grades";
  last?: boolean;
  testID: string;
}) {
  const nav = useNav();
  const b = useB();
  const mark = MARK[route];
  return (
    <BRow
      leading={<ServiceCircle icon={mark.icon} tone={mark.tone} size={44} />}
      title={title}
      meta={meta === "pending" ? <Skeleton width={128} height={12} style={{ marginTop: space[1] }} /> : (meta ?? undefined)}
      metaColor={tone === "red" ? b.red : tone === "amber" ? b.amber : tone === "ok" ? b.ok : undefined}
      trailing={
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          {pill ? <Pill tone={pill.tone}>{pill.text}</Pill> : null}
          <Fluent name="ChevronRight20Regular" color={b.muted} />
        </View>
      }
      last={last}
      onPress={() => nav.go(route === "grades" ? { screen: "grades" } : { screen: "plan", tab: route })}
      testID={testID}
    />
  );
}

/** The app's own rows: the account and Settings (once the avatar in every top bar), and reporting a problem. */
function AppRows() {
  const t = useT();
  const b = useB();
  const chevron = <Fluent name="ChevronRight20Regular" color={b.muted} />;
  return (
    <View testID="section.profile.app">
      <BRow
        leading={<ServiceCircle icon="Settings24Filled" tone="grey" size={44} />}
        title={t("mobile.account.open")}
        trailing={chevron}
        onPress={() => router.push("/settings")}
        testID="action.account"
      />
      <BRow
        leading={<ServiceCircle icon="PersonFeedback24Filled" tone="green" size={44} />}
        title={t("mobile.profile.report")}
        trailing={chevron}
        last
        onPress={() => router.push("/report")}
        testID="action.report"
      />
    </View>
  );
}

/**
 * What a row says while its data isn't here: its shape during SIX's first read, else nothing. Without SIX the leading
 * card says so once, with the way to connect (and the banner under the bar when the session ran out), not every row.
 */
function useMissingMeta(): null | "pending" {
  return useFirstRead("six") ? "pending" : null;
}

function GradesRow({ record }: { record: StudentRecord | undefined }) {
  const t = useT();
  const f = useFormat();
  const missing = useMissingMeta();
  // The card over it says the IPK: the row says what the card doesn't, the last term's IP.
  const text = useMemo(() => {
    if (!record?.transcript) return null;
    const last = record.transcript.terms.filter((term) => term.term !== record.term && shownIndex(term.ip) !== null).at(-1);
    const ip = last ? shownIndex(last.ip) : null;
    // Named as Nilai names it.
    return ip === null ? null : t("mobile.grades.lastIp", { ip: f.number(ip, 2) });
  }, [record, t, f]);
  return <ScreenRow title={t("nav.grades")} meta={record?.transcript ? text : missing} route="grades" testID="row.nav.grades" />;
}

/**
 * When the plan graduates. The plan's projection is the heaviest thing here, so it's worked out once the tab has
 * drawn, never on its first frame; until then the line stands in its shape.
 */
function PlannerRow({ record }: { record: StudentRecord | undefined }) {
  const t = useT();
  const missing = useMissingMeta();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // When the JS thread is idle (the tab is mounted ahead, at start-up), at the latest after a second.
    const task = requestIdleCallback(() => setReady(true), { timeout: 1000 });
    return () => cancelIdleCallback(task);
  }, []);
  if (record && ready) return <PlannerFinish record={record} />;
  return <PartRow part="planner" meta={record ? "pending" : missing} title={t("plan.tab.planner")} />;
}

const PlannerFinish = memo(function PlannerFinish({ record }: { record: StudentRecord }) {
  const t = useT();
  const state = usePlan(record);
  const finish = useMemo(
    () =>
      state ? checkPlan(state.record, state.plan, state.projection).find((rule): rule is Extract<Rule, { id: "finish" }> => rule.id === "finish") : undefined,
    [state],
  );
  const title = t("plan.tab.planner");
  if (!finish) return <PartRow part="planner" meta={null} title={title} />;
  if (finish.blocked) return <PartRow part="planner" meta={t("mobile.academic.meta.plannerShort")} tone="amber" title={title} />;
  return <PartRow part="planner" meta={t("mobile.academic.meta.plannerSemester", { n: finish.semester })} title={title} />;
});

/** One of Rencana studi's parts as a row: it opens that part's screen. */
function PartRow({
  part,
  title,
  meta,
  tone,
  pill,
}: {
  part: PlanTab;
  title: string;
  meta: string | null | "pending";
  tone?: MetaTone;
  pill?: { tone: PillTone; text: string } | null;
}) {
  return <ScreenRow title={title} meta={meta} tone={tone} pill={pill} route={part} last={part === "deadlines"} testID={`row.nav.plan.${part}`} />;
}

function CurriculumRow({ record }: { record: StudentRecord | undefined }) {
  const t = useT();
  const missing = useMissingMeta();
  // The card over it says the SKS passed of those needed ("125 dari 144"): the row adds nothing to it.
  return <PartRow part="curriculum" title={t("plan.tab.curriculum")} meta={record ? null : missing} />;
}

function KrsRow() {
  const t = useT();
  const now = useNow();
  const plan = useDataset("six.krs");
  const schedule = useDataset("six.schedule");
  const missing = useMissingMeta();
  const shown = useMemo(() => {
    if (!plan) return null;
    const stage = krsStage(plan);
    const clashes = krsOverlaps(
      plan.courses.map((c) => c.code),
      schedule ?? [],
      now,
    ).filter((o) => o.upcoming).length;
    return {
      // The SKS taken as the line, the plan's one status as the pill: a clash still to come (worth a question to the
      // lecturer) over the plan's stage.
      text: t("krs.sks", { sks: plan.sks ?? "-" }),
      pill: clashes
        ? { tone: "amber" as const, text: t("mobile.academic.pill.clash", { count: clashes }) }
        : { tone: KRS_TONE[stage], text: t(`krs.stage.${stage}`) },
    };
  }, [plan, schedule, now, t]);
  return <PartRow part="krs" title={t("plan.tab.krs")} meta={shown ? shown.text : missing} pill={shown?.pill} />;
}

/** UKT: this term's bill (else the last billed) as the row's one pill: paid, the date it's due by, or overdue. */
function BillsRow() {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const bills = useDataset("six.bills");
  const term = useThisTerm();
  const missing = useMissingMeta();
  const title = t("plan.tab.bills");
  if (!bills) return <PartRow part="bills" title={title} meta={missing} />;
  const billed = bills.filter((b) => b.status !== "not-billed");
  const bill = (term && bills.find((b) => b.term === term)) || billed.at(-1);
  if (!bill) return <PartRow part="bills" title={title} meta={null} />;
  const urgency = billUrgency(bill, now);
  const pill: { tone: PillTone; text: string } =
    urgency === "overdue"
      ? { tone: "red", text: t("bills.status.overdue") }
      : (urgency === "soon" || urgency === "due") && bill.nextDueAt !== null
        ? { tone: urgency === "soon" ? "amber" : "plain", text: t("mobile.academic.pill.billsDue", { date: f.dayMonth(bill.nextDueAt) }) }
        : { tone: bill.status === "paid" ? "ok" : "plain", text: t(`bills.status.${bill.status}`) };
  return <PartRow part="bills" title={title} meta={null} pill={pill} />;
}

function DeadlinesRow() {
  const t = useT();
  const f = useFormat();
  const { upcoming } = useDeadlines();
  const calendar = useDataset("itb.calendar");
  const reading = useFirstRead("itb");
  const next = upcoming[0];
  const title = t("plan.tab.deadlines");
  if (!next) return <PartRow part="deadlines" title={title} meta={!calendar && reading ? "pending" : null} />;
  // A name that ran to two lines at font 1.1 ("Kuesioner evaluasi perkuliahan · 30 Nov") goes by its short one.
  const what =
    next.event.kind === "questionnaire" ? t("mobile.academic.deadline.questionnaire") : t(`deadline.kind.${next.event.kind}` as Parameters<typeof t>[0]);
  return (
    <PartRow
      part="deadlines"
      title={title}
      meta={
        next.when === "now"
          ? t("mobile.academic.meta.deadlineNow", { what })
          : // The date held together ("30 Nov"), never broken across two lines.
            t("mobile.academic.meta.deadlineNext", { what, date: together(f.dayMonth(next.event.start)) })
      }
    />
  );
}
