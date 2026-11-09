// "Perlu kamu urus" as a screen (round 2, v4: Beranda's chevron): first, as on Beranda, the courses at or past their
// absence limit and the classes that clash (./problems.ts, ./urus.tsx); then every item for the week ahead, each row
// swiped or long-pressed, with what's put off and away; then what changed: what Beranda leaves out to stay short. The same
// reasoning as Beranda's (src/core/needs), on the same clock. No header over the list (the judge's 02b): the date and
// term are on Jadwal and Akademik, an exam period on Jadwal.
import { useMemo } from "react";
import { View } from "react-native";
import { type TermCourse, useTermCourses } from "../../../../src/app/courses";
import { useHomeWorld } from "../../../../src/app/home-world";
import { useT } from "../../../../src/app/i18n";
import { attention, dueItems, homeContext, needsRange, nowCard, todayPlan } from "../../../../src/core/needs";
import { usePerfDrawn } from "../../perf";
import { Skeleton } from "../../ui/display";
import { Page } from "../../ui/layout";
import { space, useTheme } from "../../ui/theme";
import { TopBar } from "../../ui/top-bar";
import { Changes } from "./changes";
import { NeedsYou } from "./needs";
import { problems } from "./problems";
import { UrusList, useUrusRows } from "./urus";

export function NeedsScreen() {
  const t = useT();
  const theme = useTheme();
  const courses = useTermCourses();
  const world = useHomeWorld();
  const lists = useMemo(() => {
    if (!world) return null;
    const context = homeContext(world);
    const card = nowCard(context);
    const plan = todayPlan(context);
    // A course's absences are a problem row above: not again in the list under it.
    const needs = attention(context, card, plan).filter((need) => need.kind !== "attendance");
    return { context, needs, due: dueItems(context, plan), range: needsRange(context), problems: problems(context) };
  }, [world]);
  usePerfDrawn(lists !== null);
  return (
    <Page testID="screen.needs" background={theme.v4.page} header={<TopBar v4 title={t("mobile.home.toHandle")} />}>
      {lists ? (
        <>
          <Problems found={lists.problems} courses={courses ?? []} />
          <NeedsYou needs={lists.needs} due={lists.due} range={lists.range} courses={courses ?? []} />
          <Changes context={lists.context} />
        </>
      ) : (
        <Skeleton height={56} />
      )}
    </Page>
  );
}

/** The absences and clashes, in Beranda's rows, over the list. */
function Problems({ found, courses }: { found: ReturnType<typeof problems>; courses: readonly TermCourse[] }) {
  const rows = useUrusRows(found, [], [], courses);
  if (!rows.length) return null;
  return (
    <View testID="section.problems" style={{ marginTop: space[2] }}>
      <UrusList rows={rows} courses={courses} />
    </View>
  );
}
