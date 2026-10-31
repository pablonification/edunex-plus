// "Perlu kamu urus" as a screen (round 2, v4: Beranda's chevron): every item for the week ahead, each row swiped or
// long-pressed, with what's put off and away; then the day and term, an exam period coming, and what changed: what
// Beranda leaves out to stay short. The same reasoning as Beranda's (src/core/needs), on the same clock.
import { useMemo } from "react";
import { View } from "react-native";
import { useTerm, useTermCourses } from "../../../../src/app/courses";
import { useHomeWorld } from "../../../../src/app/home-world";
import { useFormat, useNow, useT } from "../../../../src/app/i18n";
import { useDataset } from "../../../../src/app/store";
import { PERIOD_NEAR } from "../../../../src/core/exams";
import { attention, dueItems, homeContext, needsRange, nowCard, todayPlan } from "../../../../src/core/needs";
import { usePerfDrawn } from "../../perf";
import { Skeleton } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { Meta, Page } from "../../ui/layout";
import { space, useTheme } from "../../ui/theme";
import { TopBar } from "../../ui/top-bar";
import { Changes } from "./changes";
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
    return { context, needs: attention(context, card, plan), due: dueItems(context, plan), range: needsRange(context) };
  }, [world]);
  usePerfDrawn(lists !== null);
  return (
    <Page testID="screen.needs" header={<TopBar title={t("mobile.home.toHandle")} />}>
      <Today />
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

/** "Kamis, 8 Oktober · Semester 1 2026/2027", and a UTS or UAS week within two weeks (or going on), from ITB's calendar. */
function Today() {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const term = useTerm();
  const theme = useTheme();
  const calendar = useDataset("itb.calendar");
  const exams = calendar?.events.filter((e) => e.kind === "uts" || e.kind === "uas") ?? [];
  const running = exams.find((e) => e.start <= now && now < e.end);
  const next = exams.find((e) => e.start > now && e.start - now <= PERIOD_NEAR);
  const date = (at: number) => `${f.weekday(at)}, ${f.dayMonth(at)}`;
  let facts: string[] | null = null;
  if (running) facts = [t(running.kind === "uts" ? "home.utsNow" : "home.uasNow", { date: date(running.end - 1) })];
  else if (next) {
    const days = f.dayOffset(next.start);
    facts = [
      t(next.kind === "uts" ? "home.utsStarts" : "home.uasStarts", { date: date(next.start) }),
      days === 1 ? t("time.tomorrowWord") : t("home.inDays", { count: days }),
    ];
  }
  return (
    <View style={{ marginBottom: space[2], gap: space[1] }} testID="needs.today">
      <Meta>
        {f.dateLong(now)}
        {term ? f.term(term) : null}
      </Meta>
      {facts && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <Icons.CalendarClock size={16} color={theme.color.onSurfaceVariant} />
          <View style={{ flex: 1 }}>
            <Meta>{facts}</Meta>
          </View>
        </View>
      )}
    </View>
  );
}
