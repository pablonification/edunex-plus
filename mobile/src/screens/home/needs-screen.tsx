// "Perlu perhatianmu" as a screen of its own: every item for the week ahead, then what's put off and put away, each
// row swiped or long-pressed as on Beranda. The same reasoning as Beranda's (src/core/needs), on the same clock.
import { useMemo } from "react";
import { useTermCourses } from "../../../../src/app/courses";
import { useHomeWorld } from "../../../../src/app/home-world";
import { useT } from "../../../../src/app/i18n";
import { attention, dueItems, homeContext, needsRange, nowCard, todayPlan } from "../../../../src/core/needs";
import { usePerfDrawn } from "../../perf";
import { Skeleton } from "../../ui/display";
import { Page } from "../../ui/layout";
import { TopBar } from "../../ui/top-bar";
import { NeedsYou } from "./needs";

export function NeedsScreen() {
  const t = useT();
  const courses = useTermCourses();
  const world = useHomeWorld();
  const lists = useMemo(() => {
    if (!world) return null;
    const context = homeContext(world);
    const card = nowCard(context);
    const plan = todayPlan(context);
    return { needs: attention(context, card, plan), due: dueItems(context, plan), range: needsRange(context) };
  }, [world]);
  usePerfDrawn(lists !== null);
  return (
    <Page testID="screen.needs" header={<TopBar title={t("home.needs")} />}>
      {lists ? <NeedsYou needs={lists.needs} due={lists.due} range={lists.range} courses={courses ?? []} /> : <Skeleton height={56} />}
    </Page>
  );
}
