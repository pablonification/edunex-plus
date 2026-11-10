// A course's attendance on its page: in the header under the bar (beside the course's glyph), its code and SKS, then
// its absences as Kuliah's row says them (dots and one short label: "sisa 1 absen", "absen habis", "lewat 1 absen"; never a count
// beside them) and the one exception when it's a fact. The header is one
// target: the course's sheet (./course-sheet.tsx) says it all, the count, the target, the exception's whole sentence,
// the advice and its way back too. Words and figures are the desktop's (src/app/screens/presence.tsx).
import type { ReactNode } from "react";
import { View } from "react-native";
import type { CourseAttendance } from "../../../../src/app/attendance";
import { useActionLabel } from "../../../../src/app/attendance-labels";
import { useFormat, useT } from "../../../../src/app/i18n";
import { useCourseNames } from "../../../../src/app/schedule-data";
import { isExamActivity, onUsualSlot, percent } from "../../../../src/core/attendance";
import { checkingIn } from "../../../../src/core/check-in";
import { wibDay } from "../../../../src/core/course-meetings";
import { meterModel } from "../../parts/attendance-meter";
import { Icons } from "../../ui/icons";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { shortName } from "../home/parts";
import { AbsenceDots, absenceShort } from "../presence/absence-dots";
import { classOf, dayLabel, GONE_FOR, type RowContext, uncertainText, windowWhen } from "../presence/logic";

/**
 * The course's attendance under its name (round 3): the meter (parts/attendance-meter.tsx) with its one word, and an ⓘ
 * saying the header opens the course's sheet, where the share, the count, the target and any advice ("Cek ke dosen")
 * are. Under it, the one exception only when it's a fact with a date or a deadline ("Kuliah Kam 15 Okt mungkin tak
 * ada", "Presensi Edunex …"); a clash is on the next class's row, advice is in the sheet.
 * `label`: the whole of it for a screen reader, the share and the target too.
 */
export function useAttendanceLine(
  item: CourseAttendance | undefined,
  context: RowContext | undefined,
  /** What leads the line ("3 SKS"), before the absences. */
  lead: string | null = null,
): { node: ReactNode; label: string } | null {
  const t = useT();
  const v = useTheme().v4;
  const found = useCourseException(item, context);
  if (!item || !context || context.signedOut) return null;
  const { health } = item;
  const meter = meterModel(t, item, context.soFar);
  // Tandai Hadir not out yet isn't said here: the now card under the header is that class, with its button.
  const exception = found && SHOWN.has(found.kind) && !(found.kind === "clash" && (item.clash?.session.start ?? 0) > context.now) ? found : null;
  const advice = found && !exception && found.kind !== "watching" ? found : null;
  if (!meter && !exception && !advice) return null;
  const held = health.held ?? 0;
  const share = held > 0 ? percent(health.attended ?? 0, held) : null;
  const over = health.state === "met" || health.state === "missed";
  const count = share === null || over ? null : t("presence.row.count", { attended: health.attended ?? 0, held, percent: share });
  const label = [meter?.label, count, share !== null && !over ? t("presence.row.ownTarget", { value: health.target }) : null, exception?.short ?? advice?.short]
    .filter(Boolean)
    .join(". ");
  // As Kuliah's row says it (../presence/absence-dots.tsx): the dots and one short label, nothing else.
  const node = (
    <View style={{ gap: 2 }}>
      {lead && (
        <Text size="bodyMedium" weight="medium" tabular style={{ color: v.fg2 }}>
          {lead}
        </Text>
      )}
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space[2] }}>
        {meter && <AbsenceDots model={meter} label={absenceShort(t, meter)} testID="meter.courseAttendance" />}
        {/* Advice waits in the sheet the header opens: a filled mark says there is some. */}
        {advice && (
          <View testID="mark.courseAdvice">
            <Icons.Info size={16} weight="fill" color={v.fg2} />
          </View>
        )}
      </View>
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

/** The exceptions said under the meter: facts with a date or a deadline. Advice ("Cek ke dosen", a lab's rules) is in the sheet. */
const SHOWN: ReadonlySet<CourseExceptionNote["kind"]> = new Set(["gone", "needed", "clash", "window", "uncertain"]);

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
  // A clash has its own icon everywhere (Jadwal's blocks and strip, the next class's row).
  if (exception.kind === "clash") return <Icons.Overlap size={size} weight="bold" color={color} />;
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
  const name = useCourseNames();
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
      return { kind: "watching", short: t("mobile.course.ex.waiting"), text: `${t("presence.row.watching")}. ${t("presence.row.watchingWhy")}`, tone: "muted" };
    if (recent) return { kind: "gone", short: t("mobile.course.ex.gone"), text: `${t("presence.row.gone")}. ${t("presence.row.goneWhy")}`, tone: "muted" };
  }
  // 3. Out of reach or finished below: a count SIX got wrong, or a wrong target, is the way back.
  if ((health.state === "out" || health.state === "missed") && !zone.results.some((r) => r.code === course.code && r.absent))
    return { kind: "uncounted", short: t("presence.row.askLecturer"), text: t("presence.warn.out"), tone: "muted" };
  // 4. No absences left, and the target hangs on a class that may not run.
  const needed = health.needsUncertain ? health.left.upcoming.find((m) => m.uncertain) : undefined;
  if (needed)
    return {
      kind: "needed",
      short: t("mobile.course.ex.needed", { date: dayLabel(f, needed.start) }),
      text: uncertainText(t, f, needed.start, context.events, health.target),
      tone: "warning",
    };
  // 5. The next class clashes with another course's (on the page, its next class's row says it; the sheet says it whole).
  const clash = item.clash;
  if (clash) {
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
    return { kind: "clash", short: t("mobile.course.ex.clash", { course: shortName(name(clash.other)) }), text: `${head} ${tail}`, tone: "warning" };
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
  // 8. The next class may not run (exam week, holiday).
  const first = health.left.upcoming[0];
  if (first?.uncertain)
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
