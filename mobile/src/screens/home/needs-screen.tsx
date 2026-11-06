// "Perlu kamu urus" as a screen (round 2, v4: Beranda's chevron): every item for the week ahead, each row swiped or
// long-pressed, with what's put off and away; then what changed: what Beranda leaves out to stay short. The same
// reasoning as Beranda's (src/core/needs), on the same clock. No header over the list (the judge's 02b): the date and
// term are on Jadwal and Akademik, an exam period on Jadwal.
import { useMemo } from "react";
import { useTermCourses } from "../../../../src/app/courses";
import { useHomeWorld } from "../../../../src/app/home-world";
import { useT } from "../../../../src/app/i18n";
import { attention, dueItems, homeContext, needsRange, nowCard, todayPlan } from "../../../../src/core/needs";
import { usePerfDrawn } from "../../perf";
import { Skeleton } from "../../ui/display";
import { Page } from "../../ui/layout";
import { useTheme } from "../../ui/theme";
import { TopBar } from "../../ui/top-bar";
import { Changes } from "./changes";
import { NeedsYou } from "./needs";

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
    return { context, needs: attention(context, card, plan), due: dueItems(context, plan), range: needsRange(context) };
  }, [world]);
  usePerfDrawn(lists !== null);
  return (
    <Page testID="screen.needs" background={theme.v4.page} header={<TopBar v4 title={t("mobile.home.toHandle")} />}>
      {lists ? (
        <>
          <NeedsYou needs={lists.needs} due={lists.due} range={lists.range} courses={courses ?? []} />
          <Changes context={lists.context} />
        </>
      ) : (
        <Skeleton height={56} />
      )}
    </Page>
  );
}
