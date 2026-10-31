// Beranda (src/app/screens/home.tsx) on a phone: the ten-second answer. The date and the greeting;
// then "Sekarang", the class going on (or next) with where its attendance counts and the one thing
// to do; then, in one column, "Hari ini", "Perlu perhatianmu", a short "Yang berubah" (the bell has
// it all) and this term's courses. The data and the words are the desktop's own: the same hooks,
// the same src/core/needs reasoning, the same catalog keys.
import { useMemo } from "react";
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
import { Meta, PageHeader } from "../../ui/layout";
import { radius, space, useTheme } from "../../ui/theme";
import { Changes } from "./changes";
import { HomeCourses } from "./courses";
import { NeedsYou } from "./needs";
import { NowSection } from "./now";
import { cardKey, Today } from "./today";

/** Everything under the tab's header: the page itself is the route's (app/(tabs)/index.tsx). */
export function Home() {
  const f = useFormat();
  const now = useNow();
  const account = useDataset("edunex.account");
  const student = useDataset("six.student");
  const courses = useTermCourses();
  const term = useTerm();
  const name = account?.name ?? student?.name;
  const world = useHomeWorld();
  const context = useMemo(() => (world ? homeContext(world) : undefined), [world]);
  // The timetable's page changed: said here. A class on it the app couldn't read is said in Hari ini and on the card, quietly.
  const timetableChanged = useChangedPage(["six.schedule"]);
  usePerfDrawn(context !== undefined, "tab");
  if (context !== undefined && name) perfFirstData();

  return (
    <>
      <PageHeader
        eyebrow={
          <Meta>
            {f.dateLong(now)}
            {term ? f.term(term) : null}
          </Meta>
        }
        title={`${f.greeting()}${name ? `, ${firstName(name)}` : ""}`}
        description={<ExamWeek />}
      />
      {timetableChanged && (
        <View style={{ marginBottom: space[6] }}>
          <SixPageNote datasets={["six.schedule"]} />
        </View>
      )}
      {context ? <Answers context={context} courses={courses ?? []} /> : <AnswersLoading />}
      <HomeCourses courses={courses} nim={student?.nim} context={context} />
    </>
  );
}

function AnswersLoading() {
  const theme = useTheme();
  return (
    <View accessibilityState={{ busy: true }}>
      <Card variant="raised" style={{ padding: space[5], gap: space[3] }}>
        <Skeleton height={12} width={160} />
        <Skeleton height={20} width="66%" />
        <Skeleton height={12} width="50%" />
      </Card>
      <View style={{ marginTop: space[8], height: 112, borderRadius: radius.xl, backgroundColor: theme.color.fill }} />
    </View>
  );
}

/** The day first, then what needs the Student, then what changed: one column, in the order a thumb scrolls. */
function Answers({ context, courses }: { context: HomeContext; courses: readonly TermCourse[] }) {
  const card = useMemo(() => nowCard(context), [context]);
  const plan = useMemo(() => todayPlan(context), [context]);
  const needs = useMemo(() => attention(context, card, plan), [context, card, plan]);
  const due = useMemo(() => dueItems(context, plan), [context, plan]);
  const range = useMemo(() => needsRange(context), [context]);
  return (
    <>
      <NowSection card={card} courses={courses} hasSchedule={context.schedule !== null} unread={unreadAhead(context, card)} />
      <Today context={context} plan={plan} due={due} courses={courses} onCard={cardKey(card)} />
      <NeedsYou needs={needs} due={due} range={range} courses={courses} />
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
    <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[2] }}>
      <View style={{ paddingTop: 2 }}>
        <Icons.CalendarClock size={16} color={theme.color.faint} />
      </View>
      <View style={{ flex: 1 }}>
        <Meta>{facts}</Meta>
      </View>
    </View>
  );
}
