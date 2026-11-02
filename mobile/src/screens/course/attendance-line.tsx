// A course's attendance on its page (round 2, v4): one white card led by the share attended as a big number (the
// count and the target under it), then W4's row (what's left of the absences as a chip, the next class beside it) and
// the one exception in a few words. The card is one target: the course's sheet (./course-sheet.tsx) says it all, the
// exception's whole sentence and its way back too. Kuliah's row (src/screens/presence/course-row.tsx) uses budgetChip.
// Words and figures are the desktop's (src/app/screens/presence.tsx's CourseRow and Exception).
import { View } from "react-native";
import type { CourseAttendance } from "../../../../src/app/attendance";
import { budgetLabel, budgetWords, useActionLabel } from "../../../../src/app/attendance-labels";
import { type Format, type Translate, useFormat, useT } from "../../../../src/app/i18n";
import { firstUnreadDay, isExamActivity, onUsualSlot, type PresenceGroup, percent, presenceGroup } from "../../../../src/core/attendance";
import { checkingIn } from "../../../../src/core/check-in";
import { wibDay } from "../../../../src/core/course-meetings";
import { dayNoon } from "../../../../src/core/schedule";
import { type AbsenceTone, absenceInk, absenceTone } from "../../ui/absence";
import { CountUp } from "../../ui/expressive";
import { Icons } from "../../ui/icons";
import { PressScale } from "../../ui/press";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { StatusChip } from "../../ui/v4-list";
import { useCardStyle } from "../home/now";
import { classOf, dayLabel, GONE_FOR, type RowContext, sideText, uncertainText, windowWhen } from "../presence/logic";

/** The chip's tone: the app's absence scale (src/ui/absence.ts), grey before SIX has a count. */
export type BudgetTone = AbsenceTone | "neutral";

/** The chip's few words ("Sisa 1×", "Habis", "Lewat batas 1×"), its tone, and the whole sentence for a screen reader. */
export function budgetChip(t: ReturnType<typeof useT>, group: PresenceGroup, health: CourseAttendance["health"], context: RowContext) {
  if (context.signedOut) return null;
  const tone: BudgetTone = absenceTone(health.state) ?? "neutral";
  if (group === "out" || group === "none" || group === "spare" || group === "unknown") {
    const words = budgetWords(t, health, context.soFar);
    if (!words) return null;
    return { text: words.bold.charAt(0).toLocaleUpperCase() + words.bold.slice(1), tone, label: budgetLabel(t, health) };
  }
  const text = sideText(t, group, health);
  if (!text) return null;
  return { text, tone: group === "missed" || group === "met" ? tone : "neutral", label: text };
}

/**
 * The next class, short: "Hari ini, 16:00–17:50 · 9134"; a class the app couldn't read first. One on now isn't said:
 * the now card under the attendance card is that class.
 */
export function nextClassParts(t: Translate, f: Format, item: CourseAttendance, context: RowContext): { parts: string[]; start: number | null } {
  if (context.signedOut) return { parts: [], start: null };
  const at = classOf(item, context);
  if (at?.live) return { parts: [], start: null };
  const unreadDay = firstUnreadDay(context.unread, context.schedule, context.now, at?.start ?? null, item.course.code);
  if (unreadDay) return { parts: [t("home.now.unread", { day: f.relativeDay(dayNoon(unreadDay)) })], start: null };
  if (!at) return { parts: [], start: null };
  const time = at.session ? f.timeRange(at.session.start, at.session.end) : f.time(at.start);
  return { parts: [`${f.relativeDay(at.start)}, ${time}`, at.session?.room ?? ""].filter(Boolean), start: at.start };
}

/**
 * The course's attendance card: the share so far as the one big number (red once the target is out of reach, amber
 * with no absences left), "2 dari 6 · target 80%" under it; then the chip and the next class in one row; then the one
 * exception in a few words. A tap opens the course's sheet.
 */
export function AttendanceCard({ item, context, onOpen }: { item: CourseAttendance; context: RowContext; onOpen: () => void }) {
  const t = useT();
  const f = useFormat();
  const v = useTheme().v4;
  const surface = useCardStyle();
  const { health, course } = item;
  const chip = budgetChip(t, presenceGroup(health, context.signedOut), health, context);
  const next = nextClassParts(t, f, item, context).parts;
  // Tandai Hadir not out yet isn't said here: the now card under this one is that class, with its button.
  const found = useCourseException(item, context);
  const exception = found?.kind === "watching" ? null : found;
  const held = health.held ?? 0;
  const share = held > 0 ? percent(health.attended ?? 0, held) : null;
  const over = health.state === "met" || health.state === "missed";
  if (share === null && !chip && !next.length && !exception) return null;
  const count =
    share === null
      ? null
      : over
        ? t("presence.row.final", { percent: share })
        : t("presence.row.count", { attended: health.attended ?? 0, held, percent: share });
  // Red once the target is out of reach, amber with no absences left (src/ui/absence.ts); plain while there are some.
  const tone = absenceTone(health.state);
  const color = tone === "red" || tone === "amber" ? absenceInk(v, tone).fg : v.fg;
  const label = [count, share !== null ? t("presence.row.ownTarget", { value: health.target }) : null, chip?.label, next.join(", "), exception?.short]
    .filter(Boolean)
    .join(". ");
  return (
    <PressScale
      onPress={onOpen}
      accessibilityLabel={label}
      accessibilityHint={t("mobile.course.cardHint")}
      testID="meter.courseAttendance"
      style={[surface, { padding: space[4], gap: space[3] }]}
    >
      {share !== null && (
        <View>
          <View style={{ flexDirection: "row", alignItems: "baseline" }}>
            <CountUp
              id={`course:${course.code}:share`}
              value={share}
              style={{ color, fontFamily: "PlusJakartaSans-ExtraBold", fontSize: 40, lineHeight: 46, letterSpacing: -1, fontVariant: ["tabular-nums"] }}
            />
            <Text size="titleLarge" face="display" weight="bold" style={{ color, fontSize: 20 }}>
              %
            </Text>
          </View>
          <Text size="bodyMedium" tabular style={{ color: v.muted }}>
            {t("mobile.course.share", { attended: health.attended ?? 0, held, target: health.target })}
          </Text>
        </View>
      )}
      {(chip || next.length > 0) && (
        <View
          testID="line.courseBudget"
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: space[3],
            ...(share !== null ? { borderTopWidth: 1, borderTopColor: v.line, paddingTop: space[3] } : {}),
          }}
        >
          {chip && <StatusChip tone={chip.tone}>{chip.text}</StatusChip>}
          {next.length > 0 && (
            <Text size="bodyMedium" weight="medium" tabular style={{ color: v.fg2, flex: 1 }}>
              {next.join(" · ")}
            </Text>
          )}
        </View>
      )}
      {exception && (
        <View testID="note.courseException" style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <ExceptionIcon exception={exception} size={16} />
          <Text size="bodyMedium" style={{ color: exception.tone === "warning" ? v.ambFg : v.muted, flex: 1 }}>
            {exception.short}
          </Text>
        </View>
      )}
    </PressScale>
  );
}

export interface CourseExceptionNote {
  kind: "watching" | "gone" | "uncounted" | "needed" | "clash" | "window" | "uncertain" | "lab";
  /** On the card: a few words. */
  short: string;
  /** In the sheet: the whole of it. */
  text: string;
  tone: "muted" | "warning";
}

export function ExceptionIcon({ exception, size }: { exception: CourseExceptionNote; size: number }) {
  const theme = useTheme();
  const color = exception.tone === "warning" ? theme.v4.ambFg : theme.v4.muted;
  if (exception.kind === "watching" || exception.kind === "gone") return <Icons.Hand size={size} color={color} />;
  if (exception.tone === "warning") return <Icons.AlertTriangle size={size} weight="bold" color={color} />;
  return <Icons.Info size={size} color={color} />;
}

/**
 * One exception at most, the first that applies: Tandai Hadir watched for the class on now; gone from SIX ("did it go
 * through?"); out of reach or finished below, with the fix; the target hanging on a class that may not run; a clash
 * with which to go to; what the next class's Edunex window asks; that the next class may not run; a lab's own rules.
 */
export function useCourseException(item: CourseAttendance, context: RowContext): CourseExceptionNote | null {
  const t = useT();
  const f = useFormat();
  const actionLabel = useActionLabel();
  const { course, health, nextWindow } = item;
  const { now, student, checkIns, zone } = context;
  if (context.signedOut) return null;
  const at = classOf(item, context);
  const counts = health.countedIn === "six" || health.countedIn === "both" || health.countedIn === "unknown";
  // 1–2. Tandai Hadir for the class on now (or one that ended within the hour).
  if (student && counts) {
    const recent = context.schedule.find(
      (s) => s.courseCode === course.code && !isExamActivity(s.activity) && s.start <= now && now < s.end + GONE_FOR && checkIns[s.id]?.state === "gone",
    );
    if (at?.live && at.session && checkingIn(at.session, now) && (checkIns[at.session.id]?.state ?? "waiting") === "waiting")
      return { kind: "watching", short: t("mobile.course.ex.waiting"), text: t("presence.row.watching"), tone: "muted" };
    if (recent) return { kind: "gone", short: t("mobile.course.ex.gone"), text: t("presence.row.gone"), tone: "muted" };
  }
  // 3. Out of reach or finished below: a count SIX got wrong, or a wrong target, is the way back.
  if ((health.state === "out" || health.state === "missed") && !zone.results.some((r) => r.code === course.code && r.absent))
    return { kind: "uncounted", short: t("mobile.course.ex.uncounted"), text: t("presence.warn.out"), tone: "muted" };
  // 4. No absences left, and the target hangs on a class that may not run.
  const needed = health.needsUncertain ? health.left.upcoming.find((m) => m.uncertain) : undefined;
  if (needed)
    return {
      kind: "needed",
      short: t("mobile.course.ex.needed", { date: dayLabel(f, needed.start) }),
      text: uncertainText(t, f, needed.start, context.events, health.target),
      tone: "warning",
    };
  // 5. The next class clashes with another course's (unless today's clash card says it).
  const clash = item.clash;
  const onCard = zone.clashes.some((c) => c.a.course.code === course.code || c.b.course.code === course.code);
  if (clash && !onCard) {
    const mine = context.schedule.filter((s) => s.courseCode === course.code);
    const theirs = context.schedule.filter((s) => s.courseCode === clash.other);
    const time = f.timeRange(clash.from, clash.to);
    const head =
      onUsualSlot(clash.session, mine) && onUsualSlot(clash.with, theirs)
        ? t("presence.row.clashEvery", { code: clash.other, weekday: f.weekday(clash.from), time })
        : t("presence.row.clashOn", { code: clash.other, day: dayLabel(f, clash.from), time });
    const tail =
      clash.pick.pick === course.code
        ? t("presence.row.clashPicked")
        : clash.pick.pick === clash.other
          ? t("presence.row.clashOther", { code: clash.other })
          : t("presence.row.clashAsk");
    return { kind: "clash", short: t("mobile.course.ex.clash", { code: clash.other }), text: `${head} ${tail}`, tone: "warning" };
  }
  // 6–7. What the next class's Edunex window asks, where Edunex keeps the count too.
  const next = health.left.next;
  if (nextWindow && (nextWindow.action.activity !== "course" || health.countedIn === "edunex")) {
    const label = actionLabel(nextWindow);
    const time = f.time(nextWindow.session.closesAt);
    const short = t("presence.row.window", { when: windowWhen(t, f, nextWindow) });
    if (health.countedIn === "both" && nextWindow.action.activity !== "course" && next && wibDay(nextWindow.session.opensAt) === wibDay(next.start))
      return { kind: "window", short, text: t("presence.record.bothDo", { action: label.charAt(0).toLowerCase() + label.slice(1), time }), tone: "muted" };
    if (health.countedIn === "edunex") {
      const assignment = nextWindow.action.activity === "assignment";
      return {
        kind: "window",
        short,
        text: t("presence.row.windowDo", {
          when: assignment ? dayLabel(f, nextWindow.session.closesAt) : windowWhen(t, f, nextWindow),
          action: assignment ? t("presence.row.byTime", { action: label, time }) : label,
        }),
        tone: "muted",
      };
    }
  }
  // 8. The next class may not run (exam week, holiday), unless the note on top says it for every course.
  const first = health.left.upcoming[0];
  if (first?.uncertain && !(zone.week?.codes.includes(course.code) ?? false))
    return {
      kind: "uncertain",
      short: t("mobile.course.ex.uncertain", { date: dayLabel(f, first.start) }),
      text: uncertainText(t, f, first.start, context.events),
      tone: "warning",
    };
  // 9. A lab next, in a course that also has lectures.
  if (
    at?.session &&
    /praktikum|tutorial/i.test(at.session.activity) &&
    context.schedule.some((s) => s.courseCode === course.code && /^kuliah$/i.test(s.activity))
  )
    return { kind: "lab", short: t("mobile.course.ex.lab"), text: t("presence.row.lab"), tone: "muted" };
  return null;
}
