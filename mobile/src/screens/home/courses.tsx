// This term's courses, as Beranda's cards say them on the desktop (src/app/screens/home.tsx): the
// code and its color, the name, the class and SKS, the absences left. On a phone they're one list,
// one course a row, not a sideways scroller: each row needs the width for its absence bar, a
// scroller would hide all but the first course or two behind a gesture, and a list reads top to
// bottom with the rest of the page.

import { View } from "react-native";
import type { TermCourse } from "../../../../src/app/courses";
import { useOpenExternal } from "../../../../src/app/hooks";
import { useT } from "../../../../src/app/i18n";
import { useStatus } from "../../../../src/app/store";
import type { AttendanceHealth } from "../../../../src/core/attendance";
import { edunexCourseUrl, sixStatusUrl } from "../../../../src/core/links";
import type { HomeContext } from "../../../../src/core/needs";
import { useNav } from "../../nav";
import { AbsenceBudget } from "../../parts/attendance";
import { SixPageNote, useChangedPage } from "../../parts/six-page-note";
import { useRefresh } from "../../shell/source-status";
import { Button, IconButton } from "../../ui/controls";
import { Card, CourseCode, EmptyState, Skeleton } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { List, Meta, Row, Section } from "../../ui/layout";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";

/**
 * This term's courses. When SIX changed its course table, the ones shown are its last good list (or
 * Edunex's) and say so; with none to show, the note says why on its own. Rows SIX wrote another way are
 * said on Presensi.
 */
export function HomeCourses({ courses, nim, context }: { courses: TermCourse[] | undefined; nim: string | undefined; context: HomeContext | undefined }) {
  const t = useT();
  const changed = useChangedPage(["six.courses"]);
  const onlyNote = changed && courses?.length === 0;
  return (
    <Section title={t("home.coursesThisTerm")} count={onlyNote ? undefined : courses?.length} testID="section.courses">
      {changed && (
        <View style={{ marginBottom: space[3] }}>
          <SixPageNote datasets={["six.courses"]} />
        </View>
      )}
      {!onlyNote && <Courses courses={courses} nim={nim} context={context} />}
    </Section>
  );
}

function Courses({ courses, nim, context }: { courses: TermCourse[] | undefined; nim: string | undefined; context: HomeContext | undefined }) {
  const t = useT();
  const theme = useTheme();
  const statuses = [useStatus("edunex"), useStatus("six")];
  const { refresh, busy } = useRefresh();

  if (!courses) {
    if (statuses.some((status) => status.state === "connecting" || status.state === "live"))
      return (
        <Card>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ padding: space[4], gap: space[2] }}>
              <Skeleton height={12} width={64} />
              <Skeleton width="80%" />
              <Skeleton height={12} width={48} />
            </View>
          ))}
        </Card>
      );
    return (
      <EmptyState icon={<Icons.BookOpen size={20} color={theme.color.muted} />} title={t("home.coursesUnavailable")}>
        {statuses.some((status) => status.state !== "expired" && status.state !== "signed-out") && (
          <Button size="sm" busy={busy} onPress={() => void refresh()} testID="action.tryAgain">
            {t("action.tryAgain")}
          </Button>
        )}
      </EmptyState>
    );
  }
  if (courses.length === 0) return <EmptyState icon={<Icons.BookOpen size={20} color={theme.color.muted} />} title={t("home.noCourses")} />;
  return (
    <List>
      {courses.map((course) => (
        <CourseRow key={course.code} course={course} nim={nim} health={context?.health.get(course.code)} />
      ))}
    </List>
  );
}

function CourseRow({ course, nim, health }: { course: TermCourse; nim: string | undefined; health: AttendanceHealth | undefined }) {
  const t = useT();
  const theme = useTheme();
  const open = useOpenExternal();
  const { go } = useNav();
  const facts = [course.classNo ? t("course.class", { no: course.classNo }) : null, course.sks !== null ? t("course.sks", { count: course.sks }) : null];
  const external = course.edunex
    ? { label: t("action.openInEdunex"), url: edunexCourseUrl(course.edunex.courseId) }
    : nim
      ? { label: t("action.openInSix"), url: sixStatusUrl(nim) }
      : null;
  return (
    <Row
      testID={`row.course.${course.code}`}
      title={
        <View style={{ gap: space[1] }}>
          <CourseCode code={course.code} color={course.color} />
          <Text weight="semibold" numberOfLines={2}>
            {course.name}
          </Text>
        </View>
      }
      meta={facts.some(Boolean) ? <Meta>{facts}</Meta> : undefined}
      // A course on Edunex opens its course page (the whole row); one only in SIX has none.
      onPress={course.edunex ? () => go({ screen: "course", code: course.code }) : undefined}
      // A second way out, the row itself opening the course: always shown, as a phone has no hover.
      actions={
        external ? (
          <IconButton label={`${external.label}: ${course.code}`} onPress={() => open(external.url)} testID="action.openExternal">
            <Icons.ArrowUpRight size={18} color={theme.color.muted} />
          </IconButton>
        ) : undefined
      }
    >
      {(course.inSix || !course.edunex) && (
        <View style={{ marginTop: space[3], gap: space[1] }}>
          {course.inSix && <CourseAttendance health={health} />}
          {!course.edunex && (
            <Text size="caption" tone="faint">
              {t("course.notOnEdunex")}
            </Text>
          )}
        </View>
      )}
    </Row>
  );
}

/** The course's absences, as Presensi draws them: "Jatah absen", the bar, "Terpakai 1× · sisa 1×". */
function CourseAttendance({ health }: { health: AttendanceHealth | undefined }) {
  const t = useT();
  if (!health?.held)
    return (
      <Text size="caption" tone="faint">
        {t("course.noMeetingsYet")}
      </Text>
    );
  return <AbsenceBudget health={health} place="card" />;
}
