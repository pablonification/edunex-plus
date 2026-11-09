// "Perlu kamu urus" (round 3, the real phone): what needs the Student, most serious first, as one calm list of
// full-width rows in a white card. First the courses at or past their absence limit (the course's tile, its name, the
// absence meter Kuliah draws with its one word: "+2", "habis"; opens the course), then classes that clash (both courses'
// names apart, "Bentrok · Kam, 12 Nov, 16:00–16:30"; opens Jadwal on that day), then what to hand in or do (the Task's
// own name, its deadline under it the one way the app writes a date; Edunex's hand at the end when doing it counts
// for attendance; red with a warning sign once late). At most five rows; the chevron opens the whole list, with what's
// put off and away (./needs-screen.tsx). Hidden behind one quiet line when there's nothing. While the first read runs,
// the rows stand in their shape: picked from half the data, they swapped under the Student's eyes.
import { router } from "expo-router";
import { useMemo } from "react";
import { View } from "react-native";
import type { TermCourse } from "../../../../src/app/courses";
import { useOpenExternal } from "../../../../src/app/hooks";
import { type Format, type Translate, useFormat, useNow, useT } from "../../../../src/app/i18n";
import { useDone, useSnoozes } from "../../../../src/app/snoozes";
import { rupiah } from "../../../../src/core/academic";
import { wibDay } from "../../../../src/core/course-meetings";
import { taskPutAway } from "../../../../src/core/done";
import { heldBack } from "../../../../src/core/held-back";
import type { NeedDraft } from "../../../../src/core/needs";
import { activeSnooze, snoozeKey } from "../../../../src/core/snooze";
import { useSettling } from "../../host/settling";
import { useNav } from "../../nav";
import { AttendanceMeter, meterModel } from "../../parts/attendance-meter";
import { useFirstReadRunning } from "../../shell/source-status";
import { absenceName } from "../../ui/absence";
import { IconButton } from "../../ui/controls";
import { Skeleton } from "../../ui/display";
import { Rise } from "../../ui/expressive";
import { Group, GroupRow, IconTile } from "../../ui/group";
import { Icons } from "../../ui/icons";
import { factsLabel } from "../../ui/layout";
import { PressScale } from "../../ui/press";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { CourseTile } from "../../ui/tile";
import { showOnSchedule } from "../schedule/schedule-screen";
import { nameOf, shortName } from "./parts";
import { type AbsenceProblem, type ClashProblem, firstRows, type Problems } from "./problems";

/** Rows Beranda shows; the rest are on the whole list. */
export const URUS_ROWS = 5;

interface TodoRow {
  need: NeedDraft;
  code: string | null;
  /** The thing's own name: the Task's title, "Isi Presensi …", "UTS …", "Kirim KRS". */
  title: string;
  /** Its deadline or window in one line, dates written as the app writes them ("Tenggat Jum, 13 Nov, 23:59"). */
  when: string;
  /** Past its deadline: the line in red, with a warning sign. */
  late: boolean;
  /** Doing it counts for attendance (an Edunex Presence): Edunex's hand at the row's end. */
  presence: boolean;
  /** The course's whole name, for what TalkBack reads (the row shows its tile). */
  course: string;
}

/** A need as a row: its name and its deadline. Attendance is a problem row above; today's classes are the now card's and Nanti hari ini's. */
function todoOf(t: Translate, f: Format, now: number, need: NeedDraft, courses: readonly TermCourse[]): TodoRow | null {
  const course = need.course ? nameOf(courses, need.course) : "";
  const base = { need, code: need.course ?? null, course, late: false, presence: false };
  switch (need.kind) {
    case "task": {
      const { task } = need;
      if (task.dueAt === null) return null;
      return { ...base, title: task.title, when: t("home.need.task.due", { when: f.dueLabel(task.dueAt) }), late: task.dueAt < now };
    }
    case "exam": {
      const closes = need.window && need.sitting.end !== null ? need.sitting.end : null;
      return {
        ...base,
        title: t("home.need.exam", { kind: t(`exam.kind.${need.exam.kind}`), course: shortName(course) }),
        when:
          closes !== null
            ? t("home.need.exam.closes", { when: f.dueLabel(closes) })
            : need.sitting.end !== null
              ? f.dayTimeRange(need.sitting.start, need.sitting.end)
              : f.dueLabel(need.sitting.start),
      };
    }
    case "presence": {
      const { session } = need;
      // The Task's own name when handing it in is what counts (the hand says the rest), else Edunex's Presence.
      const title = need.task ? need.task.title : t("home.need.presence", { course: shortName(course) });
      // Open: when it closes. Ahead: its window, the day said once when it opens and closes on the same day.
      const when = need.open
        ? t("home.need.exam.closes", { when: f.dueLabel(session.closesAt) })
        : f.dayOffset(session.opensAt) === f.dayOffset(session.closesAt)
          ? f.dayTimeRange(session.opensAt, session.closesAt)
          : `${f.dueLabel(session.opensAt)}–${f.dueLabel(session.closesAt)}`;
      return { ...base, title, when, presence: true, late: need.open && session.closesAt < now };
    }
    case "meeting":
      return {
        ...base,
        title: shortName(course),
        when: `${t("mobile.home.kind.meeting")} · ${f.dayTimeRange(need.meeting.start, need.meeting.end)}`,
      };
    case "krs":
      return {
        ...base,
        title: t("home.need.krs"),
        when: need.open ? t("home.need.exam.closes", { when: f.dueLabel(need.closesAt) }) : t("home.need.krs.opens", { date: f.dueLabel(need.at!) }),
      };
    case "bill": {
      const due = need.bill.nextDueAt;
      if (due === null) return null;
      return {
        ...base,
        title: t("home.need.bill", { amount: rupiah(Math.max(0, (need.bill.amount ?? 0) - (need.bill.paid ?? 0))) }),
        when: t(need.overdue ? "home.need.bill.overdue" : "home.need.bill.due", { date: f.relativeDay(due) }),
        late: need.overdue,
      };
    }
    case "attendance":
    case "class":
      return null;
  }
}

export type UrusRow =
  | { kind: "absence"; key: string; item: AbsenceProblem }
  | { kind: "clash"; key: string; item: ClashProblem }
  | { kind: "todo"; key: string; item: TodoRow };

/** Every row the list has, most serious first: absences, clashes, then what to do (today's deadlines, then the week's). */
export function useUrusRows(problems: Problems, needs: readonly NeedDraft[], due: readonly NeedDraft[], courses: readonly TermCourse[]): UrusRow[] {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const { entries } = useSnoozes();
  const { entries: handled } = useDone();
  return useMemo(() => {
    const { shown } = heldBack(needs, due, entries, handled, now);
    const today = due.filter(
      (need) =>
        need.kind === "task" && !activeSnooze(snoozeKey(need), entries, now) && !taskPutAway(need.task, handled) && !shown.some((s) => s.id === need.id),
    );
    const todos = [...today, ...shown].flatMap((need) => {
      const row = todoOf(t, f, now, need, courses);
      return row ? [{ kind: "todo" as const, key: need.id, item: row }] : [];
    });
    return [
      ...problems.absences.map((item) => ({ kind: "absence" as const, key: `absence:${item.code}`, item })),
      ...problems.clashes.map((item) => ({ kind: "clash" as const, key: `clash:${item.key}:${item.from}`, item })),
      ...todos,
    ];
  }, [problems, needs, due, entries, handled, now, t, f, courses]);
}

export function Urus({
  problems,
  needs,
  due,
  courses,
}: {
  problems: Problems;
  needs: readonly NeedDraft[];
  due: readonly NeedDraft[];
  courses: readonly TermCourse[];
}) {
  const t = useT();
  const v = useTheme().v4;
  const all = useUrusRows(problems, needs, due, courses);
  const rows = useMemo(() => firstRows(all, URUS_ROWS), [all]);
  // The demo's first sync, or the Student's first read after a sign-in (the top bar's "Membaca …").
  const settling = useSettling();
  const firstReading = useFirstReadRunning();
  const reading = settling || firstReading;
  // Nothing to handle: a single quiet line stays as the way to the whole list (what's put off, what changed).
  if (!rows.length && !reading)
    return (
      <Rise screen="home" index={2}>
        <PressScale
          onPress={() => router.push("/needs")}
          testID="action.needs.all"
          style={{
            marginTop: space[6],
            backgroundColor: v.card,
            borderRadius: 20,
            minHeight: 56,
            paddingHorizontal: space[4],
            flexDirection: "row",
            alignItems: "center",
            gap: space[3],
          }}
        >
          <Icons.CheckCircle size={22} weight="fill" color={v.okFg} />
          <Text size="bodyLarge" weight="medium" style={{ color: v.fg, flex: 1 }}>
            {t("mobile.home.toHandleNone")}
          </Text>
          <Icons.ChevronRight size={20} color={v.muted} />
        </PressScale>
      </Rise>
    );
  return (
    <View testID="section.needs">
      <Rise screen="home" index={2}>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: space[6], marginBottom: space[2], marginLeft: space[1] }}>
          <Text size="titleMedium" face="display" weight="bold" accessibilityRole="header" style={{ flex: 1, fontSize: 17, letterSpacing: -0.2 }}>
            {t("mobile.home.toHandle")}
          </Text>
          <IconButton label={t("home.changes.all")} onPress={() => router.push("/needs")} testID="action.needs.all">
            <Icons.ChevronRight size={20} color={v.muted} />
          </IconButton>
        </View>
      </Rise>
      <Rise screen="home" index={3}>
        {reading ? <UrusLoading /> : <UrusList rows={rows} courses={courses} />}
      </Rise>
    </View>
  );
}

/** The rows in one white card. */
export function UrusList({ rows, courses }: { rows: readonly UrusRow[]; courses: readonly TermCourse[] }) {
  return (
    <Group testID="list.needs">
      {rows.map((row, i) =>
        row.kind === "absence" ? (
          <AbsenceRow key={row.key} item={row.item} first={i === 0} courses={courses} />
        ) : row.kind === "clash" ? (
          <ClashRow key={row.key} item={row.item} first={i === 0} courses={courses} />
        ) : (
          <TodoRowView key={row.key} row={row.item} first={i === 0} />
        ),
      )}
    </Group>
  );
}

/** Two rows' shape, while the first read runs. */
export function UrusLoading() {
  const v = useTheme().v4;
  return (
    <View testID="section.needs.reading" accessibilityState={{ busy: true }} style={{ backgroundColor: v.card, borderRadius: 20 }}>
      {[0, 1].map((i) => (
        <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: 14, paddingVertical: space[3], minHeight: 68 }}>
          <Skeleton height={44} width={44} style={{ borderRadius: 14 }} />
          <View style={{ flex: 1, gap: space[2] }}>
            <Skeleton height={16} width="70%" />
            <Skeleton height={12} width="45%" />
          </View>
        </View>
      ))}
    </View>
  );
}

/** A course at or past its absence limit: its name, the meter and its one word. Opens the course (Pertemuan first). */
function AbsenceRow({ item, first, courses }: { item: AbsenceProblem; first: boolean; courses: readonly TermCourse[] }) {
  const t = useT();
  const { go } = useNav();
  const name = nameOf(courses, item.code);
  const model = useMemo(() => meterModel(t, item), [t, item]);
  return (
    <GroupRow
      first={first}
      testID={`row.need.absence.${item.code}`}
      accessibilityRole="button"
      accessibilityLabel={factsLabel(name, absenceName(t, item.health), model?.label)}
      leading={<CourseTile code={item.code} name={name} />}
      title={<RowTitle text={shortName(name)} />}
      meta={model ? <AttendanceMeter model={model} hideLabel /> : undefined}
      onPress={() => go({ screen: "course", code: item.code })}
    />
  );
}

/** Two classes at once: both courses by name, kept apart, and when. Opens Jadwal on that day. */
function ClashRow({ item, first, courses }: { item: ClashProblem; first: boolean; courses: readonly TermCourse[] }) {
  const t = useT();
  const f = useFormat();
  const { go } = useNav();
  const a = shortName(nameOf(courses, item.a.courseCode, item.a.courseName));
  const b = shortName(nameOf(courses, item.b.courseCode, item.b.courseName));
  const when = f.dayTimeRange(item.from, item.to);
  return (
    <GroupRow
      first={first}
      testID={`row.need.clash.${item.key}`}
      accessibilityRole="button"
      accessibilityLabel={factsLabel(t("alert.overlap", { a, b }), when)}
      leading={<IconTile tone="amber" icon={(color) => <Icons.Overlap size={22} weight="bold" color={color} />} />}
      title={<RowTitle text={`${a} × ${b}`} />}
      meta={<Meta tone="amber" text={`${t("mobile.home.chip.clash")} · ${when}`} />}
      onPress={() => {
        showOnSchedule(wibDay(item.from));
        go({ screen: "schedule" });
      }}
    />
  );
}

/** Something to hand in or do: its own name, its deadline; Edunex's hand when it counts for attendance. */
function TodoRowView({ row, first }: { row: TodoRow; first: boolean }) {
  const t = useT();
  const v = useTheme().v4;
  const { go } = useNav();
  const open = useOpenExternal();
  const { need } = row;
  const counts = t("mobile.home.countsPresence");
  return (
    <GroupRow
      first={first}
      testID={`row.need.${need.id}`}
      accessibilityRole="button"
      accessibilityLabel={factsLabel(row.title, need.kind === "task" || need.kind === "presence" ? row.course : null, row.when, row.presence && counts)}
      leading={
        row.code ? <CourseTile code={row.code} name={row.course} /> : <IconTile tone="brand" icon={(color) => <Icons.ListChecks size={22} color={color} />} />
      }
      title={<RowTitle text={row.title} />}
      meta={
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[1] }}>
          {row.late && <Icons.AlertTriangle size={14} weight="bold" color={v.redFg} />}
          <Meta tone={row.late ? "red" : undefined} text={row.when} />
        </View>
      }
      trailing={
        row.presence ? (
          <View testID={`row.need.${need.id}.presence`} accessible accessibilityRole="image" accessibilityLabel={counts}>
            <Icons.Hand size={20} color={v.muted} />
          </View>
        ) : undefined
      }
      onPress={() => (need.action.kind === "go" ? go(need.action.route) : open(need.action.url))}
    />
  );
}

function RowTitle({ text }: { text: string }) {
  const v = useTheme().v4;
  return (
    <Text size="bodyLarge" weight="medium" numberOfLines={2} style={{ color: v.fg, lineHeight: 21 }}>
      {text}
    </Text>
  );
}

function Meta({ text, tone }: { text: string; tone?: "red" | "amber" }) {
  const v = useTheme().v4;
  return (
    <Text size="bodyMedium" tabular numberOfLines={1} style={{ color: tone === "red" ? v.redFg : tone === "amber" ? v.ambFg : v.muted, flexShrink: 1 }}>
      {text}
    </Text>
  );
}
