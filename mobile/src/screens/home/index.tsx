// Beranda (round 4, the super-app layout students know from the apps they use daily): in three seconds, whether a
// class is on and what to press, whether the week is fine, and where everything else is. The blue bar with the
// greeting, the search bar and the bell (./header.tsx, the route's fixed header); the now card over the blue band's edge
// (./now.tsx: the wave, the minutes left, Tandai Hadir); the strip, the three daily questions in numbers (./strip.tsx:
// due today or this week, courses at their absence limit, days to the next exam); the services, four across (../../parts/services.tsx,
// "Lainnya" last). All four fit the first screen without scrolling (app/(tabs)/index.tsx has the height budget). Under
// the fold: "Nanti hari ini", the classes still to come (./later.tsx), then "Perlu kamu urus", what else needs the
// Student, most serious first, without what the strip already counts, and gone with nothing left (./urus.tsx), then the first read's and the notifications' cards. One fact, one place: the term's
// courses are Kuliah's, the now card's class is never a row under it. The whole list, the date and term, what changed,
// are one tap deeper, on "Perlu kamu urus"'s screen (./needs-screen.tsx). The data and the reasoning are the desktop's
// (src/core/needs). While the first read runs, each part stands in its own shape and fills in, the grid as it is.
// Cards rise in a stagger the first time only. At a cold start the first frame holds what's in view; what's under the
// fold comes right after (../../ui/parts.tsx), so the splash doesn't wait for it.
import { useLayoutEffect, useMemo } from "react";
import { View } from "react-native";
import { type TermCourse, useTermCourses } from "../../../../src/app/courses";
import { useHomeWorld } from "../../../../src/app/home-world";
import { useNow } from "../../../../src/app/i18n";
import { useDataset } from "../../../../src/app/store";
import { attention, dueItems, type HomeContext, homeContext, nowCard, todayPlan, unreadAhead } from "../../../../src/core/needs";
import { HOME_GRID, ServiceGrid } from "../../parts/services";
import { SixPageNote, useChangedPage } from "../../parts/six-page-note";
import { perfFirstData, usePerfDrawn } from "../../perf";
import { ProblemBanner } from "../../shell/source-status";
import { Rise } from "../../ui/expressive";
import { Part } from "../../ui/parts";
import { space } from "../../ui/theme";
import { FirstScanCard, NotifyCard } from "./first-run";
import { HomeBand, OVERLAP } from "./header";
import { Later } from "./later";
import { HeldShape, NowSection } from "./now";
import { cardKey } from "./parts";
import { problems } from "./problems";
import { Strip, StripShape } from "./strip";
import { stripFacts } from "./strip-facts";
import { Urus, useUrusRows } from "./urus";

/** The space between the first screen's parts. */
export const HOME_GAP = space[4];

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
    <>
      <HomeBand />
      <View style={{ marginTop: -OVERLAP, paddingHorizontal: space[4], paddingBottom: space[4] }}>
        {context ? <Answers context={context} courses={courses} /> : <Loading />}
        <Part at={2}>
          <View style={{ marginTop: space[4], gap: space[3] }}>
            <ProblemBanner />
            {timetableChanged && <SixPageNote datasets={["six.schedule"]} />}
          </View>
        </Part>
      </View>
    </>
  );
}

/** The services, four across: the same with or without data, so they never move. */
function Grid() {
  return (
    <View style={{ marginTop: HOME_GAP }}>
      <ServiceGrid ids={HOME_GRID} testID="home.grid" />
    </View>
  );
}

/**
 * Beranda's shape before its data: the now card as it waits during the first read, the strip's three tiles, then the
 * services as they are, each where it'll be, so nothing moves when the data comes. Never a spinner on a blank page.
 */
function Loading() {
  return (
    <View accessibilityState={{ busy: true }} testID="home.loading">
      <View testID="home.now">
        <HeldShape testID="home.loading.now" />
      </View>
      <View style={{ marginTop: HOME_GAP }}>
        <StripShape />
      </View>
      <Grid />
    </View>
  );
}

/** The class now, the week in numbers, the services; under the fold what's left today and what to handle. */
function Answers({ context, courses: list }: { context: HomeContext; courses: readonly TermCourse[] | undefined }) {
  const courses = list ?? [];
  const card = useMemo(() => nowCard(context), [context]);
  const plan = useMemo(() => todayPlan(context), [context]);
  const needs = useMemo(() => attention(context, card, plan), [context, card, plan]);
  const due = useMemo(() => dueItems(context, plan), [context, plan]);
  const found = useMemo(() => problems(context), [context]);
  const rows = useUrusRows(found, needs, due, courses);
  const now = useNow();
  // What the strip counts: "Perlu kamu urus" leaves it out, so Beranda says each fact once.
  const facts = useMemo(() => stripFacts(rows, needs, now), [rows, needs, now]);
  return (
    <>
      <View testID="home.now">
        <Rise screen="home" index={0}>
          <NowSection card={card} courses={courses} hasSchedule={context.schedule !== null} unread={unreadAhead(context, card)} />
        </Rise>
      </View>
      <Rise screen="home" index={1}>
        <View style={{ marginTop: HOME_GAP }}>
          <Strip context={context} problems={found} facts={facts} />
        </View>
      </Rise>
      <Grid />
      <Part at={1}>
        <Later context={context} plan={plan} courses={courses} onCard={cardKey(card)} />
        <Urus all={rows} facts={facts} courses={courses} />
      </Part>
      {/* The asks, after what the Student came for: the first screen stays the now card, the strip and the services. */}
      <Part at={2}>
        <Rise screen="home" index={8}>
          <FirstScanCard />
        </Rise>
        <Rise screen="home" index={9}>
          <NotifyCard hasClass={card?.class !== null && card?.class !== undefined} />
        </Rise>
      </Part>
    </>
  );
}
