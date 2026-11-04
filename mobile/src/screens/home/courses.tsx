// "Mata kuliah semester ini" (the desktop's Beranda, src/app/screens/home.tsx HomeCourses): this term's courses, a row
// each in v4's card, as Kuliah draws them: the course's tile, its name, its code, and its absences left as the row's one
// chip ("Sisa 1×", "Jatah habis", "Lewat batas 1×": the desktop's "sisa 1×", "habis", by their one name on every tab).
// A row opens the course's page. The list's own states are the desktop's: still reading, couldn't load, none; and when
// SIX changed its course table, its note over the rows (or alone, with none to show).
import { View } from "react-native";
import { budgetLabel, budgetWords } from "../../../../src/app/attendance-labels";
import type { TermCourse } from "../../../../src/app/courses";
import { type Translate, useT } from "../../../../src/app/i18n";
import { useStatus } from "../../../../src/app/store";
import type { AttendanceHealth } from "../../../../src/core/attendance";
import type { HomeContext } from "../../../../src/core/needs";
import { useNav } from "../../nav";
import { SixPageNote, useChangedPage } from "../../parts/six-page-note";
import { useRefresh } from "../../shell/source-status";
import { absenceName, absenceTone } from "../../ui/absence";
import { Button } from "../../ui/controls";
import { Skeleton } from "../../ui/display";
import { Rise } from "../../ui/expressive";
import { factsLabel } from "../../ui/layout";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { CourseTile } from "../../ui/tile";
import { CardGroup, type ChipTone, StatusChip, TileRow } from "../../ui/v4-list";

export function TermCourses({ courses, context }: { courses: readonly TermCourse[] | undefined; context: HomeContext }) {
  const t = useT();
  const v = useTheme().v4;
  const changed = useChangedPage(["six.courses"]);
  // SIX changed its course table and nothing's left to show: the note says why on its own.
  const onlyNote = changed !== undefined && courses?.length === 0;
  return (
    <View testID="section.courses">
      <Rise screen="home" index={7}>
        <Text
          size="titleMedium"
          face="display"
          weight="bold"
          accessibilityRole="header"
          style={{ fontSize: 17, letterSpacing: -0.2, color: v.fg, marginTop: space[6], marginBottom: space[3], marginLeft: space[1] }}
        >
          {t("home.coursesThisTerm")}
          {!onlyNote && courses ? (
            <Text size="titleMedium" tabular style={{ fontSize: 17, color: v.muted }}>
              {`  ${courses.length}`}
            </Text>
          ) : null}
        </Text>
      </Rise>
      <Rise screen="home" index={8} style={{ gap: space[3] }}>
        {changed && <SixPageNote datasets={["six.courses"]} />}
        {!onlyNote && <Rows courses={courses} context={context} />}
      </Rise>
    </View>
  );
}

function Rows({ courses, context }: { courses: readonly TermCourse[] | undefined; context: HomeContext }) {
  const t = useT();
  const v = useTheme().v4;
  const statuses = [useStatus("edunex"), useStatus("six")];
  const { refresh, busy } = useRefresh();
  if (!courses) {
    if (statuses.some((status) => status.state === "connecting" || status.state === "live"))
      return (
        <CardGroup testID="section.courses.loading">
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: space[3], paddingHorizontal: 14, minHeight: 68 }}>
              <Skeleton height={44} width={44} style={{ borderRadius: 14 }} />
              <View style={{ flex: 1, gap: space[2] }}>
                <Skeleton height={14} width="70%" />
                <Skeleton height={12} width="25%" />
              </View>
            </View>
          ))}
        </CardGroup>
      );
    return (
      <View style={{ gap: space[3], alignItems: "flex-start", marginHorizontal: space[1] }}>
        <Text size="bodyMedium" style={{ color: v.muted }}>
          {t("home.coursesUnavailable")}
        </Text>
        {statuses.some((status) => status.state !== "expired" && status.state !== "signed-out") && (
          <Button size="sm" busy={busy} onPress={() => void refresh()} testID="action.coursesRetry">
            {t("action.tryAgain")}
          </Button>
        )}
      </View>
    );
  }
  if (courses.length === 0)
    return (
      <Text size="bodyMedium" style={{ color: v.muted, marginHorizontal: space[1] }}>
        {t("home.noCourses")}
      </Text>
    );
  return (
    <CardGroup>
      {courses.map((course, i) => (
        <CourseRow key={course.code} course={course} health={context.health.get(course.code)} first={i === 0} />
      ))}
    </CardGroup>
  );
}

function CourseRow({ course, health, first }: { course: TermCourse; health: AttendanceHealth | undefined; first: boolean }) {
  const t = useT();
  const { go } = useNav();
  const chip = course.inSix ? absenceChip(t, health) : null;
  // The desktop's "Belum ada pertemuan" only when SIX says none were held: a count it couldn't read isn't none.
  const noMeetings = course.inSix && health?.held === 0;
  const meta = [course.code, noMeetings && t("course.noMeetingsYet"), !course.edunex && t("course.notOnEdunex")].filter(Boolean).join(" · ");
  return (
    <TileRow
      testID={`row.homeCourse.${course.code}`}
      first={first}
      leading={<CourseTile code={course.code} name={course.name} />}
      title={course.name}
      meta={meta}
      status={chip ? <StatusChip tone={chip.tone}>{chip.text}</StatusChip> : undefined}
      // As Kuliah's row: the course's page (the desktop's opens it for a course on Edunex; the phone's page has one
      // for a course only in SIX too).
      onPress={() => go({ screen: "course", code: course.code })}
      label={factsLabel(course.code, course.name, chip?.label, noMeetings && t("course.noMeetingsYet"), !course.edunex && t("course.notOnEdunex"))}
    />
  );
}

/**
 * The absences left in a few words, as the desktop's course row says them under the bar ("sisa 1×", "habis"), or its
 * final word once lectures are over; none and over the limit by their one name (src/ui/absence.ts). Null where the
 * desktop's row shows no budget (no meetings held yet, no count to judge).
 */
function absenceChip(t: Translate, health: AttendanceHealth | undefined): { text: string; tone: ChipTone; label: string } | null {
  if (!health?.held) return null;
  const tone: ChipTone = absenceTone(health.state) ?? "neutral";
  const words = budgetWords(t, health);
  if (!words) return health.state === "met" || health.state === "missed" ? { text: budgetLabel(t, health), tone, label: budgetLabel(t, health) } : null;
  const text = absenceName(t, health) ?? words.bold.charAt(0).toLocaleUpperCase() + words.bold.slice(1);
  return { text, tone, label: words.label };
}
