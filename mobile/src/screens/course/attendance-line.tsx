// A course's attendance on its page (round 2, v4; judge round 3): one line under the course's title, the share
// attended and what's left of the absences ("85% hadir · Sisa 1×"), and the one exception in a few words. The header
// is one target: the course's sheet (./course-sheet.tsx) says it all, the count, the target, the exception's whole
// sentence and its way back too. Kuliah's row (src/screens/presence/course-row.tsx) uses budgetChip.
// Words and figures are the desktop's (src/app/screens/presence.tsx's CourseRow and Exception).
import type { ReactNode } from "react";
import { View } from "react-native";
import type { CourseAttendance } from "../../../../src/app/attendance";
import { budgetLabel, budgetWords, useActionLabel } from "../../../../src/app/attendance-labels";
import { useFormat, useT } from "../../../../src/app/i18n";
import { isExamActivity, onUsualSlot, type PresenceGroup, percent, presenceGroup } from "../../../../src/core/attendance";
import { checkingIn } from "../../../../src/core/check-in";
import { wibDay } from "../../../../src/core/course-meetings";
import { type AbsenceTone, absenceInk, absenceName, absenceTone } from "../../ui/absence";
import { Icons } from "../../ui/icons";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { classOf, dayLabel, GONE_FOR, type RowContext, sideText, uncertainText, windowWhen } from "../presence/logic";

/** The chip's tone: the app's absence scale (src/ui/absence.ts), grey before SIX has a count. */
export type BudgetTone = AbsenceTone | "neutral";

/**
 * The chip's few words ("Sisa 1×", "Jatah habis", "Lewat batas 1×"), its tone, and the whole sentence for a screen reader.
 * None left and over the limit go by their one name on every tab (absenceName); the rest by the desktop's bar.
 */
export function budgetChip(t: ReturnType<typeof useT>, group: PresenceGroup, health: CourseAttendance["health"], context: RowContext) {
  if (context.signedOut) return null;
  const tone: BudgetTone = absenceTone(health.state) ?? "neutral";
  if (group === "out" || group === "none" || group === "spare" || group === "unknown") {
    const words = budgetWords(t, health, context.soFar);
    if (!words) return null;
    const text = absenceName(t, health) ?? words.bold.charAt(0).toLocaleUpperCase() + words.bold.slice(1);
    return { text, tone, label: budgetLabel(t, health) };
  }
  const text = sideText(t, group, health);
  if (!text) return null;
  return { text, tone: group === "missed" || group === "met" ? tone : "neutral", label: text };
}

/**
 * The course's attendance as one line under its title, "85% hadir · Sisa 1×" (judge round 3: no card of its own): the
 * share so far (red once the target is out of reach, amber with no absences left), then the chip's few words in their
 * tone; the one exception in a few words under it, if any. The next class is the row under the header (./now.tsx).
 * `label`: the whole of it for a screen reader, the count and the target too (the course's sheet shows them).
 */
export function useAttendanceLine(item: CourseAttendance | undefined, context: RowContext | undefined): { node: ReactNode; label: string } | null {
  const t = useT();
  const v = useTheme().v4;
  const found = useCourseException(item, context);
  if (!item || !context) return null;
  const { health } = item;
  const chip = budgetChip(t, presenceGroup(health, context.signedOut), health, context);
  // Tandai Hadir not out yet isn't said here: the now card under the header is that class, with its button.
  const exception = found?.kind === "watching" ? null : found;
  const held = health.held ?? 0;
  const share = held > 0 ? percent(health.attended ?? 0, held) : null;
  if (share === null && !chip && !exception) return null;
  const over = health.state === "met" || health.state === "missed";
  const count =
    share === null
      ? null
      : over
        ? t("presence.row.final", { percent: share })
        : t("presence.row.count", { attended: health.attended ?? 0, held, percent: share });
  const tone = absenceTone(health.state);
  const shareColor = tone === "red" || tone === "amber" ? absenceInk(v, tone).fg : v.fg2;
  const chipColor = !chip || chip.tone === "neutral" ? v.muted : absenceInk(v, chip.tone).fg;
  const label = [count, share !== null ? t("presence.row.ownTarget", { value: health.target }) : null, chip?.label, exception?.short]
    .filter(Boolean)
    .join(". ");
  const node = (
    <View style={{ marginTop: space[2], gap: space[1] }}>
      {(share !== null || chip) && (
        <Text testID="meter.courseAttendance" size="bodyMedium" weight="semibold" tabular numberOfLines={1}>
          {share !== null ? <Text style={{ color: shareColor }}>{t("mobile.course.attended", { percent: share })}</Text> : null}
          {share !== null && chip ? <Text style={{ color: v.muted }}>{" · "}</Text> : null}
          {chip ? (
            <Text testID="line.courseBudget" style={{ color: chipColor }}>
              {chip.text}
            </Text>
          ) : null}
        </Text>
      )}
      {exception && (
        <View testID="note.courseException" style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          <ExceptionIcon exception={exception} size={14} />
          <Text size="bodyMedium" numberOfLines={1} style={{ color: exception.tone === "warning" ? v.ambFg : v.muted, flex: 1 }}>
            {exception.short}
          </Text>
        </View>
      )}
    </View>
  );
  return { node, label };
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
export function useCourseException(item: CourseAttendance | undefined, context: RowContext | undefined): CourseExceptionNote | null {
  const t = useT();
  const f = useFormat();
  const actionLabel = useActionLabel();
  if (!item || !context) return null;
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
