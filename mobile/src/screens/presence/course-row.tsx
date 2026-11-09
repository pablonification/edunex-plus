// A course on Kuliah (round 3, after the blind reviews): one row in a white card, one target, the course's page. Its
// tile in the course's ink and tint, its name whole (it wraps: a status beside it had cut it to "Teknik Penyelesaian
// Mas…", the third review), and under it the state of its absences in plain words, the same words as on every tab: at
// risk ("Absen lewat 1×", "Jatah absen habis") in the risk's ink, as Beranda says them, the one thing on the screen that pulls the
// eye; otherwise quiet words ("Sisa 2×"). The code is on the course's page; a screen reader still hears it here, with
// the whole sentence and the next class. No meter here (its pips needed a key; the course's page draws it) and no tick.
// Words and figures are the desktop's (src/app/screens/presence.tsx).
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
import { TileRow } from "../../ui/v4-list";
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
  // A course with no words of its own (lectures over without a count): the desktop's row end.
  const side = !model && !context.signedOut ? sideText(t, group, item.health) : "";
  const risk = model && (model.tone === "red" || model.tone === "amber") ? model.tone : null;
  // The absences in words in their tone's ink, as Beranda says them (no chip: one look for one fact on every tab).
  const status = model?.word ? (
    <Text
      testID={`status.course.${course.code}`}
      size="bodyMedium"
      weight="medium"
      tabular
      numberOfLines={1}
      style={{ color: risk === "red" ? v.redFg : risk === "amber" ? v.ambFg : v.muted }}
    >
      {model.word}
    </Text>
  ) : side ? (
    <Text size="bodyMedium" tabular numberOfLines={1} style={{ color: v.muted }}>
      {side}
    </Text>
  ) : undefined;
  return (
    <TileRow
      testID={`row.course.${course.code}`}
      first={first}
      leading={<CourseTile code={course.code} name={title} />}
      title={
        <Text size="bodyLarge" weight="medium" style={{ color: v.fg, lineHeight: 21 }}>
          {title}
        </Text>
      }
      // The status where the code was: on the line under the name, the pill as wide as its words.
      meta={status}
      // Kuliah is the way into a course: the row opens its page (one target, one outcome).
      onPress={() => go({ screen: "course", code: course.code })}
      // The course's colour, as a long-press (the desktop's right-click on its sidebar row).
      onLongPress={() => openCourseColorPicker(course.code)}
      label={factsLabel(course.code, title, model?.label ?? side, ...metaParts(t, f, item, context))}
    />
  );
});
