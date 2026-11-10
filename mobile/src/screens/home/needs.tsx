// "Perlu perhatianmu": the week ahead, never repeating today, as src/app/screens/home.tsx lists it.
// Beranda shows the first three and "Lihat semua"; the whole list is its own screen (app/needs.tsx).
// Each row can be put off ("Ingatkan nanti") and, where only the Student can know it's dealt with,
// put away ("Sudah beres"): a swipe (ui/swipe.tsx), or a long press, or TalkBack's actions. What's
// put off and away is counted under the whole list, and opens there.
import { useMemo, useState } from "react";
import { View } from "react-native";
import type { TermCourse } from "../../../../src/app/courses";
import { useOpenExternal } from "../../../../src/app/hooks";
import { type Format, type Translate, useFormat, useNow, useT } from "../../../../src/app/i18n";
import { useDone, useSnoozes } from "../../../../src/app/snoozes";
import { useDataset, useStatus } from "../../../../src/app/store";
import { rupiah } from "../../../../src/core/academic";
import { percent } from "../../../../src/core/attendance";
import { heldBack } from "../../../../src/core/held-back";
import type { DoneEntry, SnoozeEntry } from "../../../../src/core/models";
import type { NeedDraft, NeedsRange } from "../../../../src/core/needs";
import { snoozable } from "../../../../src/core/snooze";
import { dateMove, type EditView, editView } from "../../../../src/core/task-edits";
import { useNav } from "../../nav";
import { absenceName } from "../../ui/absence";
import { Button } from "../../ui/controls";
import { CourseIconTile } from "../../ui/course-icon-tile";
import { Skeleton } from "../../ui/display";
import { Group, GroupRow, IconTile, Panel, Pill } from "../../ui/group";
import { Icons } from "../../ui/icons";
import { factsLabel, Meta } from "../../ui/layout";
import { Tap } from "../../ui/moves";
import { LINK_SLOP } from "../../ui/sizes";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { countdown, quickActions } from "../tasks/row-parts";
import { facts, heldAt, memoRow } from "./held";
import { classDayTime, DAY, doneOf, nameOf, QuickRow } from "./parts";

type Tone = "danger" | "warning" | null;

/**
 * `due`: "Hari ini"'s deadlines, as items: the ones put off or put away are listed here with the rest.
 * `range`: how far ahead it looks, for the empty list to say only what's true.
 */
export function NeedsYou({
  needs,
  due,
  range,
  courses,
}: {
  needs: readonly NeedDraft[];
  due: readonly NeedDraft[];
  range: NeedsRange;
  courses: readonly TermCourse[];
}) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const theme = useTheme();
  const tasks = useDataset("edunex.tasks");
  // Until Edunex's Tasks arrive, an empty list would claim more than the app knows.
  const edunex = useStatus("edunex");
  const loading = tasks === undefined && edunex.state !== "signed-out";
  // What the Student put off ("Ingatkan nanti") leaves the list until its time, or until it changes;
  // what they marked handled ("Sudah kucek") leaves it until a new fact brings it back.
  const { entries } = useSnoozes();
  const { entries: handled } = useDone();
  const { shown, snoozed, done } = useMemo(() => heldBack(needs, due, entries, handled, now), [needs, due, entries, handled, now]);
  const [listOpen, setListOpen] = useState(false);
  const away = snoozed.length + done.length;
  // Closed once nothing is put off or away, so the next one doesn't find the list open.
  if (listOpen && !away) setListOpen(false);
  const awayLine = away > 0 && <AwayLine snoozed={snoozed.length} done={done.length} open={listOpen} onToggle={() => setListOpen(!listOpen)} />;
  const rows = shown;
  // Each row drawn again only when its words could change (./held.tsx): its data, the courses' names, the clock within
  // a day of its moment.
  const names = courses.map((course) => `${course.code}=${course.name}`).join("|");
  const held = (need: NeedDraft, first: boolean) => {
    const { sig, moments } = facts({ need, names });
    // The first row has no hairline over it: drawn again when another row becomes the first.
    return { sig: `${sig}|${first}`, at: heldAt(now, moments, DAY) };
  };
  // Under the screen's own title ("Perlu kamu urus"): no second title, the count is the list. v4's rows in one card
  // (round 2, the judge's 02b): a tile, the title, one meta line, one pill.
  return (
    <View testID="section.needs" style={{ marginTop: space[2] }}>
      {loading ? (
        <Panel style={{ padding: space[4], gap: space[3] }}>
          <Skeleton width="33%" />
          <Skeleton height={12} width="66%" />
        </Panel>
      ) : shown.length ? (
        <>
          <Group>
            {rows.map((need, i) => (
              <HeldNeed key={need.id} {...held(need, i === 0)} props={{ need, courses, first: i === 0 }} />
            ))}
          </Group>
          {awayLine && <View style={{ marginTop: space[3], paddingHorizontal: space[1] }}>{awayLine}</View>}
        </>
      ) : (
        // Everything left is put off or handled: say so, never "nothing due".
        <Panel style={{ paddingHorizontal: space[4], paddingVertical: space[3.5] }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[2] }}>
            <View style={{ paddingTop: 3 }}>
              {/* Green says "all clear": not while things are only put off. */}
              {snoozed.length ? (
                <Icons.Snooze size={16} color={theme.color.faint} />
              ) : (
                <Icons.CheckCircle size={16} weight="bold" color={theme.color.successFg} />
              )}
            </View>
            <Text weight="medium" style={{ flex: 1 }}>
              {snoozed.length
                ? t("home.needs.allSnoozed")
                : // A group Task marked done may still be due: "handled", not "nothing due".
                  done.length
                  ? t("home.needs.allHandled")
                  : // Something due that isn't listed here (Hari ini has it, or it isn't open yet): never "nothing due".
                    range.next !== null
                    ? t("home.needs.noneElse")
                    : t("home.needs.none", { count: range.days })}
            </Text>
          </View>
          <View style={{ marginTop: 2, paddingLeft: 24 }}>
            {awayLine || (
              <Text size="small" tone="muted">
                {range.next !== null
                  ? t("home.needs.noneElseHint", { when: f.dayTimeWord(range.next) })
                  : t("home.needs.noneHint", { day: `${f.weekday(range.until - 1)}, ${f.dayMonth(range.until - 1)}` })}
              </Text>
            )}
          </View>
        </Panel>
      )}
      {!loading && listOpen && snoozed.length > 0 && (
        <Group style={{ marginTop: space[3] }} testID="list.snoozed">
          {snoozed.map(({ item, entry }, i) => (
            <SnoozedRow key={item.id} need={item} entry={entry} courses={courses} first={i === 0} />
          ))}
        </Group>
      )}
      {!loading && listOpen && done.length > 0 && (
        <Group style={{ marginTop: space[3] }} testID="list.done">
          {done.map(({ item, entry }, i) => (
            <DoneRow key={item.id} need={item} entry={entry} courses={courses} first={i === 0} />
          ))}
        </Group>
      )}
    </View>
  );
}

/** "2 ditunda · 1 sudah beres · Tampilkan": quiet, at the end of the list, opening what's put off and away. */
function AwayLine({ snoozed, done, open, onToggle }: { snoozed: number; done: number; open: boolean; onToggle: () => void }) {
  const t = useT();
  const theme = useTheme();
  return (
    <Meta>
      {snoozed > 0 ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Icons.Snooze size={14} color={theme.color.faint} />
          <Text size="small" tone="muted">
            {t("snooze.count", { count: snoozed })}
          </Text>
        </View>
      ) : (
        ""
      )}
      {done > 0 ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Icons.Check size={14} weight="bold" color={theme.color.faint} />
          <Text size="small" tone="muted">
            {t("done.count", { count: done })}
          </Text>
        </View>
      ) : (
        ""
      )}
      <Tap
        feel="row"
        borderless
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={onToggle}
        hitSlop={LINK_SLOP}
        testID="action.heldBack"
      >
        <Text size="small" weight="medium" tone="accent">
          {open ? t("snooze.hideList") : t("snooze.showList")}
        </Text>
      </Tap>
    </Meta>
  );
}

/** A row's one button under its words, its label in line with them: beside, it would squeeze the title on a phone. */
const UNDER = { alignSelf: "flex-start", marginLeft: -space[3], marginTop: space[1] } as const;

/** Something put off: what it is, when it's back, and the way to bring it back now. */
function SnoozedRow({ need, entry, courses, first }: { need: NeedDraft; entry: SnoozeEntry; courses: readonly TermCourse[]; first: boolean }) {
  const t = useT();
  const f = useFormat();
  const { wake } = useSnoozes();
  const view = useNeedView(courses)(need);
  const when = f.dayTimeWord(entry.until);
  return (
    <GroupRow
      first={first}
      testID={`row.snoozed.${need.id}`}
      leading={<NeedTile need={need} />}
      title={<RowTitle>{view.title}</RowTitle>}
      meta={
        <MetaLine>
          {[
            view.titleLacksCourse ? need.course : null,
            view.which,
            entry.reason === "change" ? t("snooze.untilChange", { when }) : t("snooze.until", { when }),
          ]}
        </MetaLine>
      }
    >
      <Button
        size="sm"
        variant="ghost"
        label={t("snooze.wakeFor", { title: fullName(need, view) })}
        onPress={() => void wake(entry.id).catch(() => undefined)}
        testID="action.wake"
        style={UNDER}
      >
        {t("snooze.wake")}
      </Button>
    </GroupRow>
  );
}

/** Something handled: what it is, when the Student said so, and the way to show it again. */
function DoneRow({ need, entry, courses, first }: { need: NeedDraft; entry: DoneEntry; courses: readonly TermCourse[]; first: boolean }) {
  const t = useT();
  const f = useFormat();
  const { unmark } = useDone();
  const view = useNeedView(courses)(need);
  return (
    <GroupRow
      first={first}
      testID={`row.done.${need.id}`}
      leading={<NeedTile need={need} />}
      title={<RowTitle>{view.title}</RowTitle>}
      meta={<MetaLine>{[view.titleLacksCourse ? need.course : null, view.which, t(`done.line.${entry.how}`, { when: f.dayTimeWord(entry.at) })]}</MetaLine>}
    >
      <Button
        size="sm"
        variant="ghost"
        label={t("done.showAgainFor", { title: fullName(need, view) })}
        onPress={() => void unmark(entry.id).catch(() => undefined)}
        testID="action.showAgain"
        style={UNDER}
      >
        {t("done.showAgain")}
      </Button>
    </GroupRow>
  );
}

interface NeedView {
  title: string;
  /** One meta line: the course's code and at most one fact (the rest is one tap deeper, on the item's own page). */
  meta: Fact[];
  /** The meta line in a state's ink: a Task changed after the hand-in, a bill past its date. */
  metaTone?: "red" | "amber";
  /** The row's one pill: how far off, or the state. */
  when: string | null;
  tone: Tone;
  /** What the row's press does, for screen readers. */
  label?: string;
  /** The title is a Task's own name ("Tugas 02"), which doesn't say which course. */
  titleLacksCourse?: boolean;
  /** What tells it from a look-alike of the same course: a Presence window's class ("Kam, 8 Okt, 08:00–10:00"). */
  which?: string;
}

/** What an item is, said whole where its facts aren't beside it: a Task's name with its course ("Tugas 02 · II4091"), a window with its class. From src/app/screens/home.tsx. */
const fullName = (need: NeedDraft, view: NeedView) => factsLabel(view.title, view.titleLacksCourse && need.course, view.which);

/**
 * A Task changed after the hand-in, as its row's meta says it: how many things, or the one date that moved, by name
 * (the Task page's History says the rest). Not compared: that it changed. From src/app/screens/home.tsx.
 */
function editedLine(t: Translate, f: Format, view: EditView | null): string {
  if (!view || view.checked || view.state !== "known") return t("home.need.task.edited");
  const move = dateMove(view.changes);
  const date = (at: number) => `${f.weekdayShort(at)}, ${f.dayMonth(at)}`;
  if (!move) return t("home.need.task.editedCount", { count: view.changes.length });
  const change =
    move.kind === "deadline"
      ? move.to === null
        ? t("home.move.deadlineRemoved")
        : move.from === null
          ? t("home.move.deadlineAdded", { date: date(move.to) })
          : t(move.to < move.from ? "home.move.deadlineEarlier" : "home.move.deadline", { date: date(move.to) })
      : move.to === null
        ? t("home.move.opensNow")
        : t("home.move.opens", { date: date(move.to) });
  return t("home.need.task.editedMove", { change });
}

/** An item's title, its one meta line and its status, the desktop's words (src/app/screens/home.tsx, useNeedView) drawn with the phone's text. */
function useNeedView(courses: readonly TermCourse[]): (need: NeedDraft) => NeedView {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const edits = useDataset("edunex.taskEdits");
  const { entries: handled } = useDone();
  const near = (at: number | null): Tone => (at !== null && at - now <= DAY ? "warning" : null);
  // How far off, short, as the row's pill ("7 hari", "5 jam"); "dalam 7 hari" stays in the item's own page.
  const soon = (at: number) => countdown(t, now, at).text;
  return (need) => {
    const course = need.course ?? null;
    switch (need.kind) {
      case "presence": {
        // Which class it's for: a window can stay open for days, into the course's next class.
        const of = need.class ?? need.session;
        const which = classDayTime(f, of.start, of.end);
        const closes = t("home.need.presence.closes", { time: f.dayTime(need.session.closesAt) });
        if (need.open)
          // Without SIX nobody knows whether it counts: worth doing just in case, so no amber.
          return need.countedIn === "noSix"
            ? {
                title: t("home.need.presenceNoSix", { course: need.course ?? "" }),
                which,
                meta: [course, closes],
                when: soon(need.session.closesAt),
                tone: null,
              }
            : {
                title: t("home.need.presence", { course: need.course ?? "" }),
                which,
                meta: [course, closes],
                when: soon(need.session.closesAt),
                tone: "warning",
              };
        return {
          // The Task by its own name, as Tugas and the Task page name it (the hand tile says it counts for attendance).
          title: need.task ? need.task.title : t("home.need.presenceAhead", { course: need.course ?? "" }),
          titleLacksCourse: need.task !== null,
          meta: [course],
          when: soon(need.session.opensAt),
          tone: null,
        };
      }
      case "task": {
        const { task } = need;
        if (need.reason === "edited")
          return {
            title: task.title,
            titleLacksCourse: true,
            // What changed is on the Task page (its History): the row only says it changed.
            meta: [course, editedLine(t, f, editView(task, edits, handled))],
            metaTone: "amber",
            when: null,
            tone: "warning",
          };
        // One fact after the course: a draft not handed in, else the deadline (late says itself at the end).
        const fact = need.draft
          ? t("home.need.task.draft")
          : need.reason === "overdue"
            ? null
            : need.reason === "short"
              ? t("home.need.task.short", { duration: f.countdown(now + (task.dueAt! - task.opensAt!)) })
              : t("home.need.task.due", { when: f.dayTimeWord(task.dueAt!) });
        return {
          title: task.title,
          titleLacksCourse: true,
          meta: [course, fact],
          when: need.reason === "overdue" ? t("home.need.late") : soon(task.dueAt!),
          tone: need.reason === "overdue" ? "danger" : near(task.dueAt),
        };
      }
      case "exam": {
        const { exam, sitting } = need;
        const time = sitting.end !== null ? f.timeRange(sitting.start, sitting.end) : f.time(sitting.start);
        // Open for days on Edunex: it runs out when it closes, like a deadline.
        const closes = need.window && sitting.end !== null ? sitting.end : null;
        const title = t("home.need.exam", { kind: t(`exam.kind.${exam.kind}`), course: nameOf(courses, exam.courseCode) });
        const room = sitting.source === "six" ? sitting.room : null;
        const when = soon(closes ?? sitting.start);
        // The day and the time it starts, short enough for one line beside the pill: the title names the course, and
        // the code, the end time and the room are in what TalkBack reads and on the exam's page (with a take-home, and
        // SIX and Edunex disagreeing).
        const fact =
          closes !== null ? t("home.need.exam.closes", { when: f.dayTimeWord(closes) }) : `${f.relativeDay(sitting.start)}, ${f.time(sitting.start)}`;
        const full = closes !== null ? fact : `${f.relativeDay(sitting.start)}, ${time}`;
        return {
          title,
          meta: [fact],
          when,
          tone: near(closes ?? sitting.start),
          label: factsLabel(title, course, full, room, when),
        };
      }
      case "attendance": {
        const { health } = need;
        const vars = { attended: health.attended ?? 0, held: health.held ?? 0, target: health.target, best: percent(health.best ?? 0) };
        const out = health.state === "out";
        // The course's name (few Students know their KU and PL codes by heart), the count, and the state as its status
        // by the name it has on every tab ("Jatah absen habis", "Lewat jatah absen 1×": src/ui/absence.ts). Out of reach, the meta is
        // the best it can still reach ("Maks 73%", as Beranda's card), short enough for one line beside the chip; the
        // target is in what TalkBack reads (and on the course's page).
        const title = need.course ? nameOf(courses, need.course) : "";
        const fact = t(out ? "mobile.needs.best" : "home.need.attendance.noneMeta", vars);
        const when = absenceName(t, health) ?? "";
        return {
          title,
          meta: [course, fact],
          when,
          tone: out ? "danger" : "warning",
          label: out ? factsLabel(title, course, fact, t("presence.target", { value: health.target }), when) : undefined,
        };
      }
      case "meeting": {
        const { meeting } = need;
        return {
          title: t(meeting.online ? "home.need.meeting.online" : "home.need.meeting", { course: need.course ?? "", day: f.relativeDay(meeting.start) }),
          meta: [course, f.timeRange(meeting.start, meeting.end)],
          when: soon(meeting.start),
          tone: null,
          label: need.action.kind === "open" ? t("home.today.joinLabel", { course: need.course ?? "" }) : undefined,
        };
      }
      case "krs": {
        const date = `${f.weekdayShort(need.open ? need.closesAt - 1 : need.at!)} ${f.dayMonth(need.open ? need.closesAt - 1 : need.at!)}`;
        return {
          title: t("home.need.krs"),
          meta: [need.open ? t("home.need.krs.closes", { date }) : t("home.need.krs.opens", { date })],
          when: soon(need.open ? need.closesAt : need.at!),
          tone: need.open ? near(need.closesAt) : null,
        };
      }
      case "bill": {
        const { bill } = need;
        const date = `${f.weekdayShort(bill.nextDueAt! - 1)} ${f.dayMonth(bill.nextDueAt! - 1)}`;
        return {
          title: t("home.need.bill", { amount: rupiah(Math.max(0, (bill.amount ?? 0) - (bill.paid ?? 0))) }),
          meta: [t(need.overdue ? "home.need.bill.overdue" : "home.need.bill.due", { date })],
          metaTone: need.overdue ? "red" : undefined,
          when: need.overdue ? t("home.need.late") : soon(bill.nextDueAt!),
          tone: need.overdue ? "danger" : near(bill.nextDueAt),
        };
      }
      case "class":
        // Today's classes are in "Hari ini"; attention() leaves them out.
        return { title: need.session.courseName, meta: [], when: null, tone: null };
    }
  };
}

const HeldNeed = memoRow(NeedRow);

function NeedRow({ need, courses, first }: { need: NeedDraft; courses: readonly TermCourse[]; first: boolean }) {
  const t = useT();
  const v = useTheme().v4;
  const view = useNeedView(courses)(need);
  const now = useNow();
  const { go } = useNav();
  const open = useOpenExternal();
  const act = () => (need.action.kind === "go" ? go(need.action.route) : open(need.action.url));
  const name = fullName(need, view);
  const red = view.tone === "danger";
  return (
    // Attendance has "Sudah tahu" instead of a snooze: the warning is for one class, or for good.
    <QuickRow name={name} done={doneOf(t, need)} snooze={need.kind !== "attendance" ? snoozable(need, now) : null} surface={v.card}>
      {({ quick, onLongPress }) => (
        <GroupRow
          first={first}
          testID={`row.need.${need.id}`}
          leading={<NeedTile need={need} />}
          title={<RowTitle>{view.title}</RowTitle>}
          // One meta line: what doesn't fit is on the item's own page (the full text stays for screen readers).
          meta={<MetaLine tone={view.metaTone}>{view.meta}</MetaLine>}
          // The row's one status: how far off (amber within a day), or its state; red with a sign, never the colour alone.
          trailing={
            view.when ? (
              <Pill
                tone={red ? "red" : view.tone === "warning" ? "amber" : "plain"}
                icon={red ? (color) => <Icons.AlertTriangle size={13} weight="bold" color={color} /> : undefined}
              >
                {view.when}
              </Pill>
            ) : undefined
          }
          accessibilityLabel={view.label}
          {...quickActions(quick)}
          onPress={act}
          onLongPress={onLongPress}
        />
      )}
    </QuickRow>
  );
}

/** A fact of a row's meta line; blanks are left out. */
type Fact = string | null | undefined | false;

/** A row's title, two lines at most (the whole of it is in what TalkBack reads and on the item's page). */
function RowTitle({ children }: { children: string }) {
  const v = useTheme().v4;
  return (
    <Text size="bodyLarge" weight="medium" numberOfLines={2} style={{ color: v.fg, lineHeight: 21 }}>
      {children}
    </Text>
  );
}

/** A row's one meta line, its facts joined with "·" and cut to one line. */
function MetaLine({ children, tone }: { children: readonly Fact[]; tone?: "red" | "amber" }) {
  const v = useTheme().v4;
  const color = tone === "red" ? v.redFg : tone === "amber" ? v.ambFg : v.muted;
  return (
    <Text size="bodyMedium" tabular numberOfLines={1} style={{ color }}>
      {children.filter(Boolean).join(" · ")}
    </Text>
  );
}

/** A need's tile: its kind's icon on its course's colour; KRS and UKT, which have no course, on the brand's. */
function NeedTile({ need }: { need: NeedDraft }) {
  const glyph = (color: string) => {
    const Icon = NEED_ICON[need.kind === "task" && need.reason === "edited" ? "edited" : need.kind];
    return <Icon size={22} color={color} />;
  };
  if (need.course) return <CourseIconTile code={need.course} icon={glyph} />;
  return <IconTile tone="brand" icon={glyph} />;
}

const NEED_ICON: Record<NeedDraft["kind"] | "edited", typeof Icons.Home> = {
  presence: Icons.Hand,
  task: Icons.ListChecks,
  edited: Icons.PenLine,
  exam: Icons.GraduationCap,
  attendance: Icons.CalendarCheck,
  meeting: Icons.Video,
  krs: Icons.ShieldCheck,
  bill: Icons.Wallet,
  class: Icons.Calendar,
};
