// A course on Kuliah (direction B): a card on a grid of two, as the official app lists courses, its cover the course's
// own colour with its code and glyph where the official app has a stock picture. Under the cover, the name and the one
// fact Kuliah is for: the absences left, in words, in their tone's ink. A tap opens the course; tap and hold, its
// colour. The data and the words are the row's (./course-row.tsx).
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
import { factsLabel } from "../../ui/layout";
import { PressScale } from "../../ui/press";
import { Text } from "../../ui/text";
import { space } from "../../ui/theme";
import { CourseGlyph, useCourseTile } from "../../ui/tile";
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
  const model = context.signedOut ? null : meterModel(t, item, context.soFar);
  // A course with no words of its own (lectures over without a count): the desktop's row end.
  const side = !model && !context.signedOut ? sideText(t, group, item.health) : "";
  const risk = model && (model.tone === "red" || model.tone === "amber") ? model.tone : null;
  const status = model?.word || side;
  return (
    <PressScale
      testID={`row.course.${course.code}`}
      onPress={() => go({ screen: "course", code: course.code })}
      onLongPress={() => openCourseColorPicker(course.code)}
      accessibilityLabel={factsLabel(course.code, title, model?.label ?? side, ...metaParts(t, f, item, context))}
      style={{ flex: 1 }}
    >
      <View style={{ height: 96, borderRadius: 20, backgroundColor: tint, padding: space[3], justifyContent: "space-between" }}>
        <Text size="labelLarge" face="display" weight="bold" tabular numberOfLines={1} style={{ color: ink, letterSpacing: 0.2 }}>
          {course.code}
        </Text>
        <View style={{ alignSelf: "flex-end" }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <CourseGlyph code={course.code} name={title} size={40} />
        </View>
      </View>
      <Text size="bodyLarge" weight="medium" numberOfLines={2} style={{ color: b.fg, lineHeight: 21, marginTop: space[2] }}>
        {title}
      </Text>
      {status ? (
        <Text
          testID={`status.course.${course.code}`}
          size="bodyMedium"
          weight={risk ? "medium" : undefined}
          tabular
          numberOfLines={1}
          style={{ color: risk === "red" ? b.red : risk === "amber" ? b.amber : b.muted, marginTop: 2 }}
        >
          {status}
        </Text>
      ) : null}
    </PressScale>
  );
});
