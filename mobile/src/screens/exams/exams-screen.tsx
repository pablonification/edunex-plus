// Ujian (/exams, round 4): the term's exams, from the same list the Tugas tab reads (useTodo, ./next.ts). The next
// exam is the one big card in its course's colour (the Tugas tab's HeroCard: the days left big, then the day, time
// and room), opening its page. The rest follow by date as the Tugas tab's exam rows, past ones last under their
// heading. Rows only open pages: nothing here starts an attempt.
import { useMemo } from "react";
import { View } from "react-native";
import { useTermCourses } from "../../../../src/app/courses";
import { type Format, type Translate, useFormat, useT } from "../../../../src/app/i18n";
import { useTodo } from "../../../../src/app/schedule-data";
import { useStatus } from "../../../../src/app/store";
import { sittingsLine } from "../../../../src/core/exam-sittings";
import { useNav } from "../../nav";
import { usePerfDrawn } from "../../perf";
import { usePullToRefresh } from "../../shell/source-status";
import { CardSlice, SectionTitle } from "../../ui/card-list";
import { EmptyState, Skeleton } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { factsLabel, Page } from "../../ui/layout";
import { space, useTheme } from "../../ui/theme";
import { TopBar } from "../../ui/top-bar";
import { shortName } from "../home/parts";
import { ExamPartRow, PastExamRow, PeriodRow } from "../tasks/exam-rows";
import { HeroCard, TaskRowWorld } from "../tasks/row-parts";
import { type ExamItem, examsView, type NextExam } from "./next";

export function ExamsScreen() {
  const t = useT();
  const theme = useTheme();
  const todo = useTodo();
  const pull = usePullToRefresh();
  const edunex = useStatus("edunex").state;
  const view = useMemo(() => (todo ? examsView(todo.items, todo.done.pastExams, todo.now) : null), [todo]);
  const reading = edunex === "connecting" || edunex === "live";
  usePerfDrawn(view !== null || !reading);
  const none = view !== null && !view.next && view.rest.length === 0 && view.past.length === 0;
  return (
    <Page testID="screen.exams" background={theme.v4.page} header={<TopBar v4 title={t("mobile.service.exams")} />} {...pull}>
      {view === null ? (
        reading ? (
          <ExamsSkeleton />
        ) : (
          <EmptyState icon={<Icons.CalendarCheck size={24} color={theme.color.onSecondaryContainer} />} title={t("course.noExams")} />
        )
      ) : none ? (
        <EmptyState icon={<Icons.CalendarCheck size={24} color={theme.color.onSecondaryContainer} />} title={t("course.noExams")} />
      ) : (
        <TaskRowWorld>
          {view.next && <NextCard item={view.next} />}
          {view.rest.length > 0 && (
            <View>
              {view.next && <SectionTitle title={t("mobile.exams.after")} />}
              {view.rest.map((item, i) => (
                <CardSlice key={item.key} first={i === 0} last={i === view.rest.length - 1}>
                  <ExamItemRow item={item} />
                </CardSlice>
              ))}
            </View>
          )}
          {view.past.length > 0 && (
            <View>
              <SectionTitle title={t("tasks.group.pastExams")} first={!view.next && view.rest.length === 0} />
              {view.past.map((past, i) => (
                <CardSlice key={past.exam.id} first={i === 0} last={i === view.past.length - 1}>
                  <PastExamRow past={past} />
                </CardSlice>
              ))}
            </View>
          )}
        </TaskRowWorld>
      )}
    </Page>
  );
}

function ExamItemRow({ item }: { item: ExamItem }) {
  return item.kind === "period" ? <PeriodRow item={item} /> : <ExamPartRow item={item} />;
}

/** "Kam, 15 Okt, 08:00–10:00 · 9009": the day and time as the exam's row says them, then where. */
function nextMeta(t: Translate, f: Format, item: NextExam): string {
  const { part } = item;
  if (part.kind === "window") return factsLabel(f.dueLabel(part.at), t("exam.onEdunex"));
  // SIX lists it in both weeks of the exam period: both days, as its row says them.
  if (item.sittings) return sittingsLine(f, item.sittings);
  const when = part.end !== null ? f.dayTimeRange(part.at, part.end) : f.dueLabel(part.at);
  const where = part.source === "six" ? part.room : t("exam.onEdunex");
  return factsLabel(when, where);
}

/** The next exam: the screen's one big card, in its course's colour; a tap opens the exam's page. */
function NextCard({ item }: { item: NextExam }) {
  const t = useT();
  const f = useFormat();
  const { go } = useNav();
  const courses = useTermCourses();
  const { exam } = item;
  const name = courses?.find((c) => c.code === exam.courseCode)?.name ?? exam.six[0]?.courseName ?? exam.courseCode;
  const kind = t(`exam.kind.${exam.kind}`);
  const meta = nextMeta(t, f, item);
  return (
    <View style={{ marginBottom: space[2] }}>
      <HeroCard
        testID={`hero.exam.${exam.id}`}
        label={factsLabel(`${kind} ${name}`, exam.courseCode, meta, f.fromNow(item.part.at))}
        onPress={() => go({ screen: "exam", examId: exam.id })}
        code={exam.courseCode}
        course={name}
        at={item.part.at}
        title={`${kind} ${shortName(name)}`}
        meta={meta}
      />
    </View>
  );
}

function ExamsSkeleton() {
  return (
    <View testID="skeleton.exams">
      <Skeleton height={96} style={{ borderRadius: 20 }} />
      <View style={{ marginTop: space[6], gap: space[1] }}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={68} style={{ borderRadius: i === 0 ? 20 : 4 }} />
        ))}
      </View>
    </View>
  );
}
