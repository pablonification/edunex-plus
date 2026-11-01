// The course's sheet (round 2, v4), opened from its name at the top of the page and from its attendance card: what the
// page leaves out to keep to one number and one row. The course's tile, code and class over its name; its lecturer and
// SKS; then its attendance in full: the share and the count, what's used and left of the absences (a pip each), how it's
// counted; its target, changed in place; for a course in trouble what that means now (round 1's banner over the page);
// and the one exception's whole sentence with its way back. Built as Beranda's class sheet (../home/class-sheet.tsx).
import type { ReactNode } from "react";
import { View } from "react-native";
import type { Attendance, CourseAttendance } from "../../../../src/app/attendance";
import { budgetLabel, budgetWords, verdictLabel } from "../../../../src/app/attendance-labels";
import { useOpenExternal } from "../../../../src/app/hooks";
import { type Format, type Translate, useFormat, useNow, useT } from "../../../../src/app/i18n";
import type { CoursePage } from "../../../../src/app/screens/course/data";
import { useDataset } from "../../../../src/app/store";
import { type AttendanceHealth, percent } from "../../../../src/core/attendance";
import { clashes } from "../../../../src/core/course-meetings";
import { sixTimetableUrl } from "../../../../src/core/links";
import { TargetStepper, useTargets } from "../../parts/attendance";
import { absenceInk, absenceTone } from "../../ui/absence";
import { Icons } from "../../ui/icons";
import { PressScale } from "../../ui/press";
import { Sheet } from "../../ui/sheet";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { CourseTile } from "../../ui/tile";
import type { RowContext } from "../presence/logic";
import { type CourseExceptionNote, ExceptionIcon, useCourseException } from "./attendance-line";

export interface CourseRows {
  attendance: Attendance;
  context: RowContext;
}

export function CourseSheet({ page, rows, open, onClose }: { page: CoursePage; rows: CourseRows | undefined; open: boolean; onClose: () => void }) {
  const t = useT();
  const v = useTheme().v4;
  const { course, outline } = page;
  const sks = course.sks ?? outline?.credits ?? null;
  const item = rows?.attendance.sixConnected ? rows.attendance.courses.find((c) => c.course.code === course.code) : undefined;
  const crumb = [course.code, course.classNo ? t("course.class", { no: course.classNo }) : null].filter(Boolean).join(" · ");
  return (
    <Sheet open={open} onClose={onClose} background={v.card} testID="sheet.course">
      <View style={{ gap: space[4], paddingBottom: space[2] }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[4] }}>
          <CourseTile code={course.code} name={course.name} size={52} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text size="bodyMedium" weight="medium" tabular style={{ color: v.muted }}>
              {crumb}
            </Text>
            <Text size="titleLarge" face="display" weight="bold" accessibilityRole="header" style={{ color: v.fg, fontSize: 20, lineHeight: 26, marginTop: 2 }}>
              {course.name}
            </Text>
          </View>
        </View>
        <View>
          {outline?.lecturer && (
            <Fact icon={(c) => <Icons.User size={22} color={c} />} label={`${t("course.lecturer")}: ${outline.lecturer}`}>
              {outline.lecturer}
            </Fact>
          )}
          {sks !== null && <Fact icon={(c) => <Icons.BookOpen size={22} color={c} />}>{t("course.sks", { count: sks })}</Fact>}
          {item && rows && <AttendanceFacts page={page} item={item} attendance={rows.attendance} context={rows.context} />}
        </View>
      </View>
    </Sheet>
  );
}

/** One fact with its icon, as the class sheet draws them: a 48 dp row, the icon in the quiet grey. */
function Fact({
  icon,
  tone = "fg",
  end,
  label,
  children,
}: {
  icon: (color: string) => ReactNode;
  tone?: "fg" | "warning" | "danger";
  end?: ReactNode;
  label?: string;
  children: ReactNode;
}) {
  const v = useTheme().v4;
  const color = tone === "warning" ? v.ambFg : tone === "danger" ? v.redFg : v.muted;
  return (
    <View
      accessible={label !== undefined}
      accessibilityLabel={label}
      style={{ flexDirection: "row", alignItems: "center", gap: space[4], minHeight: 48, paddingVertical: space[2] }}
    >
      <View style={{ width: 22, alignItems: "center", alignSelf: "flex-start", paddingTop: 1 }}>{icon(color)}</View>
      <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
        {typeof children === "string" ? (
          <Text size="bodyLarge" style={{ color: v.fg2 }}>
            {children}
          </Text>
        ) : (
          children
        )}
      </View>
      {end}
    </View>
  );
}

/** The absences: one pip each, used in the absence scale's colour (src/ui/absence.ts), still allowed in the line's grey (v4's pip meter, as the class sheet's). */
function Pips({ health }: { health: AttendanceHealth }) {
  const v = useTheme().v4;
  const tone = absenceTone(health.state);
  const ink = tone ? absenceInk(v, tone).fg : v.muted;
  const used = health.held !== null && health.attended !== null ? Math.max(0, health.held - health.attended) : 0;
  const left = Math.max(0, health.absencesLeft ?? 0);
  const total = Math.min(8, used + left);
  if (total === 0) return null;
  return (
    <View style={{ flexDirection: "row", gap: 4 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: total }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: pips are positions, none has an identity of its own
        <View key={i} style={{ width: 14, height: 8, borderRadius: 4, backgroundColor: i < used ? ink : v.line, opacity: i < used ? 0.8 : 1 }} />
      ))}
    </View>
  );
}

/** "7 pertemuan lagi sampai 4 Des. Hadiri semuanya agar tetap 80%." From src/app/screens/course.tsx. */
function noneLeft(t: Translate, f: Format, health: AttendanceHealth, lastDay: string | null): string {
  const { count, estimated } = health.left;
  // The sure meetings alone fall short: one that may not run has to.
  if (health.needsUncertain) return t("course.risk.noneIfRuns", { target: health.target });
  if (count === 0) return "";
  if (!lastDay) return t("course.risk.noneNoDate", { target: health.target });
  const date = f.dayMonth(Date.parse(`${lastDay}T12:00:00+07:00`));
  return t(estimated ? "course.risk.noneAbout" : "course.risk.none", { count, date, target: health.target });
}

function AttendanceFacts({ page, item, attendance, context }: { page: CoursePage; item: CourseAttendance; attendance: Attendance; context: RowContext }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const v = useTheme().v4;
  const open = useOpenExternal();
  const schedule = useDataset("six.schedule");
  const student = useDataset("six.student");
  const { target: fallback, own, setOwn } = useTargets();
  const exception = useCourseException(item, context);
  const { health, course } = item;
  const code = course.code;
  const held = health.held ?? 0;
  const share = held > 0 ? percent(health.attended ?? 0, held) : null;
  const over = health.state === "met" || health.state === "missed";
  const words = budgetWords(t, health, context.soFar);
  const wordsLine = words ? [words.lead, words.bold].filter(Boolean).join(" · ") : "";
  const budgetLine = wordsLine ? wordsLine.charAt(0).toLocaleUpperCase() + wordsLine.slice(1) : "";
  // The absence scale, as the chip on the page (src/ui/absence.ts): red out of reach, amber with none left; the budget's
  // words stay quiet with some to spare.
  const tone = absenceTone(health.state);
  const ink = tone === "red" || tone === "amber" ? absenceInk(v, tone).fg : v.muted;
  // How the course's attendance is counted (round 1's line over the Pertemuan tab).
  const noEdunexPresence = page.presence !== undefined && page.presence.length === 0;
  const how = noEdunexPresence
    ? t("meeting.noEdunexPresence")
    : health.countedIn === "edunex"
      ? t("meeting.edunexCounts")
      : course.attendance && page.presence?.length
        ? t("meeting.sixTotalsOnly")
        : null;
  const mine = Object.hasOwn(own, code) ? own[code]! : null;
  const value = mine ?? fallback;
  // A course in trouble: what that means now, as round 1's banner over the page said it (with a clash on the next one).
  const risk = health.state === "out" || health.state === "none";
  const next = page.meetings.find((m) => m.end > now && !m.notInSix);
  const clash = next ? clashes(next, code, schedule ?? [])[0] : undefined;
  const riskText = risk
    ? [
        health.state === "out" ? t("course.risk.best", { best: percent(health.best ?? 0) }) : noneLeft(t, f, health, attendance.lastDay),
        next && clash
          ? t("course.risk.clash", { code: clash.courseCode, time: f.timeRange(Math.max(next.start, clash.start), Math.min(next.end, clash.end)) })
          : "",
      ]
        .filter(Boolean)
        .join(" ")
    : "";
  // The risk's words already say what the out-of-reach exception says, and a clash its own way.
  const shownException: CourseExceptionNote | null =
    exception && !(risk && (exception.kind === "uncounted" || (exception.kind === "clash" && clash))) ? exception : null;
  const checkSix = student ? (
    <Link external onPress={() => open(sixTimetableUrl(student))} testID="action.checkSix">
      {t("presence.checkSix")}
    </Link>
  ) : null;
  return (
    <>
      <Fact icon={(c) => <Icons.Hand size={22} color={c} />} end={<Pips health={health} />}>
        <Text size="bodyLarge" weight="medium" tabular style={{ color: v.fg }}>
          {share === null
            ? budgetLabel(t, health)
            : over
              ? t("presence.row.final", { percent: share })
              : t("presence.row.count", { attended: health.attended ?? 0, held, percent: share })}
        </Text>
        {budgetLine !== "" && (
          <Text size="bodyMedium" weight="medium" tabular style={{ color: ink }} accessibilityLabel={words?.label}>
            {budgetLine}
          </Text>
        )}
        {how && (
          <Text size="bodyMedium" style={{ color: v.muted }}>
            {how}
          </Text>
        )}
      </Fact>
      {!over && (
        <Fact icon={(c) => <Icons.Target size={22} color={c} />} end={<TargetStepper value={value} onChange={(next) => setOwn(code, next)} code={code} />}>
          <Text size="bodyLarge" style={{ color: v.fg2 }}>
            {t("mobile.course.target")}
          </Text>
          {mine !== null && (
            <Link onPress={() => setOwn(code, null)} testID="action.courseTargetDefault">
              {t("presence.target.useDefault", { value: fallback })}
            </Link>
          )}
        </Fact>
      )}
      {risk && (
        <Fact tone={tone === "red" ? "danger" : "warning"} icon={(c) => <Icons.AlertTriangle size={22} weight="bold" color={c} />}>
          <View testID="notice.courseRisk" style={{ gap: 2 }}>
            <Text size="bodyLarge" weight="semibold" style={{ color: ink }}>
              {verdictLabel(t, health)}
            </Text>
            {riskText !== "" && (
              <Text size="bodyMedium" style={{ color: v.fg2 }}>
                {riskText}
              </Text>
            )}
            {health.state === "out" && checkSix}
          </View>
        </Fact>
      )}
      {shownException && (
        <Fact tone={shownException.tone === "warning" ? "warning" : "fg"} icon={() => <ExceptionIcon exception={shownException} size={22} />}>
          <Text size="bodyMedium" style={{ color: v.fg2 }}>
            {shownException.text}
          </Text>
          {shownException.kind === "uncounted" && checkSix}
        </Fact>
      )}
    </>
  );
}

/** A fact's own action in the brand's blue, a full thumb's target; `external` (SIX's page) with its arrow. */
function Link({ onPress, external = false, testID, children }: { onPress: () => void; external?: boolean; testID?: string; children: string }) {
  const v = useTheme().v4;
  return (
    <PressScale
      onPress={onPress}
      testID={testID}
      accessibilityRole={external ? "link" : "button"}
      style={{ flexDirection: "row", alignItems: "center", gap: space[1], minHeight: 48, alignSelf: "flex-start" }}
    >
      <Text size="bodyMedium" weight="semibold" style={{ color: v.brandInk }}>
        {children}
      </Text>
      {external && <Icons.ArrowUpRight size={14} color={v.brandInk} />}
    </PressScale>
  );
}
