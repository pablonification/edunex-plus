// A course on Kuliah (round 3, after the blind review): one row in a white card, one target, the course's page. Its
// tile in the course's ink and tint, its name (two lines at most), its code under it, and at its end the state of its
// absences in plain words, the same words as on every tab: at risk ("Lewat batas 1×", "Jatah habis") a tonal pill in
// the risk's colour, the one thing on the screen that pulls the eye; otherwise quiet words ("Sisa 2×"). No meter here
// (its pips needed a key; the course's page draws it) and no tick (two statuses on one row read as a contradiction).
// The next class and the whole count are on the course page; a screen reader still hears the whole sentence and the
// next class here. Words and figures are the desktop's (src/app/screens/presence.tsx).
import { memo } from "react";
import type { CourseAttendance } from "../../../../src/app/attendance";
import { useFormat, useT } from "../../../../src/app/i18n";
import { useCourseNames } from "../../../../src/app/schedule-data";
import type { PresenceGroup } from "../../../../src/core/attendance";
import { useNav } from "../../nav";
import { meterModel } from "../../parts/attendance-meter";
import { openCourseColorPicker } from "../../parts/course-color-picker";
import { factsLabel } from "../../ui/layout";
import { Text } from "../../ui/text";
import { useTheme } from "../../ui/theme";
import { CourseTile } from "../../ui/tile";
import { StatusChip, TileRow } from "../../ui/v4-list";
import { metaParts, type RowContext, sideText } from "./logic";

export const CourseRow = memo(function CourseRow({
  item,
  group,
  context,
  first,
}: {
  item: CourseAttendance;
  group: PresenceGroup;
  context: RowContext;
  first: boolean;
}) {
  const t = useT();
  const f = useFormat();
  const v = useTheme().v4;
  const { go } = useNav();
  const name = useCourseNames();
  const { course } = item;
  const title = name(course.code, course.name);
  const model = context.signedOut ? null : meterModel(t, item, context.soFar);
  // A course with no words of its own (lectures over without a count): the desktop's row end, after its code.
  const side = !model && !context.signedOut ? sideText(t, group, item.health) : "";
  const risk = model && (model.tone === "red" || model.tone === "amber") ? model.tone : null;
  const status = model?.word ? (
    risk ? (
      <StatusChip tone={risk} testID={`status.course.${course.code}`}>
        {model.word}
      </StatusChip>
    ) : (
      <Text testID={`status.course.${course.code}`} size="bodyMedium" weight="medium" tabular numberOfLines={1} style={{ color: v.muted, flexShrink: 0 }}>
        {model.word}
      </Text>
    )
  ) : undefined;
  return (
    <TileRow
      testID={`row.course.${course.code}`}
      first={first}
      leading={<CourseTile code={course.code} name={title} />}
      title={
        <Text size="bodyLarge" weight="medium" numberOfLines={2} style={{ color: v.fg, lineHeight: 21 }}>
          {title}
        </Text>
      }
      meta={factsLabel(course.code, side)}
      status={status}
      // Kuliah is the way into a course: the row opens its page (one target, one outcome).
      onPress={() => go({ screen: "course", code: course.code })}
      // The course's colour, as a long-press (the desktop's right-click on its sidebar row).
      onLongPress={() => openCourseColorPicker(course.code)}
      label={factsLabel(course.code, title, model?.label ?? side, ...metaParts(t, f, item, context))}
    />
  );
});
