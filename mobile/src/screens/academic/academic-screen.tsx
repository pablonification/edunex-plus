// Profil (the tab that was Akademik): the Student's record, and the only way to the account and Settings.
// 1. One card, the tab's one block of colour and its shape at a squint: the initials small, the name, the NIM and the
//    programme, the IPK big, the SKS passed as a bar of those needed ("125 dari 144"). The whole card opens Nilai.
//    While SIX's record is on its way the figures stand in their shape; without SIX the card says so once, with the
//    way in, and the rows that are SIX's are gone (never six broken rows).
// 2. "Akademikmu" (the Student's own record, so the tab's name is true): Nilai and Rencana studi's parts as rows on the page, each with its service's mark (read from the
//    service list by id, so it's the same on Beranda and Semua layanan) and one line that says its state.
// 3. "Akun": Edunex and SIX with their state and the way to sign back in, Notifikasi, Pengaturan, Laporkan masalah.
//    Signing out lives in Pengaturan, never beside these.

import { router, useIsFocused } from "expo-router";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { View } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from "react-native-reanimated";
import { useDeadlines, useThisTerm } from "../../../../src/app/deadlines";
import { useFormat, useLang, useNow, useT } from "../../../../src/app/i18n";
import { displayName, initials } from "../../../../src/app/names";
import type { PlanTab } from "../../../../src/app/shell/built";
import { useDataset, useStatus } from "../../../../src/app/store";
import { usePlan, useStudentRecord } from "../../../../src/app/study-plan";
import { billUrgency, krsOverlaps, krsStage } from "../../../../src/core/academic";
import type { SourceId } from "../../../../src/core/models";
import { checkPlan, passedSks, type Rule, type StudentRecord } from "../../../../src/core/planner";
import { useNav } from "../../nav";
import { together } from "../../parts/day-word";
import { useRefresh, useSignIn, useUnreadAlerts } from "../../shell/source-status";
import { BHeading, BRow, ServiceCircle, useB } from "../../ui/b";
import { Skeleton } from "../../ui/display";
import { Rise } from "../../ui/expressive";
import { Icons } from "../../ui/icons";
import { factsLabel } from "../../ui/layout";
import { useReduceMotion } from "../../ui/motion";
import { RollTo, Tap } from "../../ui/moves";
import { Part } from "../../ui/parts";
import { Text } from "../../ui/text";
import { font, motion, space, THEMES, TOUCH } from "../../ui/theme";
import { shownIndex } from "../grades/transcript";
import { HOME_SERVICES, SERVICE_GROUPS, type Service } from "../services/list";

type MetaTone = "muted" | "red" | "amber" | "ok";
/** A row's one line. `lead` is a plain fact said before the state ("14 SKS" before "1 bentrok"): only the state takes the tone. */
type Meta = { text: string; tone?: MetaTone; lead?: string } | "pending" | null;

/** Every service by its id: a row's mark is the one the service has on Beranda and Semua layanan. */
const SERVICE: ReadonlyMap<string, Service> = new Map([...HOME_SERVICES, ...SERVICE_GROUPS.flatMap((group) => group.services)].map((s) => [s.id, s]));
/** Rencana studi's parts, by the id their service has in the list. */
const SERVICE_OF: Readonly<Record<PlanTab | "grades", string>> = {
  grades: "grades",
  planner: "planner",
  curriculum: "curriculum",
  krs: "krs",
  bills: "bills",
  deadlines: "calendar",
};
const MARK = 44;

/** A service's mark at a row's start, from the service list. */
function Mark({ id }: { id: string }) {
  const service = SERVICE.get(id);
  if (!service) return <View style={{ width: MARK, height: MARK }} />;
  return <ServiceCircle icon={service.icon} tone={service.tone} size={MARK} />;
}

/** A source's first read is still running: what it brings stands in its shape until it's here. */
function useFirstRead(source: "six" | "itb"): boolean {
  const status = useStatus(source);
  return status.state === "connecting" || (status.state === "live" && status.updatedAt === null);
}

/**
 * What SIX's part of the tab can show: the record ("here"; also a first-term Student SIX has read but has no grades
 * for yet, said in words), its shape while the first read runs, or nothing to read it from.
 */
function useSixState(record: StudentRecord | undefined): "here" | "reading" | "none" {
  const six = useStatus("six");
  const firstRead = useFirstRead("six");
  if (record?.transcript) return "here";
  if (firstRead) return "reading";
  return six.state === "live" ? "here" : "none";
}

export function AcademicContent() {
  const t = useT();
  const record = useStudentRecord();
  const six = useSixState(record);
  return (
    <View>
      <Rise screen="academic" index={0}>
        <StudentCard record={record} six={six} />
      </Rise>
      {/* The rows under the card: a part of their own on a first draw ahead (../../ui/parts.tsx). */}
      <Part at={1}>
        {/* A tighter rhythm than the other tabs': the sixth row (Kalender akademik) stands whole over the tab bar at font 1.1. */}
        <Rise screen="academic" index={1} style={{ marginTop: space[3] }}>
          <BHeading style={{ marginBottom: space[1] }}>{t("mobile.profile.record")}</BHeading>
          <View testID="section.academic.screens">
            {/* Without SIX the card says so once: only the calendar (ITB's own) has something to show. */}
            {six !== "none" && (
              <>
                <GradesRow record={record} />
                <PlannerRow record={record} />
                <CurriculumRow record={record} />
                <KrsRow />
                <BillsRow />
              </>
            )}
            <DeadlinesRow />
          </View>
        </Rise>
        <Rise screen="academic" index={2} style={{ marginTop: space[4] }}>
          <BHeading>{t("settings.accounts")}</BHeading>
          <AccountRows />
        </Rise>
      </Part>
    </View>
  );
}

// ------------------------------------------------------------ the card

/**
 * The card's colours: the brand's strong blue with white on it, the same block in both themes, as Ujian's hero keeps
 * its course colour in dark. The dark theme's own `brand` is a pale blue made for words and marks on a dark page: as a
 * card's fill it went pale beside the vivid purple and exam cards (round 2's council), so the card takes the light
 * theme's blue in both (white on it 5.4:1).
 */
const CARD_INK = {
  bg: THEMES.light.v4.brand,
  ink: THEMES.light.v4.onBrand,
  ink2: THEMES.light.v4.onBrand,
  chip: THEMES.light.v4.onBrand,
  onChip: THEMES.light.v4.brand,
  track: "rgba(255,255,255,0.3)",
  fill: THEMES.light.v4.onBrand,
} as const;
function useCardInk() {
  return CARD_INK;
}
type CardInk = typeof CARD_INK;

/** The Student and where they stand: one card, one target (Nilai). */
const StudentCard = memo(function StudentCard({ record, six }: { record: StudentRecord | undefined; six: "here" | "reading" | "none" }) {
  const t = useT();
  const f = useFormat();
  const nav = useNav();
  const c = useCardInk();
  const account = useDataset("edunex.account");
  const student = useDataset("six.student");
  const name = account?.name ?? student?.name;
  const shown = name ? displayName(name) : null;
  const facts = factsLabel(account?.nim ?? student?.nim, student?.program);
  const card = { borderRadius: 24, backgroundColor: c.bg, paddingHorizontal: space[5], paddingVertical: space[4], gap: space[3], overflow: "hidden" } as const;
  const who = (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
      <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.chip, alignItems: "center", justifyContent: "center" }}>
        {name ? (
          <Text size="titleMedium" face="display" weight="bold" allowFontScaling={false} style={{ color: c.onChip, fontSize: 16, lineHeight: 22 }}>
            {initials(name)}
          </Text>
        ) : (
          <Icons.User size={24} color={c.onChip} weight="fill" />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        {shown ? (
          <Text size="titleMedium" face="display" weight="bold" numberOfLines={2} style={{ color: c.ink, fontSize: 18, lineHeight: 24, letterSpacing: -0.2 }}>
            {shown}
          </Text>
        ) : null}
        {facts ? (
          <Text size="bodyMedium" numberOfLines={2} style={{ color: c.ink2 }}>
            {facts}
          </Text>
        ) : null}
      </View>
      {six !== "none" && <Icons.ChevronRight size={20} color={c.ink} />}
    </View>
  );
  if (six === "none") {
    return (
      <View testID="card.profile" style={card}>
        {who}
        <ConnectSix ink={c} />
      </View>
    );
  }
  const ipk = record?.transcript ? shownIndex(record.transcript.ipk) : null;
  const sks = record ? passedSks(record) : null;
  const need = record?.graduationSks ?? 0;
  const said =
    six === "here"
      ? factsLabel(
          ipk === null ? t("mobile.profile.noGrades") : `${t("grades.chart.ipk")} ${f.number(ipk, 2)}`,
          sks === null ? null : `${t("grades.sksPassed")} ${sks} ${need > 0 ? t("mobile.academic.sksOf", { need }) : ""}`,
        )
      : null;
  return (
    <Tap
      feel="card"
      onPress={() => nav.go({ screen: "grades" })}
      testID="card.profile"
      accessibilityLabel={factsLabel(shown, facts, said)}
      accessibilityHint={t("mobile.academic.openGrades")}
      accessibilityState={{ busy: six === "reading" }}
      style={card}
    >
      {who}
      {six === "here" ? <Standing ipk={ipk} sks={sks} need={need} ink={c} /> : <StandingPending ink={c} />}
    </Tap>
  );
});

/** The IPK big, the SKS passed as a bar of those needed. A first-term Student with no grades yet reads so in words, never "-". */
function Standing({ ipk, sks, need, ink }: { ipk: number | null; sks: number | null; need: number; ink: CardInk }) {
  const t = useT();
  const lang = useLang();
  return (
    // The numbers are read-only fields (RollTo): they take no touch, the card is the one target.
    <View
      testID="profile.standing"
      pointerEvents="none"
      style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", columnGap: space[5], rowGap: space[3] }}
    >
      {/* The label on the number's own line, at its foot: a line less of card, so the rows under it stand higher. */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", columnGap: space[2] }}>
        <Text size="labelLarge" style={{ color: ink.ink2, paddingBottom: space[2] }}>
          {t("grades.chart.ipk")}
        </Text>
        {ipk === null ? (
          <Text size="titleLarge" face="display" weight="bold" style={{ color: ink.ink, paddingBottom: space[1] }}>
            {t("mobile.profile.noGrades")}
          </Text>
        ) : (
          <RollTo
            value={ipk}
            decimals={2}
            comma={lang === "id"}
            testID="profile.ipk"
            style={{ fontFamily: font.display.extrabold, fontSize: 36, lineHeight: 42, letterSpacing: -1, color: ink.ink }}
          />
        )}
      </View>
      {sks !== null && (
        <View style={{ flexGrow: 1, flexBasis: 168, minWidth: 0, gap: space[2], paddingBottom: space[2] }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", columnGap: space[3] }}>
            <Text size="labelLarge" style={{ color: ink.ink2, paddingBottom: 3 }}>
              {t("grades.sksPassed")}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space[1] }}>
              <RollTo value={sks} testID="profile.sks" style={{ fontFamily: font.display.bold, fontSize: 20, lineHeight: 26, color: ink.ink }} />
              {need > 0 && (
                <Text size="bodyMedium" style={{ color: ink.ink2, paddingBottom: 3 }}>
                  {t("mobile.academic.sksOf", { need })}
                </Text>
              )}
            </View>
          </View>
          {need > 0 && <GrowingBar share={Math.max(0, Math.min(1, sks / need))} fill={ink.fill} track={ink.track} />}
        </View>
      )}
    </View>
  );
}

/** A plain bar that fills once, the first time the tab is looked at, then follows its value. Still with Remove animations. */
function GrowingBar({ share, fill, track }: { share: number; fill: string; track: string }) {
  const still = useReduceMotion();
  const focused = useIsFocused();
  const [width, setWidth] = useState(0);
  const at = useSharedValue(still ? share : 0);
  const grown = useRef(false);
  useEffect(() => {
    if (!focused && !grown.current) return;
    const first = !grown.current;
    grown.current = true;
    if (still) at.value = share;
    else if (first) at.value = withDelay(150, withTiming(share, { duration: motion.duration.long, easing: Easing.out(Easing.cubic) }));
    else at.value = withTiming(share, { duration: motion.duration.medium, easing: Easing.out(Easing.cubic) });
  }, [focused, share, still, at]);
  // The fill is the track's full width, slid in from its start: a transform only, so nothing is laid out per frame.
  const slide = useAnimatedStyle(() => ({ transform: [{ translateX: (at.value - 1) * width }] }));
  return (
    <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ height: 8, borderRadius: 4, backgroundColor: track, overflow: "hidden" }}>
      {width > 0 && <Animated.View style={[{ width: "100%", height: "100%", borderRadius: 4, backgroundColor: fill }, slide]} />}
    </View>
  );
}

/** The figures' shape while SIX's record is on its way. */
function StandingPending({ ink }: { ink: CardInk }) {
  const block = { borderRadius: 6, backgroundColor: ink.track } as const;
  return (
    <View testID="academic.loading" style={{ flexDirection: "row", alignItems: "flex-end", gap: space[5] }}>
      <View style={[block, { width: 96, height: 44 }]} />
      <View style={{ flex: 1, gap: space[3], paddingBottom: space[2] }}>
        <View style={[block, { width: "60%", height: 14 }]} />
        <View style={[block, { height: 8 }]} />
      </View>
    </View>
  );
}

/** No SIX to read from: what's missing, once, and the one way to fix it (sign in, or read again when it's signed in but unread). */
function ConnectSix({ ink }: { ink: CardInk }) {
  const t = useT();
  const status = useStatus("six");
  const { signIn, busy } = useSignIn();
  const { refresh, busy: reading } = useRefresh();
  const signedOut = status.state === "signed-out" || status.state === "expired";
  const waiting = signedOut ? busy : reading;
  return (
    <View testID="academic.noSix" style={{ gap: space[4] }}>
      <Text size="bodyLarge" style={{ color: ink.ink }}>
        {t(signedOut ? "mobile.profile.connectSix" : "mobile.profile.sixUnread")}
      </Text>
      <Tap
        feel="card"
        disabled={waiting}
        onPress={() => void (signedOut ? signIn("six") : refresh("six"))}
        testID="action.academic.signIn"
        style={{
          minHeight: TOUCH,
          borderRadius: TOUCH / 2,
          paddingHorizontal: space[5],
          backgroundColor: ink.chip,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          opacity: waiting ? 0.6 : 1,
        }}
      >
        <Text size="labelLarge" weight="semibold" style={{ color: ink.onChip }}>
          {signedOut ? t(status.state === "expired" ? "settings.signInAgainTo" : "action.signInTo", { source: "SIX" }) : t("action.tryAgain")}
        </Text>
      </Tap>
    </View>
  );
}

// ------------------------------------------------------------ the rows

function useMetaColor(tone: MetaTone | undefined): string | undefined {
  const b = useB();
  return tone === "red" ? b.red : tone === "amber" ? b.amber : tone === "ok" ? b.ok : undefined;
}

/** A screen's row on the page: its service's mark, its name, the one line that says its state (or that line's shape while SIX reads). */
function ScreenRow({ title, meta, route, last = false, testID }: { title: string; meta: Meta; route: PlanTab | "grades"; last?: boolean; testID: string }) {
  const nav = useNav();
  const b = useB();
  const color = useMetaColor(meta && meta !== "pending" ? meta.tone : undefined);
  return (
    <BRow
      leading={<Mark id={SERVICE_OF[route]} />}
      title={title}
      meta={
        meta === "pending" ? (
          <Skeleton width={128} height={12} style={{ marginTop: space[1] }} />
        ) : meta?.lead ? (
          // A plain fact, then the state: only the state is coloured ("14 SKS" quiet, "1 bentrok" amber).
          <Text size="bodyMedium" numberOfLines={2} style={{ color: b.muted }}>
            {`${meta.lead} · `}
            <Text size="bodyMedium" weight="medium" style={{ color: color ?? b.muted }}>
              {meta.text}
            </Text>
          </Text>
        ) : (
          (meta?.text ?? undefined)
        )
      }
      metaColor={color}
      last={last}
      onPress={() => nav.go(route === "grades" ? { screen: "grades" } : { screen: "plan", tab: route })}
      testID={testID}
    />
  );
}

/** One of Rencana studi's parts as a row: it opens that part's screen. */
function PartRow({ part, title, meta }: { part: PlanTab; title: string; meta: Meta }) {
  return <ScreenRow title={title} meta={meta} route={part} last={part === "deadlines"} testID={`row.nav.plan.${part}`} />;
}

/**
 * What a row says while its data isn't here: its shape during SIX's first read, else nothing. Without SIX the card
 * says so once, with the way to connect (and the banner under the bar when the session ran out), not every row.
 */
function useMissingMeta(): null | "pending" {
  return useFirstRead("six") ? "pending" : null;
}

function GradesRow({ record }: { record: StudentRecord | undefined }) {
  const t = useT();
  const f = useFormat();
  const missing = useMissingMeta();
  // The card over it says the IPK: the row says what the card doesn't, the last term's IP.
  const meta = useMemo<Meta>(() => {
    if (!record?.transcript) return null;
    const last = record.transcript.terms.filter((term) => term.term !== record.term && shownIndex(term.ip) !== null).at(-1);
    const ip = last ? shownIndex(last.ip) : null;
    // Named as Nilai names it.
    return ip === null ? null : { text: t("mobile.grades.lastIp", { ip: f.number(ip, 2) }) };
  }, [record, t, f]);
  return <ScreenRow title={t("nav.grades")} meta={record?.transcript ? meta : missing} route="grades" testID="row.nav.grades" />;
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
  if (finish.blocked) return <PartRow part="planner" meta={{ text: t("mobile.academic.meta.plannerShort"), tone: "amber" }} title={title} />;
  return <PartRow part="planner" meta={{ text: t("mobile.academic.meta.plannerSemester", { n: finish.semester }) }} title={title} />;
});

/** Kurikulum: the required courses still to pass (the card's bar says the SKS; this says what's left of the list). */
function CurriculumRow({ record }: { record: StudentRecord | undefined }) {
  const t = useT();
  const missing = useMissingMeta();
  const left = record?.requiredLeft.length;
  const meta: Meta =
    left === undefined
      ? missing
      : left > 0
        ? { text: t("mobile.profile.requiredLeft", { count: left }) }
        : { text: t("mobile.profile.requiredDone"), tone: "ok" };
  return <PartRow part="curriculum" title={t("plan.tab.curriculum")} meta={meta} />;
}

/** KRS: the SKS taken, then its one status: a clash still to come (worth a question to the lecturer) over the plan's stage. */
function KrsRow() {
  const t = useT();
  const now = useNow();
  const plan = useDataset("six.krs");
  const schedule = useDataset("six.schedule");
  const missing = useMissingMeta();
  const meta = useMemo<Meta>(() => {
    if (!plan) return null;
    const stage = krsStage(plan);
    const clashes = krsOverlaps(
      plan.courses.map((c) => c.code),
      schedule ?? [],
      now,
    ).filter((o) => o.upcoming).length;
    const sks = t("krs.sks", { sks: plan.sks ?? "-" });
    // The SKS are a plain fact: only the clash, or a stage that waits on the Student, is a warning.
    if (clashes) return { lead: sks, text: t("mobile.academic.pill.clash", { count: clashes }), tone: "amber" };
    return { lead: sks, text: t(`krs.stage.${stage}`), tone: stage === "send" || stage === "ukt" ? "amber" : stage === "done" ? "ok" : "muted" };
  }, [plan, schedule, now, t]);
  return <PartRow part="krs" title={t("plan.tab.krs")} meta={plan ? meta : missing} />;
}

/** UKT: this term's bill (else the last billed) in one line: paid, the date it's due by, or overdue. */
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
  const meta: Meta =
    urgency === "overdue"
      ? { text: t("bills.status.overdue"), tone: "red" }
      : (urgency === "soon" || urgency === "due") && bill.nextDueAt !== null
        ? { text: t("mobile.academic.pill.billsDue", { date: together(f.dayMonth(bill.nextDueAt)) }), tone: urgency === "soon" ? "amber" : "muted" }
        : { text: t(`bills.status.${bill.status}`), tone: bill.status === "paid" ? "ok" : "muted" };
  return <PartRow part="bills" title={title} meta={meta} />;
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
      meta={{
        text:
          next.when === "now"
            ? t("mobile.academic.meta.deadlineNow", { what })
            : // The date held together ("30 Nov"), never broken across two lines.
              t("mobile.academic.meta.deadlineNext", { what, date: together(f.dayMonth(next.event.start)) }),
      }}
    />
  );
}

// ------------------------------------------------------------ the account

/**
 * Akun: the two systems the app reads (each with its state, and signing back in on the row itself when its session
 * ended), then Notifikasi, Pengaturan and reporting a problem. The avatar left every top bar: this is the way to all of
 * them. Signing out is in Pengaturan, away from these.
 */
function AccountRows() {
  const t = useT();
  const unread = useUnreadAlerts();
  return (
    <View testID="section.profile.app">
      <SourceRow source="edunex" />
      <SourceRow source="six" />
      <BRow
        leading={<Mark id="alerts" />}
        title={t("alerts.title")}
        meta={unread > 0 ? t("mobile.profile.unread", { count: unread }) : undefined}
        onPress={() => router.push("/alerts")}
        testID="row.nav.alerts"
      />
      <BRow leading={<Mark id="settings" />} title={t("nav.settings")} onPress={() => router.push("/settings")} testID="action.account" />
      <BRow leading={<Mark id="report" />} title={t("mobile.profile.report")} last onPress={() => router.push("/report")} testID="action.report" />
    </View>
  );
}

/** One system: connected (the word, in green), or what's wrong and "Masuk lagi" at the row's end; the row does it. */
function SourceRow({ source }: { source: Extract<SourceId, "edunex" | "six"> }) {
  const t = useT();
  const b = useB();
  const status = useStatus(source);
  const { signIn, busy } = useSignIn();
  const name = t(`source.${source}`);
  const needsSignIn = status.state === "signed-out" || status.state === "expired";
  const meta: { text: string; tone: MetaTone } =
    status.state === "live"
      ? { text: t("status.live"), tone: "ok" }
      : status.state === "signed-out"
        ? { text: t("settings.notConnected"), tone: "muted" }
        : status.state === "connecting"
          ? { text: t("status.connecting"), tone: "muted" }
          : { text: t(`status.${status.state}`, { source: name }), tone: "amber" };
  const color = useMetaColor(meta.tone);
  // Each system's own mark (the same two as in Settings), never the Kuliah tab's cap or Materi's book.
  const Glyph = source === "six" ? Icons.Six : Icons.Edunex;
  return (
    <BRow
      leading={
        <View style={{ width: MARK, height: MARK, alignItems: "center", justifyContent: "center" }}>
          <Glyph size={24} color={b.fg} />
        </View>
      }
      title={name}
      meta={meta.text}
      metaColor={color}
      trailing={
        needsSignIn ? (
          <Text size="labelLarge" weight="semibold" style={{ color: b.brand }}>
            {t(status.state === "expired" ? "action.signInAgain" : "action.signIn")}
          </Text>
        ) : undefined
      }
      onPress={needsSignIn ? (busy ? undefined : () => void signIn(source)) : () => router.push("/settings")}
      accessibilityHint={needsSignIn ? undefined : t("nav.settings")}
      testID={needsSignIn ? `action.signIn.${source}` : `row.account.${source}`}
    />
  );
}
