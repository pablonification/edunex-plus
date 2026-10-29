// A course on Presensi (src/app/screens/presence.tsx's CourseRow): the course and its next class,
// then SIX's share labeled over its absences as a bar with words ("Kehadiran 85% sejauh ini (6 dari
// 7)", "Jatah absen", "Terpakai 1× · sisa 1×"), and one exception at most on a line of its own. On
// the phone it's one column: the row opens the course's meetings, and the exception's own actions
// ("Buka jadwal di SIX", "Ubah target") sit under it, outside the row's target.
import type { ReactNode } from "react";
import { Pressable, View } from "react-native";
import type { CourseAttendance } from "../../../../src/app/attendance";
import { budgetWords, useActionLabel } from "../../../../src/app/attendance-labels";
import { useOpenExternal } from "../../../../src/app/hooks";
import { useFormat, useT } from "../../../../src/app/i18n";
import { useCourseNames } from "../../../../src/app/schedule-data";
import { isExamActivity, onUsualSlot, type PresenceGroup, percent } from "../../../../src/core/attendance";
import { checkingIn } from "../../../../src/core/check-in";
import { wibDay } from "../../../../src/core/course-meetings";
import { sixTimetableUrl } from "../../../../src/core/links";
import { useNav } from "../../nav";
import { AbsenceBudget } from "../../parts/attendance";
import { CourseCode } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { Meta } from "../../ui/layout";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { classOf, dayLabel, GONE_FOR, metaParts, type RowContext, sideText, uncertainText, windowWhen } from "./logic";

export function CourseRow({ item, group, context }: { item: CourseAttendance; group: PresenceGroup; context: RowContext }) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const { go } = useNav();
  const name = useCourseNames();
  const { course, health } = item;
  const meta = metaParts(t, f, item, context);
  const words = context.signedOut ? null : budgetWords(t, health, context.soFar);
  const own = Object.hasOwn(context.own, course.code);
  const label = [
    `${course.code} ${name(course.code, course.name)}`,
    words ? t("presence.bar.label") : "",
    words?.lead ?? "",
    words?.bold ?? "",
    words && own ? t("presence.row.ownTarget", { value: health.target }) : "",
    words && health.held
      ? t("presence.row.count", { attended: health.attended ?? 0, held: health.held, percent: percent(health.attended ?? 0, health.held) })
      : "",
    !words ? sideText(t, group, health) : "",
    ...meta,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <View>
      <Pressable
        testID={`row.presence.${course.code}`}
        onPress={() => go({ screen: "course", code: course.code, tab: "meetings" })}
        accessibilityRole="button"
        accessibilityLabel={label}
        android_ripple={{ color: theme.color.selected }}
        style={{ padding: space[4], flexDirection: "row", gap: space[2] }}
      >
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[2] }}>
            {/* Level with the name's first line. */}
            <View style={{ paddingTop: 2 }}>
              <CourseCode code={course.code} color={course.color} />
            </View>
            <Text size="body" weight="semibold" numberOfLines={2} style={{ flex: 1 }}>
              {name(course.code, course.name)}
            </Text>
          </View>
          {meta.length > 0 && (
            <View style={{ marginTop: space[1] }}>
              <Meta>{meta}</Meta>
            </View>
          )}
          <Side item={item} group={group} own={own} soFar={context.soFar} signedOut={context.signedOut} />
        </View>
        <View style={{ paddingTop: 2 }}>
          <Icons.ChevronRight size={16} color={theme.color.faint} />
        </View>
      </Pressable>
      <Exception item={item} context={context} />
    </View>
  );
}

/** The row's end: the absences, Edunex's own tally, or how it finished. */
function Side({ item, group, own, soFar, signedOut }: { item: CourseAttendance; group: PresenceGroup; own: boolean; soFar: boolean; signedOut: boolean }) {
  const t = useT();
  const { health } = item;
  if (signedOut) return null;
  if (group === "out" || group === "none" || group === "spare" || group === "unknown")
    return (
      <View style={{ marginTop: space[2.5] }}>
        <AbsenceBudget health={health} place="row" own={own} soFar={soFar} />
      </View>
    );
  const text = sideText(t, group, health);
  if (!text) return null;
  return (
    <Text size="small" weight={group === "missed" ? "semibold" : "regular"} tone={group === "missed" ? "danger" : "muted"} style={{ marginTop: space[2.5] }}>
      {text}
    </Text>
  );
}

/**
 * One exception at most, the first that applies: Tandai Hadir watched for the class on now; gone
 * from SIX ("did it go through?"); out of reach or finished below, with the fix; the target hanging
 * on a class that may not run; a clash with which to go to; what the next class's Edunex window
 * asks; that the next class may not run; a lab's own rules.
 */
function Exception({ item, context }: { item: CourseAttendance; context: RowContext }) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const open = useOpenExternal();
  const actionLabel = useActionLabel();
  const { course, health, nextWindow } = item;
  const { now, student, checkIns, zone } = context;
  if (context.signedOut) return null;
  const at = classOf(item, context);
  const counts = health.countedIn === "six" || health.countedIn === "both" || health.countedIn === "unknown";
  const muted = theme.color.muted;
  // 1–2. Tandai Hadir for the class on now (or one that ended within the hour).
  if (student && counts) {
    const recent = context.schedule.find(
      (s) => s.courseCode === course.code && !isExamActivity(s.activity) && s.start <= now && now < s.end + GONE_FOR && checkIns[s.id]?.state === "gone",
    );
    if (at?.live && at.session && checkingIn(at.session, now) && (checkIns[at.session.id]?.state ?? "waiting") === "waiting")
      return <Quiet icon={<Icons.Hand size={14} color={muted} />}>{t("presence.row.watching")}</Quiet>;
    if (recent) return <Quiet icon={<Icons.Hand size={14} color={muted} />}>{t("presence.row.gone")}</Quiet>;
  }
  // 3. Out of reach or finished below: a count SIX got wrong, or a wrong target, is the way back.
  // The heading and the bar already say what's lost in red; this is the fix, so calm, its actions blue.
  if ((health.state === "out" || health.state === "missed") && !zone.results.some((r) => r.code === course.code && r.absent))
    return (
      <Quiet
        icon={<Icons.Info size={14} color={muted} />}
        action={
          <>
            {student && (
              <RowLink
                icon={<Icons.ArrowUpRight size={14} color={theme.color.accentFg} />}
                onPress={() => open(sixTimetableUrl(student))}
                testID="action.checkSix"
              >
                {t("presence.checkSix")}
              </RowLink>
            )}
            {health.state === "out" && (
              <RowLink
                icon={<Icons.Target size={14} color={theme.color.accentFg} />}
                label={`${t("presence.changeTarget")}: ${course.code}`}
                onPress={() => context.onChangeTarget(course.code)}
                testID={`action.changeTarget.${course.code}`}
              >
                {t("presence.changeTarget")}
              </RowLink>
            )}
          </>
        }
      >
        {t("presence.warn.out")}
      </Quiet>
    );
  // 4. No absences left, and the target hangs on a class that may not run.
  const needed = health.needsUncertain ? health.left.upcoming.find((m) => m.uncertain) : undefined;
  if (needed) return <Warning>{uncertainText(t, f, needed.start, context.events, health.target)}</Warning>;
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
    return <Warning>{`${head} ${tail}`}</Warning>;
  }
  // 6–7. What the next class's Edunex window asks, where Edunex keeps the count too.
  const next = health.left.next;
  if (nextWindow && (nextWindow.action.activity !== "course" || health.countedIn === "edunex")) {
    const label = actionLabel(nextWindow);
    const time = f.time(nextWindow.session.closesAt);
    if (health.countedIn === "both" && nextWindow.action.activity !== "course" && next && wibDay(nextWindow.session.opensAt) === wibDay(next.start))
      return <Quiet>{t("presence.record.bothDo", { action: label.charAt(0).toLowerCase() + label.slice(1), time })}</Quiet>;
    if (health.countedIn === "edunex") {
      const assignment = nextWindow.action.activity === "assignment";
      return (
        <Quiet>
          {t("presence.row.windowDo", {
            when: assignment ? dayLabel(f, nextWindow.session.closesAt) : windowWhen(t, f, nextWindow),
            action: assignment ? t("presence.row.byTime", { action: label, time }) : label,
          })}
        </Quiet>
      );
    }
  }
  // 8. The next class may not run (exam week, holiday), unless the note on top says it for every course.
  const first = health.left.upcoming[0];
  if (first?.uncertain && !(zone.week?.codes.includes(course.code) ?? false)) return <Warning>{uncertainText(t, f, first.start, context.events)}</Warning>;
  // 9. A lab next, in a course that also has lectures.
  if (
    at?.session &&
    /praktikum|tutorial/i.test(at.session.activity) &&
    context.schedule.some((s) => s.courseCode === course.code && /^kuliah$/i.test(s.activity))
  )
    return <Quiet>{t("presence.row.lab")}</Quiet>;
  return null;
}

/** The exception's line, under the row: its words, then its actions (each a full thumb's target). */
function Line({ tone, icon, action, children }: { tone: "muted" | "warning"; icon?: ReactNode; action?: ReactNode; children: string }) {
  return (
    // Under the row's own padding: 12 below its last line, as between its other lines.
    <View style={{ marginTop: -space[1], paddingHorizontal: space[4], paddingBottom: action ? space[1] : space[4] }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[2] }}>
        {icon && <View style={{ paddingTop: 3 }}>{icon}</View>}
        <Text size="small" tone={tone} weight={tone === "warning" ? "medium" : "regular"} style={{ flex: 1 }}>
          {children}
        </Text>
      </View>
      {action && <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: space[4], marginTop: space[0.5] }}>{action}</View>}
    </View>
  );
}

function Warning({ children }: { children: string }) {
  const theme = useTheme();
  return (
    <Line tone="warning" icon={<Icons.AlertTriangle size={14} weight="bold" color={theme.color.warningFg} />}>
      {children}
    </Line>
  );
}

function Quiet({ icon, action, children }: { icon?: ReactNode; action?: ReactNode; children: string }) {
  return (
    <Line tone="muted" icon={icon} action={action}>
      {children}
    </Line>
  );
}

/** A row's own action, a link in blue beside the row's target. */
function RowLink({ icon, label, onPress, testID, children }: { icon: ReactNode; label?: string; onPress: () => void; testID?: string; children: string }) {
  const theme = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="link"
      accessibilityLabel={label}
      android_ripple={{ color: theme.color.selected }}
      style={{ flexDirection: "row", alignItems: "center", gap: space[1], minHeight: 44 }}
    >
      {icon}
      <Text size="small" weight="medium" tone="accent">
        {children}
      </Text>
    </Pressable>
  );
}
