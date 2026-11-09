// A course on Kuliah (round 3): one row in a white card, one target, the course's page. Its tile in the course's ink and
// tint, its name on the row's whole width (two lines at most), and under it one line: what's left of its absences as a
// meter with one word or number ("sisa 1×", "habis", "+2") in the risk's tone, then its code, and a quiet tick once SIX
// has counted today's class. The next class, the share and the one exception are on the course page; a screen reader
// still hears the whole sentence and the next class here. Words and figures are the desktop's
// (src/app/screens/presence.tsx).
import { memo } from "react";
import { View } from "react-native";
import type { CourseAttendance } from "../../../../src/app/attendance";
import { useFormat, useT } from "../../../../src/app/i18n";
import { useCourseNames } from "../../../../src/app/schedule-data";
import type { PresenceGroup } from "../../../../src/core/attendance";
import { useNav } from "../../nav";
import { AttendanceMeter, meterModel } from "../../parts/attendance-meter";
import { openCourseColorPicker } from "../../parts/course-color-picker";
import { Icons } from "../../ui/icons";
import { factsLabel } from "../../ui/layout";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { CourseTile } from "../../ui/tile";
import { TileRow } from "../../ui/v4-list";
import { metaParts, type RowContext, sideText } from "./logic";

export const CourseRow = memo(function CourseRow({
  item,
  group,
  context,
  first,
  counted,
}: {
  item: CourseAttendance;
  group: PresenceGroup;
  context: RowContext;
  first: boolean;
  /** SIX counted today's class ("late": after it first looked missing), or not today. */
  counted: "onTime" | "late" | null;
}) {
  const t = useT();
  const f = useFormat();
  const v = useTheme().v4;
  const { go } = useNav();
  const name = useCourseNames();
  const { course } = item;
  const title = name(course.code, course.name);
  const model = context.signedOut ? null : meterModel(t, item, context.soFar);
  // A course with no meter (lectures over without a count, Edunex alone): its own few words, as the desktop's row ends.
  const side = !model && !context.signedOut ? sideText(t, group, item.health) : "";
  const tick = counted ? t(counted === "late" ? "mobile.kuliah.countedLate" : "mobile.kuliah.counted") : null;
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
      meta={
        <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
          {model && <AttendanceMeter model={model} hideLabel testID={`meter.course.${course.code}`} />}
          <Text size="bodyMedium" tabular numberOfLines={1} style={{ color: v.muted, flexShrink: 1 }}>
            {model ? course.code : factsLabel(course.code, side)}
          </Text>
          {counted && (
            <View testID={`mark.counted.${course.code}`}>
              <Icons.CheckCircle size={14} weight="fill" color={v.okFg} />
            </View>
          )}
        </View>
      }
      // Kuliah is the way into a course: the row opens its page (one target, one outcome).
      onPress={() => go({ screen: "course", code: course.code })}
      // The course's colour, as a long-press (the desktop's right-click on its sidebar row).
      onLongPress={() => openCourseColorPicker(course.code)}
      label={factsLabel(course.code, title, model?.label ?? side, ...metaParts(t, f, item, context), tick)}
    />
  );
});
