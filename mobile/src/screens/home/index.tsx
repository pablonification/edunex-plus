// Beranda (direction B, "Edunex Mobile LMS done right"): a white page, almost no chrome. Its first screen, in order: the
// search bar and the bell (./header.tsx, the route's fixed header); the greeting, the page's one title; what's on now
// where the official app has its banner (./banner.tsx, the page's one block of colour); a strip of counts to tap
// (./strip.tsx); the services, round and four across, the last one "Lainnya" (./grid.tsx). Under them, what needs the
// Student (./urus.tsx) and what's later today (./later.tsx), as rows on the page. One fact, one place: a number on the
// strip opens the page with its detail. The data and the reasoning are the desktop's (src/core/needs). While the first
// read runs, each part stands in its own shape and fills in. At a cold start the first frame holds what's in view; what's
// under it comes right after (../../ui/parts.tsx), so the splash doesn't wait for it.
import { useLayoutEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { type TermCourse, useTermCourses } from "../../../../src/app/courses";
import { useHomeWorld } from "../../../../src/app/home-world";
import { useLang, useNow, useT } from "../../../../src/app/i18n";
import { firstName } from "../../../../src/app/names";
import { useDataset } from "../../../../src/app/store";
import { wibDay } from "../../../../src/core/course-meetings";
import { attention, dueItems, type HomeContext, homeContext, nowCard, type TodayPlan, todayPlan, unreadAhead } from "../../../../src/core/needs";
import { SixPageNote, useChangedPage } from "../../parts/six-page-note";
import { perfFirstData, usePerfDrawn } from "../../perf";
import { ProblemBanner, StatusLine, SyncPanel, useSyncText } from "../../shell/source-status";
import { BHeading, useB } from "../../ui/b";
import { Rise } from "../../ui/expressive";
import { Part } from "../../ui/parts";
import { Text } from "../../ui/text";
import { space, TOUCH } from "../../ui/theme";
import { BannerShape, NowBanner } from "./banner";
import { FirstScanCard, NotifyCard } from "./first-run";
import { partOfDay } from "./greeting";
import { HomeGrid } from "./grid";
import { Later } from "./later";
import { cardKey } from "./parts";
import { problems } from "./problems";
import { HomeStrip } from "./strip";
import { Urus, UrusLoading } from "./urus";

/** Everything on Beranda's page: the page itself is the route's (app/(tabs)/index.tsx). */
export function Home() {
  const began = Date.now();
  const account = useDataset("edunex.account");
  const student = useDataset("six.student");
  const courses = useTermCourses();
  const name = account?.name ?? student?.name;
  const world = useHomeWorld();
  const context = useMemo(() => (world ? homeContext(world) : undefined), [world]);
  // The timetable's page changed: said here. A class on it the app couldn't read is said on the card, quietly.
  const timetableChanged = useChangedPage(["six.schedule"]);
  usePerfDrawn(context !== undefined);
  if (context !== undefined && name) perfFirstData();
  // A redraw's cost on the phone: what the minute's tick or new data does to Beranda (the lab reads it from logcat).
  useLayoutEffect(() => {
    const total = Date.now() - began;
    if (total > 30) console.log(`[perf] home-render ${total}`);
  });
  return (
    <View style={{ paddingHorizontal: space[4], paddingBottom: space[6] }}>
      <Greeting name={name} />
      {context ? <Answers context={context} courses={courses} /> : <Loading />}
      <Part at={2}>
        <View style={{ marginTop: space[4], gap: space[3] }}>
          <ProblemBanner />
          {timetableChanged && <SixPageNote datasets={["six.schedule"]} />}
        </View>
      </Part>
    </View>
  );
}

/**
 * The page's one title, where the official app says "Home Menu": the greeting, with the data's status under it only
 * when it says something to act on. A tap opens the sources' sheet, as a tab's title does.
 */
function Greeting({ name }: { name: string | undefined }) {
  const t = useT();
  const b = useB();
  const lang = useLang();
  const now = useNow();
  const sync = useSyncText();
  const [panel, setPanel] = useState(false);
  const part = partOfDay(new Date(now).getHours(), lang);
  const hello = name ? t(`mobile.home.hello.${part}`, { name: firstName(name) }) : t(`time.greeting.${part}`);
  return (
    <>
      <Pressable
        onPress={() => setPanel(true)}
        accessibilityRole="button"
        accessibilityLabel={`${hello}. ${t("sync.title")}: ${sync}`}
        testID="action.syncStatus"
        style={{ minHeight: TOUCH, justifyContent: "center", paddingHorizontal: space[1], marginBottom: space[1] }}
      >
        <Text size="titleLarge" face="display" weight="bold" numberOfLines={1} accessibilityRole="header" style={{ color: b.fg, letterSpacing: -0.3 }}>
          {hello}
        </Text>
        <StatusLine />
      </Pressable>
      <SyncPanel open={panel} onClose={() => setPanel(false)} />
    </>
  );
}

/**
 * Beranda's shape before its data: the block as it waits during the first read, then the services where they'll be,
 * so nothing moves when the data comes. Never a spinner on a blank page.
 */
function Loading() {
  const t = useT();
  return (
    <View accessibilityState={{ busy: true }} testID="home.loading">
      <BannerShape testID="home.loading.now" />
      <BHeading style={{ marginTop: space[6] }}>{t("mobile.home.services")}</BHeading>
      <HomeGrid />
      <View style={{ marginTop: space[6] }}>
        <UrusLoading />
      </View>
    </View>
  );
}

/** How many classes are still to come today, the one on the block not counted (./later.tsx's rows). */
function classesLeft(context: HomeContext, plan: TodayPlan, onCard: string | null): number {
  const day = wibDay(context.now);
  const starts = [
    ...plan.classes.map((facts) => ({ key: `class:${facts.session.id}`, start: facts.session.start, end: facts.session.end })),
    ...plan.announced.map((one) => ({ key: `meeting:${one.code}:${one.meeting.start}`, start: one.meeting.start, end: one.meeting.end })),
  ];
  return starts.filter((item) => wibDay(item.start) === day && item.end > context.now && item.key !== onCard).length;
}

/** The class now, the counts, the services, then what to handle and what's left today: in the order a thumb scrolls. */
function Answers({ context, courses: list }: { context: HomeContext; courses: readonly TermCourse[] | undefined }) {
  const t = useT();
  const courses = list ?? [];
  const card = useMemo(() => nowCard(context), [context]);
  const plan = useMemo(() => todayPlan(context), [context]);
  const needs = useMemo(() => attention(context, card, plan), [context, card, plan]);
  const due = useMemo(() => dueItems(context, plan), [context, plan]);
  const found = useMemo(() => problems(context), [context]);
  const left = useMemo(() => classesLeft(context, plan, cardKey(card)), [context, plan, card]);
  return (
    <>
      <Rise screen="home" index={0}>
        <NowBanner card={card} courses={courses} hasSchedule={context.schedule !== null} unread={unreadAhead(context, card)} />
      </Rise>
      <Rise screen="home" index={1} style={{ marginTop: space[3] }}>
        <HomeStrip absences={found.absences.length} classesLeft={left} />
      </Rise>
      <Rise screen="home" index={2} style={{ marginTop: space[5] }}>
        <BHeading>{t("mobile.home.services")}</BHeading>
        <HomeGrid />
      </Rise>
      <Rise screen="home" index={3}>
        <FirstScanCard />
      </Rise>
      <Part at={1}>
        <Later context={context} plan={plan} courses={courses} onCard={cardKey(card)} />
      </Part>
      <Urus problems={found} needs={needs} due={due} courses={courses} />
      {/* The one ask, after what the Student came for. */}
      <Part at={2}>
        <Rise screen="home" index={9}>
          <NotifyCard hasClass={card?.class !== null && card?.class !== undefined} />
        </Rise>
      </Part>
    </>
  );
}
