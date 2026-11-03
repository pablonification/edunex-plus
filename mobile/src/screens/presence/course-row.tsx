// A course on Kuliah (round 2, v4; W4/W11): one row in a white card, one target, the course's page. Its tile in the
// course's ink and tint, its name, its code, and what's left of its absences as the row's one chip ("Sisa 1×", "Jatah habis",
// "Lewat batas 1×"). The next class, the bar, the count and the one exception are on the course page, under its name;
// a screen reader still hears the next class here. Words and figures are the desktop's (src/app/screens/presence.tsx).
import type { CourseAttendance } from "../../../../src/app/attendance";
import { useFormat, useT } from "../../../../src/app/i18n";
import { useCourseNames } from "../../../../src/app/schedule-data";
import type { PresenceGroup } from "../../../../src/core/attendance";
import { useNav } from "../../nav";
import { openCourseColorPicker } from "../../parts/course-color-picker";
import { factsLabel } from "../../ui/layout";
import { CourseTile } from "../../ui/tile";
import { StatusChip, TileRow } from "../../ui/v4-list";
import { budgetChip } from "../course/attendance-line";
import { metaParts, type RowContext } from "./logic";

export function CourseRow({ item, group, context, first }: { item: CourseAttendance; group: PresenceGroup; context: RowContext; first: boolean }) {
  const t = useT();
  const f = useFormat();
  const { go } = useNav();
  const name = useCourseNames();
  const { course } = item;
  const title = name(course.code, course.name);
  const chip = budgetChip(t, group, item.health, context);
  return (
    <TileRow
      testID={`row.course.${course.code}`}
      first={first}
      leading={<CourseTile code={course.code} name={title} />}
      title={title}
      meta={course.code}
      status={chip ? <StatusChip tone={chip.tone}>{chip.text}</StatusChip> : undefined}
      // Kuliah is the way into a course: the row opens its page (one target, one outcome).
      onPress={() => go({ screen: "course", code: course.code })}
      // The course's colour, as a long-press (the desktop's right-click on its sidebar row).
      onLongPress={() => openCourseColorPicker(course.code)}
      label={factsLabel(course.code, title, chip?.label, ...metaParts(t, f, item, context))}
    />
  );
}
