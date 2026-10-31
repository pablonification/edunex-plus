// A course on Kuliah (round 2, W4/W11): a slim row, one target, the course's page; what Presensi's long card said
// (the bar, the count, one exception with its links) is on the course page now, under its name (CourseException).
// Words and figures are the desktop's (src/app/screens/presence.tsx's CourseRow and Exception).
import { View } from "react-native";
import type { CourseAttendance } from "../../../../src/app/attendance";
import { useFormat, useT } from "../../../../src/app/i18n";
import { useCourseNames } from "../../../../src/app/schedule-data";
import type { PresenceGroup } from "../../../../src/core/attendance";
import { useNav } from "../../nav";
import { openCourseColorPicker } from "../../parts/course-color-picker";
import { CourseDot } from "../../ui/display";
import { factsLabel, Meta, Row } from "../../ui/layout";
import { Text } from "../../ui/text";
import { space } from "../../ui/theme";
import { BudgetChip, budgetChip } from "../course/attendance-line";
import { metaParts, type RowContext } from "./logic";

export function CourseRow({ item, group, context }: { item: CourseAttendance; group: PresenceGroup; context: RowContext }) {
  const t = useT();
  const f = useFormat();
  const { go } = useNav();
  const name = useCourseNames();
  const { course, health } = item;
  const meta = metaParts(t, f, item, context);
  const chip = budgetChip(t, group, health, context);
  return (
    <Row
      testID={`row.course.${course.code}`}
      leading={<CourseDot color={course.color} size={12} />}
      title={
        <Text size="bodyLarge" weight="medium" numberOfLines={3}>
          {name(course.code, course.name)}
        </Text>
      }
      meta={<Meta>{[course.code, ...meta].join(" · ")}</Meta>}
      // Kuliah is the way into a course: the row opens its page (one target, one outcome).
      onPress={() => go({ screen: "course", code: course.code })}
      // The course's colour, as a long-press (the desktop's right-click on its sidebar row).
      onLongPress={() => openCourseColorPicker(course.code)}
      label={factsLabel(course.code, name(course.code, course.name), ...meta, chip?.label)}
    >
      {/* Under the facts, not at the row's end: on a small phone the name and the next class keep the whole width. */}
      {chip && (
        <View style={{ flexDirection: "row", marginTop: space[2] }}>
          <BudgetChip chip={chip} />
        </View>
      )}
    </Row>
  );
}
