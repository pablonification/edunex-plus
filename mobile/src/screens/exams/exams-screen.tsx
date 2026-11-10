// Ujian (/exams), behind Beranda's "Ujian" tile: every exam of the term, soonest first. The nearest one is the one
// thing to pick up: a block in its course's colour with the time left as the big figure, then its day, time and room,
// each said once. The rest are flat rows led by their date, by ITB's exam period where the calendar gives one ("Masa
// UTS 12–16 Okt"), else by Tugas's weeks; exams with no date yet come last; the ones behind fold under "Sudah lewat".
// Every row opens the exam's own page (/exam/<id>). The same list as Tugas's (./view.ts): no new data, no new request.
import { FlashList } from "@shopify/flash-list";
import { memo, type ReactNode, useCallback, useMemo, useState } from "react";
import { RefreshControl, View } from "react-native";
import { useCourseColor, useTermCourses } from "../../../../src/app/courses";
import { useExamMarkList } from "../../../../src/app/exam-marks";
import { type Format, type Translate, useFormat, useNow, useT } from "../../../../src/app/i18n";
import { useExams } from "../../../../src/app/schedule-data";
import { useStatus } from "../../../../src/app/store";
import { wibDay } from "../../../../src/core/course-meetings";
import { sittingsLine } from "../../../../src/core/exam-sittings";
import type { Exam } from "../../../../src/core/exams";
import { doneList, type PastExam, todoList } from "../../../../src/core/todo";
import { useNav } from "../../nav";
import { usePerfDrawn } from "../../perf";
import { ProblemBanner, usePullToRefresh, useSignIn } from "../../shell/source-status";
import { BHeading, BRow, useB } from "../../ui/b";
import { Button } from "../../ui/controls";
import { EmptyState, Skeleton } from "../../ui/display";
import { type IconName, Icons } from "../../ui/icons";
import { useBottomInset } from "../../ui/insets";
import { factsLabel } from "../../ui/layout";
import { Arrive, Tap } from "../../ui/moves";
import { Text } from "../../ui/text";
import { space, THEMES, useTheme } from "../../ui/theme";
import { TopBar } from "../../ui/top-bar";
import { examWeekLabel } from "../tasks/exam-rows";
import { countdown } from "../tasks/row-parts";
import { type ExamItem, type ExamLine, examLines, examLineType, examsView, type GroupTitle } from "./view";

const RADIUS = 28;
/** The date column at a row's start. */
const DATE_WIDTH = 40;

/** The course's name as the course list has it, else SIX's for its sitting, else its code (exam-rows.tsx's rule). */
function useExamName(): (exam: Exam) => string {
  const t = useT();
  const courses = useTermCourses();
  return useCallback(
    (exam) => `${t(`exam.kind.${exam.kind}`)} ${courses?.find((c) => c.code === exam.courseCode)?.name ?? exam.six[0]?.courseName ?? exam.courseCode}`,
    [t, courses],
  );
}

/** An exam still ahead as facts: its day, its time and where it is, each once. */
function factsOf(t: Translate, f: Format, item: ExamItem): { day: string; time: string | null; place: string | null } {
  const { part, sittings } = item;
  if (!part || part.at === null) return { day: t("task.noDeadline"), time: null, place: part?.kind === "takehome" ? t("exam.takeHome") : null };
  // SIX lists it in both weeks of the exam period: one exam, its days on one line, as Tugas says it.
  if (sittings && sittings.length > 1) return { day: sittingsLine(f, sittings, { time: false, room: false }), time: f.time(part.at), place: sittings[0]!.room };
  if (part.kind === "sitting")
    return {
      day: f.relativeDay(part.at),
      time: part.end !== null ? f.timeRange(part.at, part.end) : f.time(part.at),
      place: part.room ?? (part.source === "edunex" ? t("exam.onEdunex") : null),
    };
  return { day: f.relativeDay(part.at), time: f.time(part.at), place: t(part.kind === "window" ? "exam.onEdunex" : "exam.takeHome") };
}

export function ExamsScreen() {
  const t = useT();
  const b = useB();
  const theme = useTheme();
  const now = useNow();
  const bottom = useBottomInset();
  const pull = usePullToRefresh();
  const exams = useExams();
  const marks = useExamMarkList();
  const six = useStatus("six").state;
  const edunex = useStatus("edunex").state;
  const [pastOpen, setPastOpen] = useState(false);
  const view = useMemo(() => {
    if (!exams) return null;
    const input = { tasks: [], exams, marks: [...marks], now };
    return examsView(todoList(input), doneList(input).pastExams, now);
  }, [exams, marks, now]);
  const lines = useMemo(() => (view ? examLines(view, pastOpen) : []), [view, pastOpen]);
  usePerfDrawn(view !== null);
  const toggle = useCallback(() => setPastOpen((open) => !open), []);
  const renderItem = useCallback(({ item: line, index }: { item: ExamLine; index: number }) => <Line line={line} index={index} onFold={toggle} />, [toggle]);
  const reading = (state: typeof six) => state === "connecting" || state === "live";
  const loading = view === null && (reading(six) || reading(edunex));
  return (
    <View testID="screen.exams" style={{ flex: 1, backgroundColor: b.page }}>
      <TopBar v4={b.dark} title={t("mobile.exams.title")} />
      <FlashList
        data={lines}
        keyExtractor={(line) => line.key}
        getItemType={examLineType}
        renderItem={renderItem}
        ListHeaderComponent={<ProblemBanner belowBar />}
        ListEmptyComponent={loading ? <Loading /> : <Nothing signedOut={six === "signed-out" && view === null} />}
        contentContainerStyle={{ paddingHorizontal: space[4], paddingBottom: space[10] + bottom }}
        refreshControl={
          <RefreshControl
            refreshing={pull.refreshing}
            onRefresh={pull.onRefresh}
            colors={[theme.color.primary]}
            progressBackgroundColor={theme.color.surfaceContainerHigh}
          />
        }
      />
    </View>
  );
}

const Line = memo(function Line({ line, index, onFold }: { line: ExamLine; index: number; onFold: () => void }) {
  if (line.type === "heading") return <Heading title={line.title} count={line.count} first={line.first} fold={line.fold} onFold={onFold} />;
  return (
    <Arrive list={line.type === "past" ? "exams.past" : "exams"} index={index}>
      {line.type === "lead" ? (
        <Lead item={line.item} />
      ) : line.type === "row" ? (
        <AheadRow item={line.item} last={line.last} />
      ) : line.type === "undated" ? (
        <UndatedRow exam={line.exam} last={line.last} />
      ) : (
        <PastRow past={line.past} last={line.last} />
      )}
    </Arrive>
  );
});

/** A fact on the leading block: its glyph, then the words. */
function Fact({ icon, children }: { icon: IconName; children: string }) {
  const on = useTheme().v4.onHead;
  const Icon = Icons[icon];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
      <Icon size={20} color={on} />
      <Text size="bodyLarge" weight="medium" tabular style={{ flex: 1, color: on }}>
        {children}
      </Text>
    </View>
  );
}

/** The nearest exam: the one block of colour, its course's (the deep one in both themes, white on it, as Beranda's class). */
function Lead({ item }: { item: ExamItem }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const { go } = useNav();
  const on = useTheme().v4.onHead;
  const tone = useCourseColor()(item.exam.courseCode);
  const fill = THEMES.light.courseTile(tone).ink;
  const name = useExamName()(item.exam);
  const { day, time, place } = factsOf(t, f, item);
  const at = item.at ?? now;
  const left = countdown(t, now, at);
  // On now: the word, no figure. Ahead: how long is left, the number big.
  const onNow = at <= now;
  const figure = onNow ? t("home.today.now") : `${left.value} ${left.unit} ${t("mobile.home.left")}`;
  return (
    <Tap
      feel="card"
      onPress={() => go({ screen: "exam", examId: item.exam.id })}
      testID="card.exam.next"
      accessibilityLabel={factsLabel(name, figure, day, time, place)}
      style={{ backgroundColor: fill, borderRadius: RADIUS, padding: space[5], marginTop: space[2], gap: space[4] }}
    >
      <Text size="titleLarge" face="display" weight="bold" numberOfLines={2} style={{ color: on, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 }}>
        {name}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[5] }}>
        {onNow ? (
          <Text face="display" weight="extrabold" style={{ color: on, fontSize: 28, lineHeight: 36, letterSpacing: -0.4 }}>
            {figure}
          </Text>
        ) : (
          <View style={{ alignItems: "flex-start" }}>
            <Text face="display" weight="extrabold" tabular style={{ color: on, fontSize: 56, lineHeight: 60, letterSpacing: -1.5 }}>
              {left.value}
            </Text>
            <Text size="bodyMedium" weight="medium" style={{ color: on }}>
              {`${left.unit} ${t("mobile.home.left")}`}
            </Text>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0, gap: space[2] }}>
          <Fact icon="Calendar">{day}</Fact>
          {time && <Fact icon="Clock">{time}</Fact>}
          {place && <Fact icon="MapPin">{place}</Fact>}
        </View>
      </View>
    </Tap>
  );
}

/** A group's name; "Sudah lewat" folds, its chevron saying which way. */
function Heading({
  title,
  count,
  first,
  fold,
  onFold,
}: {
  title: GroupTitle | "undated" | "past";
  count: number;
  first: boolean;
  fold: "open" | "closed" | null;
  onFold: () => void;
}) {
  const t = useT();
  const f = useFormat();
  const b = useB();
  const text =
    title === "past"
      ? t("mobile.exams.past")
      : title === "undated"
        ? t("exam.noDate")
        : "period" in title
          ? examWeekLabel(t, f, title.examKind, title.period)
          : t(`tasks.group.${title.group}`);
  const top = first ? space[2] : space[6];
  if (!fold) return <BHeading style={{ marginTop: top, marginBottom: 0 }}>{text}</BHeading>;
  return (
    <Tap
      feel="row"
      onPress={onFold}
      testID="action.exams.past"
      accessibilityLabel={factsLabel(text, t("mobile.exams.count", { count }))}
      accessibilityState={{ expanded: fold === "open" }}
      style={{ marginTop: top, minHeight: 48, justifyContent: "center" }}
    >
      <BHeading
        style={{ marginBottom: 0 }}
        trailing={
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
            <Text size="bodyMedium" tabular style={{ color: b.muted }}>
              {count}
            </Text>
            <View style={{ transform: [{ rotate: fold === "open" ? "180deg" : "0deg" }] }}>
              <Icons.ChevronDown size={20} color={b.muted} />
            </View>
          </View>
        }
      >
        {text}
      </BHeading>
    </Tap>
  );
}

/** A row's start: the day of the month big over its month, then the course's colour as a bar. No day: a quiet glyph. */
function DateMark({ at, code, quiet = false }: { at: number | null; code: string; quiet?: boolean }) {
  const f = useFormat();
  const b = useB();
  const theme = useTheme();
  const tone = useCourseColor()(code);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
      <View style={{ width: DATE_WIDTH, alignItems: "center" }}>
        {at === null ? (
          <Icons.CalendarClock size={24} color={b.muted} />
        ) : (
          <>
            <Text face="display" weight="bold" tabular style={{ color: quiet ? b.fg2 : b.fg, fontSize: 20, lineHeight: 24 }}>
              {String(Number(wibDay(at).slice(8)))}
            </Text>
            <Text size="bodyMedium" numberOfLines={1} style={{ color: b.muted, fontSize: 12, lineHeight: 16 }}>
              {f.dayMonth(at).replace(/\d+/g, "").trim()}
            </Text>
          </>
        )}
      </View>
      <View style={{ width: 4, height: 36, borderRadius: 2, backgroundColor: tone ? theme.course(tone) : b.line }} />
    </View>
  );
}

function Row({
  exam,
  at,
  meta,
  trailing,
  last,
  quiet,
  label,
}: {
  exam: Exam;
  at: number | null;
  meta: string | undefined;
  trailing?: ReactNode;
  last: boolean;
  quiet?: boolean;
  label: string;
}) {
  const { go } = useNav();
  const name = useExamName()(exam);
  return (
    <BRow
      testID={`row.exam.${exam.id}`}
      last={last}
      leading={<DateMark at={at} code={exam.courseCode} quiet={quiet} />}
      title={name}
      meta={meta}
      trailing={trailing}
      onPress={() => go({ screen: "exam", examId: exam.id })}
      accessibilityLabel={factsLabel(name, label)}
    />
  );
}

/** An exam still ahead: the weekday, time and room on its line, how long is left at its end (amber within a day, red once late). */
function AheadRow({ item, last }: { item: ExamItem; last: boolean }) {
  const t = useT();
  const f = useFormat();
  const b = useB();
  const now = useNow();
  const { day, time, place } = factsOf(t, f, item);
  const one = !item.sittings || item.sittings.length < 2;
  // The date is the row's start: the line keeps the weekday (both days, when SIX lists two), then the time and where.
  const meta = factsLabel(item.at === null ? day : one ? f.weekdayShort(item.at) : day, time, place);
  const left = item.at === null ? null : item.at <= now && !item.late ? t("home.today.now") : countdown(t, now, item.at).text;
  const tone = item.at === null ? "neutral" : countdown(t, now, item.at).tone;
  return (
    <Row
      exam={item.exam}
      at={item.at}
      meta={meta}
      last={last}
      label={factsLabel(day, time, place, left)}
      trailing={
        left ? (
          <Text size="bodyMedium" weight="medium" tabular style={{ color: tone === "red" ? b.red : tone === "amber" ? b.amber : b.fg2 }}>
            {left}
          </Text>
        ) : undefined
      }
    />
  );
}

/** No day yet: its exam period when ITB's calendar gives one, else nothing more to say (the heading says "Belum ada tanggal"). */
function UndatedRow({ exam, last }: { exam: Exam; last: boolean }) {
  const t = useT();
  const f = useFormat();
  const period = exam.week && (exam.kind === "UTS" || exam.kind === "UAS") ? examWeekLabel(t, f, exam.kind, exam.week) : undefined;
  return <Row exam={exam} at={null} meta={period} last={last} label={factsLabel(t("exam.noDate"), period)} />;
}

/** An exam behind the Student: when and where it was sat, as Tugas's Selesai says it. */
function PastRow({ past, last }: { past: PastExam; last: boolean }) {
  const t = useT();
  const f = useFormat();
  const { exam } = past;
  const [sitting] = exam.six;
  const online = exam.edunex.find((e) => e.start !== null || e.end !== null);
  const at = sitting ? sitting.start : (online?.end ?? online?.start ?? null);
  const meta = sitting
    ? factsLabel(f.weekdayShort(sitting.start), f.timeRange(sitting.start, sitting.end), sitting.room)
    : online && at !== null
      ? factsLabel(f.weekdayShort(at), t("exam.onEdunex"))
      : t("exam.neverAnnounced");
  return <Row exam={exam} at={at} meta={meta} last={last} quiet label={factsLabel(at !== null ? f.relativeDay(at) : null, meta)} />;
}

/** The page's shape while SIX and Edunex are on their way: the leading block, then rows. */
function Loading() {
  const b = useB();
  return (
    <View testID="skeleton.exams" accessibilityState={{ busy: true }} style={{ paddingTop: space[2] }}>
      <View style={{ backgroundColor: b.soft, borderRadius: RADIUS, padding: space[5], gap: space[4] }}>
        <Skeleton height={22} width="70%" />
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[5] }}>
          <Skeleton height={60} width={64} />
          <View style={{ flex: 1, gap: space[3] }}>
            <Skeleton height={16} width="70%" />
            <Skeleton height={16} width="55%" />
            <Skeleton height={16} width="40%" />
          </View>
        </View>
      </View>
      <Skeleton height={22} width={150} style={{ marginTop: space[6] }} />
      {[0, 1, 2].map((row) => (
        <View key={row} style={{ flexDirection: "row", alignItems: "center", gap: space[4], height: 64 }}>
          <Skeleton height={40} width={DATE_WIDTH} />
          <View style={{ flex: 1, gap: space[2] }}>
            <Skeleton height={16} width={row === 1 ? "60%" : "78%"} />
            <Skeleton height={12} width={130} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Nothing to list: no SIX and nothing from Edunex (said once, with the way in), or a term with no exam announced. */
function Nothing({ signedOut }: { signedOut: boolean }) {
  const t = useT();
  const theme = useTheme();
  const { signIn, busy } = useSignIn();
  const icon = <Icons.CalendarClock size={24} color={theme.color.onSecondaryContainer} />;
  if (signedOut)
    return (
      <EmptyState icon={icon} title={t("mobile.exams.noSix")}>
        <Button variant="primary" busy={busy} onPress={() => void signIn("six")} testID="action.signIn.six">
          {t("action.signInTo", { source: "SIX" })}
        </Button>
      </EmptyState>
    );
  return <EmptyState icon={icon} title={t("mobile.exams.empty")} description={t("mobile.exams.emptyHint")} />;
}
