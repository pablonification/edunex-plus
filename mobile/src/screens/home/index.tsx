// Beranda (round 2, v4, chosen by Arqila: mobile/design/r2-directions/v4): in three seconds, whether a class is on and
// what to press, and what to handle next. The blue bar with the greeting (the screen's one title) and every tab's
// actions (./header.tsx, the route's fixed header); the now card over the blue band's edge (./now.tsx: the wave, the
// minutes left, Tandai Hadir); "Perlu kamu urus", what needs the Student most serious first as one list: courses at or
// past their absence limit, classes that clash, then what to hand in and by when (./urus.tsx); "Nanti hari ini", the
// classes still to come (./later.tsx). One fact, one place: the term's
// courses are Kuliah's (round 3 took their list off Beranda), the now card's class is never a row under it. Everything
// else (the whole list, the date and term, what changed) is one tap deeper, on "Perlu kamu urus"'s screen
// (./needs-screen.tsx). The data and the reasoning are the desktop's (src/core/needs). While the first
// read runs, each part stands in its own shape and fills in. Cards rise in a stagger the first time only.
import { useLayoutEffect, useMemo } from "react";
import { View } from "react-native";
import { type TermCourse, useTermCourses } from "../../../../src/app/courses";
import { useHomeWorld } from "../../../../src/app/home-world";
import { useDataset } from "../../../../src/app/store";
import { attention, dueItems, type HomeContext, homeContext, nowCard, todayPlan, unreadAhead } from "../../../../src/core/needs";
import { SixPageNote, useChangedPage } from "../../parts/six-page-note";
import { perfFirstData, usePerfDrawn } from "../../perf";
import { ProblemBanner } from "../../shell/source-status";
import { Rise } from "../../ui/expressive";
import { space } from "../../ui/theme";
import { FirstScanCard, NotifyCard } from "./first-run";
import { HomeBand, OVERLAP } from "./header";
import { Later } from "./later";
import { HeldShape, NowSection } from "./now";
import { cardKey } from "./parts";
import { problems } from "./problems";
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
  usePerfDrawn(context !== undefined, "tab");
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
        <View style={{ marginTop: space[4], gap: space[3] }}>
          <ProblemBanner />
          {timetableChanged && <SixPageNote datasets={["six.schedule"]} />}
        </View>
      </View>
    </>
  );
}

/**
 * Beranda's shape before its data: the now card as it waits during the first read, then Perlu kamu urus's rows where
 * they'll be (under its title's row), so nothing moves when the data comes. Never a spinner on a blank page.
 */
function Loading() {
  return (
    <View accessibilityState={{ busy: true }} testID="home.loading">
      <HeldShape testID="home.loading.now" />
      {/* Perlu kamu urus's title row: its margin, the 48 dp chevron, the gap under it. */}
      <View style={{ marginTop: space[6] + 48 + space[2] }}>
        <UrusLoading />
      </View>
    </View>
  );
}

/** The class now, what to handle, and what's left today: one column, in the order a thumb scrolls. */
function Answers({ context, courses: list }: { context: HomeContext; courses: readonly TermCourse[] | undefined }) {
  const courses = list ?? [];
  const card = useMemo(() => nowCard(context), [context]);
  const plan = useMemo(() => todayPlan(context), [context]);
  const needs = useMemo(() => attention(context, card, plan), [context, card, plan]);
  const due = useMemo(() => dueItems(context, plan), [context, plan]);
  const found = useMemo(() => problems(context), [context]);
  return (
    <>
      <Rise screen="home" index={0}>
        <NowSection card={card} courses={courses} hasSchedule={context.schedule !== null} unread={unreadAhead(context, card)} />
      </Rise>
      <Rise screen="home" index={1}>
        <FirstScanCard />
      </Rise>
      <Urus problems={found} needs={needs} due={due} courses={courses} />
      <Later context={context} plan={plan} courses={courses} onCard={cardKey(card)} />
      {/* The one ask, after what the Student came for: the now card and Perlu kamu urus stay the first things seen. */}
      <Rise screen="home" index={9}>
        <NotifyCard hasClass={card?.class !== null && card?.class !== undefined} />
      </Rise>
    </>
  );
}
