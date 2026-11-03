// "Perlu kamu urus" (round 2, v4): the two most pressing things, side by side, each a card in its course's tint led by
// a big countdown ("7 hari"; hours under a day, minutes under an hour; red and "lewat" once past), with the course's
// glyph, its kind in a pill and its title. One card, one target: the item itself. The chevron opens the whole list,
// with what's put off and away, and everything Beranda leaves out (./needs-screen.tsx). Hidden when there's nothing.
// While the first read runs, the two cards stand in their shape and show once it's in: picked from half the data,
// they swapped under the Student's eyes (66% and 100% became 73% and 7 hari on the demo's first start).
import { router } from "expo-router";
import { useMemo } from "react";
import { View } from "react-native";
import type { TermCourse } from "../../../../src/app/courses";
import { useOpenExternal } from "../../../../src/app/hooks";
import { type Translate, useNow, useT } from "../../../../src/app/i18n";
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
import { CountUp, Rise } from "../../ui/expressive";
import { Icons } from "../../ui/icons";
import { PressScale } from "../../ui/press";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { CourseGlyph, useCourseTile } from "../../ui/tile";
import { DAY, MINUTE, nameOf, shortName } from "./parts";

const HOUR = 60 * MINUTE;

interface UrusCard {
  need: NeedDraft;
  code: string | null;
  kind: string;
  title: string;
  /** The big figure: a countdown to `at` (or since, when past), or the best attendance a course can still reach. */
  figure: { at: number } | { percent: number };
}

/** A need as a card: its kind, title, and the moment it counts down to (or its percent). Today's classes aren't. */
function cardOf(t: Translate, need: NeedDraft, courses: readonly TermCourse[]): UrusCard | null {
  const course = need.course ? nameOf(courses, need.course) : "";
  const base = { need, code: need.course ?? null };
  switch (need.kind) {
    case "task":
      return need.task.dueAt === null ? null : { ...base, kind: t("mobile.home.kind.task"), title: need.task.title, figure: { at: need.task.dueAt } };
    case "exam": {
      const closes = need.window && need.sitting.end !== null ? need.sitting.end : null;
      return { ...base, kind: t(`exam.kind.${need.exam.kind}`), title: course, figure: { at: closes ?? need.sitting.start } };
    }
    case "presence":
      return { ...base, kind: t("mobile.home.kind.presence"), title: course, figure: { at: need.open ? need.session.closesAt : need.session.opensAt } };
    case "attendance":
      // The most it can still reach, never the share so far (the class sheet's "Kehadiran 33%"): "73% maks" (Card).
      return { ...base, kind: t("mobile.home.kind.attendance"), title: course, figure: { percent: percent(need.health.best ?? 0) } };
    case "meeting":
      return { ...base, kind: t("mobile.home.kind.meeting"), title: course, figure: { at: need.meeting.start } };
    case "krs":
      return { ...base, kind: t("mobile.home.kind.krs"), title: t("home.need.krs"), figure: { at: need.open ? need.closesAt : need.at! } };
    case "bill":
      return need.bill.nextDueAt === null
        ? null
        : {
            ...base,
            kind: t("mobile.home.kind.bill"),
            title: t("home.need.bill", { amount: rupiah(Math.max(0, (need.bill.amount ?? 0) - (need.bill.paid ?? 0))) }),
            figure: { at: need.bill.nextDueAt },
          };
    case "class":
      return null;
  }
}

/** How far off `at` is, in its biggest whole unit, and whether it's past. */
function distance(now: number, at: number): { value: number; unit: "minute" | "hour" | "day"; late: boolean } {
  const gap = Math.abs(at - now);
  const late = at < now;
  if (gap < HOUR) return { value: Math.max(1, Math.floor(gap / MINUTE)), unit: "minute", late };
  if (gap < DAY) return { value: Math.floor(gap / HOUR), unit: "hour", late };
  return { value: Math.floor(gap / DAY), unit: "day", late };
}

export function Urus({ needs, due, courses }: { needs: readonly NeedDraft[]; due: readonly NeedDraft[]; courses: readonly TermCourse[] }) {
  const t = useT();
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
      .map((need) => cardOf(t, need, courses))
      .filter((card): card is UrusCard => card !== null)
      .slice(0, 2);
  }, [needs, due, entries, handled, now, t, courses]);
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
            <View key={i} style={{ flex: 1, height: 148, borderRadius: 20, backgroundColor: v.card, padding: space[4], gap: space[3] }}>
              <Skeleton height={22} width={22} style={{ borderRadius: 7 }} />
              <Skeleton height={36} width="45%" />
              <Skeleton height={14} width="80%" />
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

function Card({ card }: { card: UrusCard }) {
  const t = useT();
  const now = useNow();
  const v = useTheme().v4;
  const { ink, tint } = useCourseTile()(card.code);
  const { go } = useNav();
  const open = useOpenExternal();
  const { need } = card;
  const away = "at" in card.figure ? distance(now, card.figure.at) : null;
  const red = (away?.late ?? false) || need.kind === "attendance";
  const color = red ? v.redFg : ink;
  const value = "percent" in card.figure ? card.figure.percent : (away?.value ?? 0);
  const unit = "percent" in card.figure ? "%" : t(`mobile.home.unit.${away!.unit}`, { count: away!.value });
  // What the figure is when it isn't plain: past ("lewat"), or a percent that's the best case ("maks", as "Maks 73%" in
  // Perlu kamu urus), so it never reads as the attendance so far.
  const tail = away?.late ? t("mobile.home.late") : "percent" in card.figure ? t("mobile.home.atMost") : null;
  const spoken = "percent" in card.figure ? t("mobile.needs.best", { best: value }) : `${value} ${unit}${tail ? ` ${tail}` : ""}`;
  const said = card.title.toLocaleLowerCase().includes(card.kind.toLocaleLowerCase());
  return (
    <PressScale
      onPress={() => (need.action.kind === "go" ? go(need.action.route) : open(need.action.url))}
      accessibilityLabel={[card.kind, card.title, spoken].join(", ")}
      testID={`card.need.${need.id}`}
      style={{ flex: 1, backgroundColor: tint, borderRadius: 20, padding: 14, minHeight: 148 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        {card.code ? <CourseGlyph code={card.code} name={card.title} /> : <Icons.ListChecks size={22} color={ink} />}
        {/* The kind once: a Task named "Tugas 02" needs no "Tugas" pill over it. */}
        {!said && (
          <View style={{ backgroundColor: v.card, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 }}>
            <Text size="labelMedium" weight="semibold" style={{ color: ink }}>
              {card.kind}
            </Text>
          </View>
        )}
      </View>
      <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: 14 }}>
        <CountUp
          id={`need:${need.id}`}
          value={value}
          style={{ color, fontFamily: "PlusJakartaSans-ExtraBold", fontSize: 36, letterSpacing: -1, fontVariant: ["tabular-nums"] }}
        />
        <Text size="bodyLarge" face="display" weight="semibold" style={{ color, fontSize: 15, marginLeft: unit === "%" ? 0 : 4 }}>
          {unit}
        </Text>
        {tail && (
          <Text size="bodyMedium" face="display" weight="semibold" style={{ color, marginLeft: 4 }}>
            {tail}
          </Text>
        )}
      </View>
      <Text size="bodyMedium" weight="medium" style={{ color: v.fg, marginTop: "auto", paddingTop: 10 }}>
        {shortName(card.title)}
      </Text>
    </PressScale>
  );
}
