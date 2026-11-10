// The course's sheet (round 2, v4; round 3), opened from the header at the top of the page (its ⓘ): what the page
// leaves out to keep to one meter and one row. Small at its top, the course's code and class over its name (the bar
// behind already says the name big); its lecturer and SKS; its next class, with a clash named by the other course's
// short name; its attendance said once, the meter as the picture and one line ("Hadir 5 dari 9 · lewat batas 2× ·
// paling tinggi 69%"); its target, changed in place; SIX's timetable when the count may be wrong. How it's counted and
// the advice ("Cek ke dosen") are one step away, behind the attendance's ⓘ. Built as Beranda's class sheet
// (../home/class-sheet.tsx).
import { type ReactNode, useState } from "react";
import { View } from "react-native";
import type { Attendance, CourseAttendance } from "../../../../src/app/attendance";
import { budgetWords, verdictLabel } from "../../../../src/app/attendance-labels";
import { useOpenExternal } from "../../../../src/app/hooks";
import { type Format, type Translate, useFormat, useT } from "../../../../src/app/i18n";
import { useCourseNames } from "../../../../src/app/schedule-data";
import type { CoursePage } from "../../../../src/app/screens/course/data";
import { useDataset } from "../../../../src/app/store";
import { type AttendanceHealth, percent } from "../../../../src/core/attendance";
import { sixTimetableUrl } from "../../../../src/core/links";
import { TargetStepper, useTargets } from "../../parts/attendance";
import { AttendanceMeter, meterModel, meterTone } from "../../parts/attendance-meter";
import { IconButton } from "../../ui/controls";
import { Icons } from "../../ui/icons";
import { PressScale } from "../../ui/press";
import { Sheet } from "../../ui/sheet";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { CourseTile } from "../../ui/tile";
import { shortName } from "../home/parts";
import { metaParts, noCountLine, type RowContext } from "../presence/logic";
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
  // Signed out of SIX the course still has its next Edunex window (the desktop's Presensi row says it then), so the next
  // class's fact shows without SIX; the attendance in full needs SIX's count.
  const item = rows?.attendance.courses.find((c) => c.course.code === course.code);
  const crumb = [course.code, course.classNo ? t("course.class", { no: course.classNo }) : null].filter(Boolean).join(" · ");
  return (
    <Sheet open={open} onClose={onClose} background={v.card} testID="sheet.course">
      <View style={{ gap: space[4], paddingBottom: space[2] }}>
        {/* The bar behind already says the name big: here it's small, under the code and class. */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[3] }}>
          <CourseTile code={course.code} name={course.name} size={40} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text size="bodyMedium" weight="medium" tabular style={{ color: v.muted }}>
              {crumb}
            </Text>
            <Text size="bodyLarge" weight="medium" numberOfLines={2} accessibilityRole="header" style={{ color: v.fg }}>
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
          {item && rows && <NextClassFact item={item} context={rows.context} />}
          {item && rows?.attendance.sixConnected && <AttendanceFacts page={page} item={item} attendance={rows.attendance} context={rows.context} />}
        </View>
      </View>
    </Sheet>
  );
}

/**
 * The course's next class, as round 1's Kuliah row said it under the course (the desktop's Presensi row, metaParts): on
 * now until when, today's or another day's time, and its room; signed out of SIX, the next Edunex window ("Presensi Edunex
 * Jum 16 Okt, kumpulkan sebelum 23:59"). Under it a clash with another course's class, by that course's short name.
 */
function NextClassFact({ item, context }: { item: CourseAttendance; context: RowContext }) {
  const t = useT();
  const f = useFormat();
  const v = useTheme().v4;
  const name = useCourseNames();
  const parts = metaParts(t, f, item, context);
  if (!parts.length) return null;
  const clash =
    item.clash && !context.signedOut
      ? t("mobile.course.clash", { course: shortName(name(item.clash.other)), time: f.timeRange(item.clash.from, item.clash.to) })
      : null;
  return (
    <Fact icon={(c) => <Icons.CalendarClock size={22} color={c} />}>
      <Text size="bodyLarge" style={{ color: v.fg2 }}>
        {parts.join(" · ")}
      </Text>
      {clash && (
        <View testID="note.courseClash" style={{ flexDirection: "row", alignItems: "center", gap: space[1] }}>
          <Icons.Overlap size={14} weight="bold" color={v.ambFg} />
          <Text size="bodyMedium" tabular style={{ flexShrink: 1, color: v.ambFg }}>
            {clash}
          </Text>
        </View>
      )}
    </Fact>
  );
}

/** One fact with its icon, as the class sheet draws them: a 48 dp row, the icon in the quiet grey. */
export function Fact({
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

/** "Hadiri 7 pertemuan tersisa, sampai 4 Des". From src/app/screens/course.tsx (the target is on the sheet's stepper). */
function noneLeft(t: Translate, f: Format, health: AttendanceHealth, lastDay: string | null): string {
  const { count, estimated } = health.left;
  // The sure meetings alone fall short: one that may not run has to.
  if (health.needsUncertain) return t("course.risk.noneIfRuns", { target: health.target });
  if (count === 0) return "";
  if (!lastDay) return t("course.risk.noneAll");
  const date = f.dayMonth(Date.parse(`${lastDay}T12:00:00+07:00`));
  return t(estimated ? "course.risk.noneAbout" : "course.risk.none", { count, date });
}

/** The exceptions said as a line on the sheet: facts with a date or a deadline. The rest is advice, behind the ⓘ. */
const SAID: ReadonlySet<CourseExceptionNote["kind"]> = new Set(["watching", "gone", "needed", "window", "uncertain"]);

/** "sisa 1×" after "Hadir 5 dari 9 · ": the parts after the first start small. */
const small = (part: string, i: number) => (i === 0 ? part : part.charAt(0).toLocaleLowerCase() + part.slice(1));

function AttendanceFacts({ page, item, attendance, context }: { page: CoursePage; item: CourseAttendance; attendance: Attendance; context: RowContext }) {
  const t = useT();
  const f = useFormat();
  const v = useTheme().v4;
  const open = useOpenExternal();
  const student = useDataset("six.student");
  const { target: fallback, own, setOwn } = useTargets();
  const exception = useCourseException(item, context);
  const [why, setWhy] = useState(false);
  const { health, course } = item;
  const code = course.code;
  const held = health.held ?? 0;
  const attended = health.attended ?? 0;
  const share = held > 0 ? percent(attended, held) : null;
  const over = health.state === "met" || health.state === "missed";
  const out = health.state === "out";
  const words = budgetWords(t, health, context.soFar);
  const meter = meterModel(t, item, context.soFar);
  // The line takes the meter's tone (parts/attendance-meter.tsx): red with none left or over, amber with one left.
  const tone = meterTone(health);
  const ink = tone === "red" ? v.redFg : tone === "amber" ? v.ambFg : v.fg;
  const best = out ? t("course.risk.bestShort", { best: percent(health.best ?? 0) }) : null;
  // Attendance said once: the count, what's left of the absences, and out of reach the best it can end at.
  const counted = share !== null && !over;
  const line =
    share === null
      ? noCountLine(t, health, context.signedOut)
      : over
        ? t("presence.row.final", { percent: share })
        : [t("course.attended", { attended, held }), words?.bold, best]
            .filter((part): part is string => Boolean(part))
            .map(small)
            .join(" · ");
  // The whole of it for TalkBack: the share too, and the verdict the line folds into one number.
  const lineLabel = counted
    ? [t("presence.row.count", { attended, held, percent: share }), words?.label, out ? verdictLabel(t, health) : null, best].filter(Boolean).join(". ")
    : undefined;
  // No absences left: what to do and by when (an action and its deadline stay on the sheet).
  const todo = health.state === "none" ? noneLeft(t, f, health, attendance.lastDay) : "";
  // One step away: where it counts, how, and the advice ("Cek ke dosen", why).
  const countedIn = health.countedIn === "six" || health.countedIn === "both" ? t(`schedule.countedIn.${health.countedIn}`) : null;
  const how =
    page.presence !== undefined && page.presence.length === 0
      ? t("meeting.noEdunexPresence")
      : health.countedIn === "edunex"
        ? t("meeting.edunexCounts")
        : course.attendance && page.presence?.length
          ? t("meeting.sixTotalsOnly")
          : null;
  const explained = [countedIn, how, exception?.text].filter((part): part is string => Boolean(part));
  const said = exception && SAID.has(exception.kind) ? exception : null;
  // Out of reach (or a count SIX may have wrong), SIX's timetable is the way back.
  const checkSix = student && (out || exception?.kind === "uncounted") ? student : null;
  const mine = Object.hasOwn(own, code) ? own[code]! : null;
  const value = mine ?? fallback;
  return (
    <>
      <Fact
        icon={(c) => <Icons.CalendarCheck size={22} color={c} />}
        end={
          explained.length > 0 ? (
            <IconButton label={t("presence.how")} selected={why} onPress={() => setWhy((was) => !was)} testID="action.courseWhy">
              <Icons.Info size={22} weight={why ? "fill" : "regular"} color={v.muted} />
            </IconButton>
          ) : undefined
        }
      >
        <View testID={out ? "notice.courseRisk" : undefined} style={{ gap: space[2] }}>
          {meter?.bar && <AttendanceMeter model={{ ...meter, word: null }} size="header" hideLabel />}
          <Text size="bodyLarge" weight="medium" tabular accessibilityLabel={lineLabel} style={{ color: counted ? ink : v.fg2 }}>
            {line}
          </Text>
        </View>
        {todo !== "" && (
          <Text size="bodyMedium" style={{ color: v.fg2 }}>
            {todo}
          </Text>
        )}
        {why &&
          explained.map((text) => (
            <Text key={text} size="bodyMedium" style={{ color: v.muted }}>
              {text}
            </Text>
          ))}
        {checkSix && (
          <Link external onPress={() => open(sixTimetableUrl(checkSix))} testID="action.checkSix">
            {t("presence.checkSix")}
          </Link>
        )}
      </Fact>
      {said && (
        <Fact tone={said.tone === "warning" ? "warning" : "fg"} icon={() => <ExceptionIcon exception={said} size={22} />}>
          {said.short}
        </Fact>
      )}
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
