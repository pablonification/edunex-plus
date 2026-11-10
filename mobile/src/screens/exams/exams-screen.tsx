// Ujian (/exams, round 4): the term's exams, from the same list the Tugas tab reads (useTodo, ./next.ts). The next
// exam is the one big card in its course's tint (the days left big, the course's tile, the day, time and room with
// icons), opening its page. The rest follow by date, each named by its kind and the course's short name (one name per
// course on the screen) with its days left as a pill; past ones last under their heading. Rows only open pages:
// nothing here starts an attempt.
import { useMemo } from "react";
import { View } from "react-native";
import { type Format, type Translate, useFormat, useT } from "../../../../src/app/i18n";
import { useTodo } from "../../../../src/app/schedule-data";
import { useStatus } from "../../../../src/app/store";
import { sittingsLine } from "../../../../src/core/exam-sittings";
import { useNav } from "../../nav";
import { usePerfDrawn } from "../../perf";
import { usePullToRefresh } from "../../shell/source-status";
import { CardSlice, SectionTitle } from "../../ui/card-list";
import { EmptyState, Skeleton } from "../../ui/display";
import { CountUp } from "../../ui/expressive";
import { Icons } from "../../ui/icons";
import { factsLabel, Page } from "../../ui/layout";
import { PressScale } from "../../ui/press";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { CourseTile, useCourseTile } from "../../ui/tile";
import { TopBar } from "../../ui/top-bar";
import { shortName } from "../home/parts";
import { ExamPartRow, PastExamRow, PeriodRow } from "../tasks/exam-rows";
import { countdown, rowWhen, StatusPill, TaskLine, TaskRowWorld, useRowWorld } from "../tasks/row-parts";
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
  if (item.kind === "period") return <PeriodRow item={item} />;
  // An Edunex window open now keeps the Tugas tab's row: its swipe and long press mark it done.
  if (item.part?.kind === "window" && item.part.open && item.part.opensAt !== null) return <ExamPartRow item={item} />;
  return <LaterExamRow item={item} />;
}

/**
 * A later exam as a row of this screen: the course's tile, the exam's kind and the course's short name (never the
 * title a lecturer typed, "UTS Markom": one name per course here), when, and the days left as a pill at its end.
 */
function LaterExamRow({ item }: { item: Extract<ExamItem, { kind: "exam" }> }) {
  const t = useT();
  const v = useTheme().v4;
  const { go } = useNav();
  const { f, now, courses } = useRowWorld();
  const { exam, part } = item;
  const name = courses?.find((c) => c.code === exam.courseCode)?.name ?? exam.six[0]?.courseName ?? exam.courseCode;
  const title = `${t(`exam.kind.${exam.kind}`)} ${shortName(name)}`;
  let shown: (string | null)[];
  let facts: (string | null)[];
  let moment: number | null = null;
  let warn: string | null = null;
  let on = false;
  if (part?.kind === "takehome") {
    moment = part.at;
    shown = [t("exam.takeHome"), part.at === null ? t("task.noDeadline") : rowWhen(f, part.at, false)];
    facts = [part.task.title, part.at !== null ? f.dueLabel(part.at) : null];
  } else if (part?.kind === "window") {
    moment = part.at;
    shown = [rowWhen(f, part.at, !part.moved)];
    facts = [t("exam.onEdunex"), part.edunex.title ?? null, f.dueLabel(part.at)];
    if (part.moved) warn = t("mobile.home.timeMoved");
  } else if (part?.kind === "sitting") {
    const disagree = exam.disagree;
    shown = [item.sittings ? sittingsLine(f, item.sittings, { room: false, time: !disagree }) : rowWhen(f, part.at, !disagree)];
    facts = [
      t(part.source === "six" ? "exam.inClass" : "exam.onEdunex"),
      part.source === "six" ? part.room : part.title,
      part.end !== null ? f.dayTimeRange(part.at, part.end) : f.dueLabel(part.at),
    ];
    if (disagree) warn = t("mobile.tasks.chip.disagree");
    else if (part.at <= now && (part.end ?? part.at) > now) on = true;
    else moment = part.at;
  } else {
    shown = [t("exam.noDate")];
    facts = [t("exam.noDate")];
  }
  const away = moment !== null && moment > now ? countdown(t, now, moment) : null;
  const status = warn ? (
    <StatusPill tone="amber" icon={<Icons.AlertTriangle size={13} weight="bold" color={v.ambFg} />} text={warn} />
  ) : on ? (
    <StatusPill tone="ok" text={t("home.now")} />
  ) : away ? (
    <StatusPill tone={away.tone} text={away.text} />
  ) : null;
  return (
    <TaskLine
      testID={part?.kind === "takehome" ? `row.task.${part.task.id}` : `row.exam.${exam.id}`}
      label={factsLabel(`${t(`exam.kind.${exam.kind}`)} ${name}`, exam.courseCode, ...facts, warn, away ? f.fromNow(moment ?? now) : null)}
      onPress={() => go(part?.kind === "takehome" ? { screen: "task", taskId: part.task.id } : { screen: "exam", examId: exam.id })}
      code={exam.courseCode}
      course={name}
      title={title}
      meta={shown.filter(Boolean).join(" · ")}
      status={status}
    />
  );
}

/** When and where the next exam is, apart: "Kam, 15 Okt, 11:00–12:59" and "TVST C" (or "Di Edunex"). */
function nextWhenWhere(t: Translate, f: Format, item: NextExam): { when: string; where: string | null } {
  const { part } = item;
  if (part.kind === "window") return { when: f.dueLabel(part.at), where: t("exam.onEdunex") };
  // SIX lists it in both weeks of the exam period: both days, as its row says them.
  if (item.sittings) return { when: sittingsLine(f, item.sittings, { room: false }), where: part.source === "six" ? part.room : t("exam.onEdunex") };
  const when = part.end !== null ? f.dayTimeRange(part.at, part.end) : f.dueLabel(part.at);
  return { when, where: part.source === "six" ? part.room : t("exam.onEdunex") };
}

/**
 * The next exam: the screen's one big card, in its course's tint. The days left big in the display face, the course's
 * own tile beside them, the exam's name, then the day and time and the room, each after its icon. A tap opens it.
 */
function NextCard({ item }: { item: NextExam }) {
  const t = useT();
  const f = useFormat();
  const v = useTheme().v4;
  const { go } = useNav();
  const { now, courses } = useRowWorld();
  const { exam } = item;
  const name = courses?.find((c) => c.code === exam.courseCode)?.name ?? exam.six[0]?.courseName ?? exam.courseCode;
  const { ink, tint } = useCourseTile()(exam.courseCode);
  const kind = t(`exam.kind.${exam.kind}`);
  const { when, where } = nextWhenWhere(t, f, item);
  const away = countdown(t, now, item.part.at);
  const color = away.late ? v.redFg : ink;
  const Where = item.part.kind === "sitting" && item.part.source === "six" ? Icons.MapPin : Icons.Globe;
  return (
    <PressScale
      testID={`hero.exam.${exam.id}`}
      accessibilityLabel={factsLabel(`${kind} ${name}`, exam.courseCode, when, where, f.fromNow(item.part.at))}
      onPress={() => go({ screen: "exam", examId: exam.id })}
      style={{ backgroundColor: tint, borderRadius: 24, padding: space[5], marginBottom: space[2] }}
    >
      <View style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
        <View testID="exams.hero.days">
          <CountUp
            id={`exams:${exam.id}`}
            value={away.value}
            style={{ color, fontFamily: "PlusJakartaSans-ExtraBold", fontSize: 52, lineHeight: 58, letterSpacing: -1.5, fontVariant: ["tabular-nums"] }}
          />
          <Text size="titleMedium" face="display" weight="semibold" style={{ color, marginTop: -6 }}>
            {away.late ? `${t("mobile.home.late")} ${away.unit}` : away.unit}
          </Text>
        </View>
        <CourseTile code={exam.courseCode} name={name} size={52} />
      </View>
      <Text size="titleLarge" face="display" weight="bold" numberOfLines={2} style={{ color: v.fg, marginTop: space[4], letterSpacing: -0.2 }}>
        {`${kind} ${shortName(name)}`}
      </Text>
      <View style={{ gap: space[1.5], marginTop: space[2] }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <Icons.Calendar size={18} color={ink} />
          <Text size="bodyLarge" tabular numberOfLines={2} style={{ flexShrink: 1, color: v.fg2 }}>
            {when}
          </Text>
        </View>
        {where ? (
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
            <Where size={18} color={ink} />
            <Text size="bodyLarge" numberOfLines={1} style={{ flexShrink: 1, color: v.fg2 }}>
              {where}
            </Text>
          </View>
        ) : null}
      </View>
    </PressScale>
  );
}

function ExamsSkeleton() {
  return (
    <View testID="skeleton.exams">
      <Skeleton height={200} style={{ borderRadius: 24 }} />
      <View style={{ marginTop: space[6], gap: space[1] }}>
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={68} style={{ borderRadius: i === 0 ? 20 : 4 }} />
        ))}
      </View>
    </View>
  );
}
