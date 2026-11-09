// "Perlu kamu urus" (round 2, v4; round 3): the two most pressing things, side by side, each a card in its course's tint
// that says what to do and by when, as the desktop's row does: "Kumpulkan Tugas 04" over "Jum 15:00–23:59", "Tugas 02"
// over "Tenggat besok 23:59". Edunex's hand in the corner when doing it counts for attendance (a Presence), never a
// chip; red with a warning sign once late. One card, one target: the item itself. The chevron opens the whole list,
// with what's put off and away, and everything Beranda leaves out (./needs-screen.tsx). Hidden when there's nothing.
// While the first read runs, the two cards stand in their shape and show once it's in: picked from half the data,
// they swapped under the Student's eyes (66% and 100% became 73% and 7 hari on the demo's first start).
import { router } from "expo-router";
import { useMemo } from "react";
import { View } from "react-native";
import type { TermCourse } from "../../../../src/app/courses";
import { useOpenExternal } from "../../../../src/app/hooks";
import { type Format, type Translate, useFormat, useNow, useT } from "../../../../src/app/i18n";
import { useDone, useSnoozes } from "../../../../src/app/snoozes";
import { rupiah } from "../../../../src/core/academic";
import { percent } from "../../../../src/core/attendance";
import { taskPutAway } from "../../../../src/core/done";
import { heldBack } from "../../../../src/core/held-back";
import type { NeedDraft } from "../../../../src/core/needs";
import { activeSnooze, snoozeKey } from "../../../../src/core/snooze";
import { useSettling } from "../../host/settling";
import { useNav } from "../../nav";
import { useFirstReadRunning } from "../../shell/source-status";
import { IconButton } from "../../ui/controls";
import { Skeleton } from "../../ui/display";
import { Rise } from "../../ui/expressive";
import { Icons } from "../../ui/icons";
import { factsLabel } from "../../ui/layout";
import { PressScale } from "../../ui/press";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { CourseGlyph, useCourseTile } from "../../ui/tile";
import { nameOf, shortName } from "./parts";
import { shortDay, shortWhen } from "./when";

interface UrusCard {
  need: NeedDraft;
  code: string | null;
  /** What to do, said as the desktop's row says it: "Kumpulkan Tugas 04", "Isi Presensi …", "UTS …", "Kirim KRS". */
  title: string;
  /** Its deadline in one short line: "Tutup Jum 23:59", "Tenggat besok 23:59", "Jum 15:00–23:59" (a window ahead). */
  when: string;
  /** Past its deadline, or a course whose target is out of reach: the line in red, with a warning icon. */
  late: boolean;
  /** Doing it counts for attendance (an Edunex Presence): an icon says so, never a chip. */
  presence: boolean;
  /** The course's whole name, for what TalkBack reads (the card shows its glyph and tint). */
  course: string;
}

/** A need as a card: the action and its deadline. Today's classes aren't (the now card and Nanti hari ini have them). */
function cardOf(t: Translate, f: Format, now: number, need: NeedDraft, courses: readonly TermCourse[]): UrusCard | null {
  const course = need.course ? nameOf(courses, need.course) : "";
  const base = { need, code: need.course ?? null, course, late: false, presence: false };
  switch (need.kind) {
    case "task": {
      const { task } = need;
      if (task.dueAt === null) return null;
      return { ...base, title: task.title, when: t("home.need.task.due", { when: shortWhen(f, task.dueAt) }), late: task.dueAt < now };
    }
    case "exam": {
      const closes = need.window && need.sitting.end !== null ? need.sitting.end : null;
      return {
        ...base,
        title: t("home.need.exam", { kind: t(`exam.kind.${need.exam.kind}`), course: shortName(course) }),
        when: closes !== null ? t("home.need.exam.closes", { when: shortWhen(f, closes) }) : shortWhen(f, need.sitting.start),
      };
    }
    case "presence": {
      const { session } = need;
      // What Edunex counts as present: handing in its Task, or the Presence itself.
      const title = need.task ? t("home.need.presenceAhead.assignment", { task: need.task.title }) : t("home.need.presence", { course: shortName(course) });
      // Open: when it closes. Ahead: its window, the day said once when it opens and closes on the same day.
      const when = need.open
        ? t("home.need.exam.closes", { when: shortWhen(f, session.closesAt) })
        : f.dayOffset(session.opensAt) === f.dayOffset(session.closesAt)
          ? `${shortDay(f, session.opensAt)}${f.timeRange(session.opensAt, session.closesAt)}`
          : `${shortWhen(f, session.opensAt)}–${shortWhen(f, session.closesAt)}`;
      return { ...base, title, when, presence: true, late: need.open && session.closesAt < now };
    }
    case "attendance":
      // The most it can still reach, never the share so far: "Maks 73%".
      return { ...base, title: shortName(course), when: t("mobile.needs.best", { best: percent(need.health.best ?? 0) }), late: true };
    case "meeting":
      return { ...base, title: shortName(course), when: `${t("mobile.home.kind.meeting")} · ${shortWhen(f, need.meeting.start)}` };
    case "krs":
      return {
        ...base,
        title: t("home.need.krs"),
        when: need.open ? t("home.need.exam.closes", { when: shortWhen(f, need.closesAt) }) : t("home.need.krs.opens", { date: shortWhen(f, need.at!) }),
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
    case "class":
      return null;
  }
}

export function Urus({ needs, due, courses }: { needs: readonly NeedDraft[]; due: readonly NeedDraft[]; courses: readonly TermCourse[] }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const v = useTheme().v4;
  const { entries } = useSnoozes();
  const { entries: handled } = useDone();
  const cards = useMemo(() => {
    const { shown } = heldBack(needs, due, entries, handled, now);
    // Today's deadlines first (Hari ini's on the desktop), unless put off or put away; then the week's, as ranked.
    const today = due.filter(
      (need) =>
        need.kind === "task" && !activeSnooze(snoozeKey(need), entries, now) && !taskPutAway(need.task, handled) && !shown.some((s) => s.id === need.id),
    );
    return [...today, ...shown]
      .map((need) => cardOf(t, f, now, need, courses))
      .filter((card): card is UrusCard => card !== null)
      .slice(0, 2);
  }, [needs, due, entries, handled, now, t, f, courses]);
  // The demo's first sync, or the Student's first read after a sign-in (the top bar's "Membaca …").
  const settling = useSettling();
  const firstReading = useFirstReadRunning();
  const reading = settling || firstReading;
  // Nothing to handle: the section's cards go, a single quiet line stays as the way to the whole list (what's put off,
  // the date and term, what changed).
  if (!cards.length && !reading)
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
      {reading ? (
        <View testID="section.needs.reading" accessibilityState={{ busy: true }} style={{ flexDirection: "row", gap: 10 }}>
          {[0, 1].map((i) => (
            <View key={i} style={{ flex: 1, height: CARD_HEIGHT, borderRadius: 20, backgroundColor: v.card, padding: space[4], gap: space[3] }}>
              <Skeleton height={22} width={22} style={{ borderRadius: 7 }} />
              <Skeleton height={16} width="85%" />
              <Skeleton height={14} width="60%" style={{ marginTop: "auto" }} />
            </View>
          ))}
        </View>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "stretch", gap: 10 }}>
          {cards.map((card, i) => (
            <Rise key={card.need.id} screen="home" index={3 + i} style={{ flex: 1 }}>
              <Card card={card} />
            </Rise>
          ))}
          {cards.length === 1 && <View style={{ flex: 1 }} />}
        </View>
      )}
    </View>
  );
}

/**
 * A card: the course's glyph on its tint, Edunex's hand when doing it counts for attendance, what to do (two lines at
 * most) and its deadline under it. Late: the deadline in red with a warning sign. One target: the item itself.
 */
function Card({ card }: { card: UrusCard }) {
  const t = useT();
  const v = useTheme().v4;
  const { ink, tint } = useCourseTile()(card.code);
  const { go } = useNav();
  const open = useOpenExternal();
  const { need } = card;
  const color = card.late ? v.redFg : ink;
  const spoken = factsLabel(
    card.title,
    need.kind === "task" || need.kind === "presence" ? card.course : null,
    card.when,
    card.presence && t("mobile.home.countsPresence"),
  );
  return (
    <PressScale
      onPress={() => (need.action.kind === "go" ? go(need.action.route) : open(need.action.url))}
      accessibilityLabel={spoken}
      testID={`card.need.${need.id}`}
      style={{ flex: 1, backgroundColor: tint, borderRadius: 20, padding: 14, minHeight: CARD_HEIGHT }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        {card.code ? <CourseGlyph code={card.code} name={card.course} /> : <Icons.ListChecks size={22} color={ink} />}
        {card.presence && (
          <View testID={`card.need.${need.id}.presence`}>
            <Icons.Hand size={20} color={ink} />
          </View>
        )}
      </View>
      <Text size="bodyLarge" face="display" weight="bold" numberOfLines={2} style={{ color: v.fg, marginTop: space[3], lineHeight: 21 }}>
        {card.title}
      </Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[1], marginTop: "auto", paddingTop: space[2] }}>
        {card.late && <Icons.AlertTriangle size={14} weight="bold" color={color} />}
        <Text size="bodyMedium" weight="semibold" tabular numberOfLines={1} style={{ color, flexShrink: 1 }}>
          {card.when}
        </Text>
      </View>
    </PressScale>
  );
}

/** A card's height, whatever it holds: two lines of title and the deadline (and the stand-in's while reading). */
const CARD_HEIGHT = 124;
