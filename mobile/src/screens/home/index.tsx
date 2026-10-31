// Beranda on a phone: in three seconds, whether a class is on now or next, whether there's Tandai Hadir to press, and
// what's urgent. The date and a greeting in a line or two; then the class now or next as the one leading card (./now.tsx,
// its sheet has the rest); "Perlu perhatianmu", its first three (./needs.tsx); "Hari ini", short rows (./today.tsx); and
// "Yang berubah" as one row opening its sheet (./changes.tsx). The term's courses live on Kuliah. The data and the words
// are the desktop's own (src/app/screens/home.tsx): the same hooks, the same src/core/needs reasoning, the same keys.
// While the first read runs, each part stands as a skeleton of its own shape and fills in as its data comes.
import { memo, useMemo } from "react";
import { View } from "react-native";
import { type TermCourse, useTerm, useTermCourses } from "../../../../src/app/courses";
import { useHomeWorld } from "../../../../src/app/home-world";
import { useFormat, useNow, useT } from "../../../../src/app/i18n";
import { firstName } from "../../../../src/app/names";
import { useDataset } from "../../../../src/app/store";
import { PERIOD_NEAR } from "../../../../src/core/exams";
import { attention, dueItems, type HomeContext, homeContext, needsRange, nowCard, todayPlan, unreadAhead } from "../../../../src/core/needs";
import { SixPageNote, useChangedPage } from "../../parts/six-page-note";
import { perfFirstData, usePerfDrawn } from "../../perf";
import { Card, Skeleton } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { Meta } from "../../ui/layout";
import { Text } from "../../ui/text";
import { shape, space, useTheme } from "../../ui/theme";
import { Changes } from "./changes";
import { FirstScanCard, NotifyCard } from "./first-run";
import { NeedsYou } from "./needs";
import { NowSection } from "./now";
import { cardKey, Today } from "./today";

/** Everything under the tab's header: the page itself is the route's (app/(tabs)/index.tsx). */
export function Home() {
  const account = useDataset("edunex.account");
  const student = useDataset("six.student");
  const courses = useTermCourses();
  const name = account?.name ?? student?.name;
  const world = useHomeWorld();
  const context = useMemo(() => (world ? homeContext(world) : undefined), [world]);
  // The timetable's page changed: said here. A class on it the app couldn't read is said in Hari ini and on the card, quietly.
  const timetableChanged = useChangedPage(["six.schedule"]);
  usePerfDrawn(context !== undefined, "tab");
  if (context !== undefined && name) perfFirstData();

  return (
    <>
      <Greeting name={name} />
      {timetableChanged && (
        <View style={{ marginBottom: space[4] }}>
          <SixPageNote datasets={["six.schedule"]} />
        </View>
      )}
      {context ? <Answers context={context} courses={courses ?? []} /> : <AnswersLoading />}
    </>
  );
}

/** "Kamis, 8 Oktober · Semester 1 2026/2027", then "Selamat pagi, Dimas", and an exam period coming as one quiet line. */
const Greeting = memo(function Greeting({ name }: { name: string | undefined }) {
  const f = useFormat();
  const now = useNow();
  const term = useTerm();
  return (
    <View style={{ marginBottom: space[4] }} testID="home.greeting">
      <Meta>
        {f.dateLong(now)}
        {term ? f.term(term) : null}
      </Meta>
      <Text size="headlineSmall" accessibilityRole="header" style={{ marginTop: 2 }}>
        {`${f.greeting()}${name ? `, ${firstName(name)}` : ""}`}
      </Text>
      <ExamWeek />
    </View>
  );
});

/** Beranda's shape before its data: the leading card, three rows, a short list. Never a spinner on a blank page. */
function AnswersLoading() {
  const theme = useTheme();
  const row = (key: number) => (
    <View key={key} style={{ flexDirection: "row", gap: space[3], padding: space[4], backgroundColor: theme.color.surfaceContainerLow }}>
      <View style={{ flex: 1, gap: space[2] }}>
        <Skeleton width="70%" />
        <Skeleton height={12} width="45%" />
      </View>
    </View>
  );
  return (
    <View accessibilityState={{ busy: true }} testID="home.loading">
      <Card variant="raised" style={{ padding: space[4], gap: space[3] }}>
        <Skeleton height={14} width={150} />
        <Skeleton height={36} width={120} />
        <Skeleton height={22} width="80%" />
        <Skeleton height={14} width="45%" />
      </Card>
      {[3, 2].map((rows, i) => (
        <View key={rows} style={{ marginTop: space[8], gap: space[3] }}>
          <Skeleton height={18} width={i === 0 ? 140 : 80} />
          <View style={{ borderRadius: shape.lgPlus, overflow: "hidden", gap: 2 }}>{Array.from({ length: rows }, (_, n) => row(n))}</View>
        </View>
      ))}
    </View>
  );
}

/** The class now, then what needs the Student, today, and what changed: one column, in the order a thumb scrolls. */
function Answers({ context, courses }: { context: HomeContext; courses: readonly TermCourse[] }) {
  const card = useMemo(() => nowCard(context), [context]);
  const plan = useMemo(() => todayPlan(context), [context]);
  const needs = useMemo(() => attention(context, card, plan), [context, card, plan]);
  const due = useMemo(() => dueItems(context, plan), [context, plan]);
  const range = useMemo(() => needsRange(context), [context]);
  return (
    <>
      <NowSection card={card} courses={courses} hasSchedule={context.schedule !== null} unread={unreadAhead(context, card)} health={context.health} />
      <NotifyCard hasClass={card?.class !== null && card?.class !== undefined} />
      <FirstScanCard />
      <NeedsYou needs={needs} due={due} range={range} courses={courses} limit={3} />
      <Today context={context} plan={plan} due={due} courses={courses} onCard={cardKey(card)} />
      <Changes context={context} />
    </>
  );
}

/** UTS or UAS week starting within two weeks, or going on, from ITB's calendar: a calm line, not a tag. */
function ExamWeek() {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const theme = useTheme();
  const calendar = useDataset("itb.calendar");
  const exams = calendar?.events.filter((e) => e.kind === "uts" || e.kind === "uas") ?? [];
  const running = exams.find((e) => e.start <= now && now < e.end);
  const next = exams.find((e) => e.start > now && e.start - now <= PERIOD_NEAR);
  if (!running && !next) return null;
  const date = (at: number) => `${f.weekday(at)}, ${f.dayMonth(at)}`;
  let facts: string[];
  if (running) facts = [t(running.kind === "uts" ? "home.utsNow" : "home.uasNow", { date: date(running.end - 1) })];
  else {
    const days = f.dayOffset(next!.start);
    facts = [
      t(next!.kind === "uts" ? "home.utsStarts" : "home.uasStarts", { date: date(next!.start) }),
      days === 1 ? t("time.tomorrowWord") : t("home.inDays", { count: days }),
    ];
  }
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], marginTop: space[2] }}>
      <Icons.CalendarClock size={16} color={theme.color.onSurfaceVariant} />
      <View style={{ flex: 1 }}>
        <Meta>{facts}</Meta>
      </View>
    </View>
  );
}
