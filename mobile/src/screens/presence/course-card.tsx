// A course on Kuliah (the super-app round): one block the page's width, in the course's own colour, so the name is
// whole on up to two lines at font size 1.3 (two across cut "Teknik Penyelesaian Masalah Terstruktur" to three). Under
// the name, the one thing Kuliah is for, whole: the absences as pips (one per absence allowed, the used ones filled:
// "2 of 3 used" shows without words) and the state in a few words, in the app's one absence colouring (red past the
// limit, amber at it, calm otherwise). The code sits quietly at the line's end. A tap opens the course on its
// material; tap and hold, its colour. The data and the words are the desktop's (src/app/screens/presence.tsx).
import { memo } from "react";
import { View } from "react-native";
import type { CourseAttendance } from "../../../../src/app/attendance";
import { useFormat, useT } from "../../../../src/app/i18n";
import { useCourseNames } from "../../../../src/app/schedule-data";
import type { PresenceGroup } from "../../../../src/core/attendance";
import { useNav } from "../../nav";
import { AttendanceMeter, meterModel } from "../../parts/attendance-meter";
import { openCourseColorPicker } from "../../parts/course-color-picker";
import { useB } from "../../ui/b";
import { factsLabel } from "../../ui/layout";
import { Tap } from "../../ui/moves";
import { Text } from "../../ui/text";
import { space } from "../../ui/theme";
import { useCourseTile } from "../../ui/tile";
import { metaParts, type RowContext, sideText } from "./logic";

export const CourseCard = memo(function CourseCard({ item, group, context }: { item: CourseAttendance; group: PresenceGroup; context: RowContext }) {
  const t = useT();
  const f = useFormat();
  const b = useB();
  const { go } = useNav();
  const name = useCourseNames();
  const { course } = item;
  const title = name(course.code, course.name);
  const { ink, tint } = useCourseTile()(course.code);
  // Without SIX nothing is counted: Kuliah says so once, at the top, and a course keeps its name and code.
  const model = context.signedOut ? null : meterModel(t, item, context.soFar);
  // A course with no words of its own (lectures over without a count): the desktop's row end.
  const side = !model && !context.signedOut ? sideText(t, group, item.health) : "";
  return (
    <Tap
      feel="card"
      testID={`row.course.${course.code}`}
      onPress={() => go({ screen: "course", code: course.code })}
      onLongPress={() => openCourseColorPicker(course.code)}
      accessibilityLabel={factsLabel(course.code, title, model?.label ?? side, ...metaParts(t, f, item, context))}
      style={{ borderRadius: 16, backgroundColor: tint, paddingVertical: 10, paddingHorizontal: space[4], minHeight: 64, justifyContent: "center" }}
    >
      <Text size="bodyLarge" weight="semibold" numberOfLines={2} style={{ color: b.fg, lineHeight: 21 }}>
        {title}
      </Text>
      {/* The status never shrinks or cuts: when the line is too narrow (font size 1.3), the code drops under it. */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space[3], rowGap: 2, marginTop: 4 }}>
        {model ? (
          <AttendanceMeter model={model} hideLabel testID={`status.course.${course.code}`} />
        ) : side ? (
          <Text testID={`status.course.${course.code}`} size="bodyMedium" tabular style={{ color: b.fg2 }}>
            {side}
          </Text>
        ) : null}
        <Text size="bodyMedium" weight="medium" tabular style={{ color: ink, marginLeft: "auto" }}>
          {course.code}
        </Text>
      </View>
    </Tap>
  );
});
