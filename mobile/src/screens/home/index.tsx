// Beranda: a white page, almost no chrome. Its first screen, in order and nothing else: the search bar and the bell
// (./header.tsx, the route's fixed header); what's on now, the page's one block of colour (./banner.tsx); three things
// about the Student to tap (./strip.tsx); the services, four across, the last one "Lainnya" (./grid.tsx). No greeting
// and no heading over the services: they pushed the day off the first screen. Under them, what's later today as a
// timeline (./later.tsx), then what needs the Student that the strip doesn't already say (./urus.tsx). One fact, one
// place: a number on the strip opens the page with its detail and comes back nowhere lower down. The data and the
// reasoning are the desktop's (src/core/needs). While the first read runs, each part stands in its own shape and fills
// in. At a cold start the first frame holds only the block, the strip and the grid, from saved data; the timeline comes
// right after it and the rest when the thread is idle (../../ui/parts.tsx), so the splash waits for none of it.
import { useLayoutEffect, useMemo } from "react";
import { View } from "react-native";
import { type TermCourse, useTermCourses } from "../../../../src/app/courses";
import { useHomeWorld } from "../../../../src/app/home-world";
import { useDataset } from "../../../../src/app/store";
import { attention, dueItems, type HomeContext, homeContext, type NowCard, nowCard, type TodayPlan, todayPlan, unreadAhead } from "../../../../src/core/needs";
import { SixPageNote, useChangedPage } from "../../parts/six-page-note";
import { perfFirstData, usePerfDrawn } from "../../perf";
import { ProblemBanner } from "../../shell/source-status";
import { Skeleton } from "../../ui/display";
import { Rise } from "../../ui/expressive";
import { Part } from "../../ui/parts";
import { space } from "../../ui/theme";
import { BannerShape, NowBanner } from "./banner";
import { FirstScanCard, NotifyCard } from "./first-run";
import { HomeGrid } from "./grid";
import { Later } from "./later";
import { cardKey } from "./parts";
import { type Problems, problems } from "./problems";
import { HomeStrip } from "./strip";
import { Urus } from "./urus";

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
    <View style={{ paddingHorizontal: space[4], paddingBottom: space[6], gap: space[2] }}>
      {/* Offline, a sign-in that ran out, a read that failed: said under the search bar, over the day. */}
      <Part at={1}>
        <View style={{ gap: space[3] }}>
          <ProblemBanner />
          {timetableChanged && <SixPageNote datasets={["six.schedule"]} />}
        </View>
      </Part>
      <View>{context ? <Answers context={context} courses={courses} /> : <Loading />}</View>
    </View>
  );
}

/**
 * Beranda's shape before its data: the block as it waits during the first read, the strip's three tiles and the
 * services where they'll be, so nothing moves when the data comes. Never a spinner on a blank page.
 */
function Loading() {
  return (
    <View accessibilityState={{ busy: true }} testID="home.loading">
      <BannerShape testID="home.loading.now" />
      <View style={{ flexDirection: "row", marginTop: space[3], minHeight: 64, alignItems: "center" }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ flex: 1, alignItems: "center", gap: space[2] }}>
            <Skeleton width={28} height={20} />
            <Skeleton width={64} height={12} />
          </View>
        ))}
      </View>
      <View style={{ marginTop: space[5] }}>
        <HomeGrid />
      </View>
    </View>
  );
}

/** The class now, the strip, the services, then what's left today and what to handle: in the order a thumb scrolls. */
function Answers({ context, courses: list }: { context: HomeContext; courses: readonly TermCourse[] | undefined }) {
  const courses = list ?? [];
  const card = useMemo(() => nowCard(context), [context]);
  const found = useMemo(() => problems(context), [context]);
  const hasClass = card?.class !== null && card?.class !== undefined;
  return (
    <>
      <Rise screen="home" index={0}>
        <NowBanner card={card} courses={courses} schedule={context.schedule} unread={unreadAhead(context, card)} />
      </Rise>
      <Rise screen="home" index={1} style={{ marginTop: space[3] }}>
        <HomeStrip limit={found.absences.length} past={found.absences.some((one) => one.health.state === "out")} />
      </Rise>
      <Rise screen="home" index={2} style={{ marginTop: space[5] }}>
        <HomeGrid />
      </Rise>
      <Rise screen="home" index={3}>
        <FirstScanCard />
      </Rise>
      {/* Under the fold: drawn once the first frame is up, the timeline first, the rest when the thread is idle. */}
      <Part at={1}>
        <Below context={context} card={card} found={found} courses={courses} hasClass={hasClass} />
      </Part>
    </>
  );
}

/** Nanti hari ini with its reminder prompt under it, then Perlu kamu urus: each worked out only once it's drawn. */
function Below({
  context,
  card,
  found,
  courses,
  hasClass,
}: {
  context: HomeContext;
  card: NowCard | null;
  found: Problems;
  courses: readonly TermCourse[];
  hasClass: boolean;
}) {
  const plan = useMemo(() => todayPlan(context), [context]);
  return (
    <>
      <Later context={context} plan={plan} courses={courses} onCard={cardKey(card)} />
      {/* The one ask, under the timeline it's about. */}
      <Part at={2}>
        <NotifyCard hasClass={hasClass} />
      </Part>
      <Part at={2}>
        <Handle context={context} card={card} plan={plan} found={found} courses={courses} />
      </Part>
    </>
  );
}

/** Perlu kamu urus: what needs the Student in the days ahead, read from the whole week only when its turn comes. */
function Handle({
  context,
  card,
  plan,
  found,
  courses,
}: {
  context: HomeContext;
  card: NowCard | null;
  plan: TodayPlan;
  found: Problems;
  courses: readonly TermCourse[];
}) {
  const needs = useMemo(() => attention(context, card, plan), [context, card, plan]);
  const due = useMemo(() => dueItems(context, plan), [context, plan]);
  return <Urus problems={found} needs={needs} due={due} courses={courses} />;
}
