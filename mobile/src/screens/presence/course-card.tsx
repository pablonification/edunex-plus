// A course on Kuliah (round 3 of the super-app): a flat row on the page. It leads with the course's own glyph in its
// colour, then the name whole on up to two lines and, under it, the one thing Kuliah is for, said once: the absences
// as dots with one short label (./absence-dots.tsx: "sisa 1", "habis", "lewat 1"). The state's colour is on the dots
// and the label only; the row itself is calm. At its end the chevron every row that opens has. The code isn't drawn:
// a screen reader still hears it, and it sits under the name on the course's page. A tap opens the course; tap and
// hold, its colour. The data and the words are the desktop's (src/app/screens/presence.tsx).
import { memo } from "react";
import { View } from "react-native";
import type { CourseAttendance } from "../../../../src/app/attendance";
import { useFormat, useT } from "../../../../src/app/i18n";
import { useCourseNames } from "../../../../src/app/schedule-data";
import type { PresenceGroup } from "../../../../src/core/attendance";
import { useNav } from "../../nav";
import { meterModel } from "../../parts/attendance-meter";
import { openCourseColorPicker } from "../../parts/course-color-picker";
import { useB } from "../../ui/b";
import { Icons } from "../../ui/icons";
import { factsLabel } from "../../ui/layout";
import { Tap } from "../../ui/moves";
import { Text } from "../../ui/text";
import { space } from "../../ui/theme";
import { CourseTile } from "../../ui/tile";
import { AbsenceDots, absenceShort } from "./absence-dots";
import { metaParts, type RowContext, sideText } from "./logic";

export const CourseCard = memo(function CourseCard({ item, group, context }: { item: CourseAttendance; group: PresenceGroup; context: RowContext }) {
  const t = useT();
  const f = useFormat();
  const b = useB();
  const { go } = useNav();
  const name = useCourseNames();
  const { course } = item;
  const title = name(course.code, course.name);
  // Without SIX nothing is counted: Kuliah says so once, at the top, and a course keeps its name.
  const model = context.signedOut ? null : meterModel(t, item, context.soFar);
  // A course with no words of its own (lectures over without a count): the desktop's row end.
  const side = !model && !context.signedOut ? sideText(t, group, item.health) : "";
  return (
    <Tap
      feel="row"
      testID={`row.course.${course.code}`}
      onPress={() => go({ screen: "course", code: course.code })}
      onLongPress={() => openCourseColorPicker(course.code)}
      accessibilityLabel={factsLabel(course.code, title, model?.label ?? side, ...metaParts(t, f, item, context))}
      style={{ minHeight: 64, paddingVertical: space[2], flexDirection: "row", alignItems: "center", gap: space[3] }}
    >
      <CourseTile code={course.code} name={course.name} size={40} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size="bodyLarge" weight="semibold" numberOfLines={2} style={{ color: b.fg, lineHeight: 21 }}>
          {title}
        </Text>
        {model ? (
          <View style={{ marginTop: 4 }}>
            <AbsenceDots model={model} label={absenceShort(t, model)} testID={`status.course.${course.code}`} />
          </View>
        ) : side ? (
          <Text testID={`status.course.${course.code}`} size="bodyMedium" style={{ color: b.fg2, marginTop: 2 }}>
            {side}
          </Text>
        ) : null}
      </View>
      <Icons.ChevronRight size={18} color={b.fg2} />
    </Tap>
  );
});
