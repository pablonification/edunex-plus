// A course on Kuliah (round 4, after the blind reviews of the grid): one row in the list's white card, one target, the
// course's page. Its tile (the course's colour and glyph), its name as every list shows it (two lines at most, wrapped
// at a word), and at the row's end its absences as a picture: a dot per absence the target allows, the used ones filled,
// past the limit a short line then a red dot per absence over it. The dots carry the state: red past the limit, amber
// with none left, the course's ink when safe. The count isn't written ("4/3" needed a key); only a course at risk says
// one short state under its name ("Habis", "Lewat batas 1×") in the risk's ink. A screen reader hears the whole name,
// the absences in words with the full count, and the next class. Figures and words are the desktop's
// (src/app/screens/presence.tsx).
import { memo } from "react";
import { View } from "react-native";
import type { CourseAttendance } from "../../../../src/app/attendance";
import { useFormat, useT } from "../../../../src/app/i18n";
import { useCourseNames } from "../../../../src/app/schedule-data";
import { absenceBudget, type PresenceGroup } from "../../../../src/core/attendance";
import { useNav } from "../../nav";
import { type MeterModel, meterModel } from "../../parts/attendance-meter";
import { openCourseColorPicker } from "../../parts/course-color-picker";
import { meterMarks } from "../../parts/meter-marks";
import { GroupRow } from "../../ui/group";
import { Icons } from "../../ui/icons";
import { factsLabel } from "../../ui/layout";
import { Text } from "../../ui/text";
import { useTheme } from "../../ui/theme";
import { CourseTile, useCourseTile } from "../../ui/tile";
import { metaParts, type RowContext, sideText } from "./logic";

/** "habis" → "Habis": the words stand alone under the name. */
const lead = (words: string) => words.charAt(0).toLocaleUpperCase() + words.slice(1);

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
  const tile = useCourseTile()(item.course.code);
  const { course, health } = item;
  const title = name(course.code, course.name);
  const model = context.signedOut ? null : meterModel(t, item, context.soFar);
  // A course with no picture of its own (lectures over without a count): the desktop's row end, in quiet words.
  const side = !model && !context.signedOut ? sideText(t, group, health) : "";
  const risk = model?.tone === "red" ? v.redFg : model?.tone === "amber" ? v.ambFg : null;
  // At risk: the one short state, the key number only. Without a picture (Edunex's tally): its words, quiet.
  const budget = absenceBudget(health);
  const state = risk
    ? model?.final
      ? model.word
      : budget && budget.over > 0
        ? lead(t("presence.bar.over", { count: budget.over }))
        : budget && budget.left === 0
          ? lead(t("presence.bar.noneLeft"))
          : model?.word
    : model && !model.bar && !model.final
      ? model.word
      : side;
  const meta = state ? (
    <Text
      testID={model ? `status.course.${course.code}` : undefined}
      size="bodyMedium"
      weight={risk ? "semibold" : undefined}
      tabular
      numberOfLines={1}
      style={{ color: risk ?? v.muted }}
    >
      {state}
    </Text>
  ) : undefined;
  return (
    <GroupRow
      testID={`row.course.${course.code}`}
      first={first}
      leading={<CourseTile code={course.code} name={title} />}
      title={
        <Text size="bodyLarge" weight="medium" numberOfLines={2} style={{ color: v.fg, lineHeight: 21 }}>
          {title}
        </Text>
      }
      meta={meta}
      trailing={model ? <Dots model={model} color={risk ?? tile.ink} ink={tile.ink} /> : undefined}
      // Kuliah is the way into a course: the row opens its page (one target, one outcome).
      onPress={() => go({ screen: "course", code: course.code })}
      // The course's colour, as a long-press (the desktop's right-click on its sidebar row).
      onLongPress={() => openCourseColorPicker(course.code)}
      accessibilityLabel={factsLabel(course.code, title, model?.label ?? side, ...metaParts(t, f, item, context))}
    />
  );
});

const H = 8;
const W = 10;

/**
 * The row's end: the dots alone, in `color` (the risk's ink, else the course's). A finished course: a mark instead
 * (met in the course's ink, below in red). Hidden from a screen reader: the row's label says it in words.
 */
function Dots({ model, color, ink }: { model: MeterModel; color: string; ink: string }) {
  const v = useTheme().v4;
  const { bar } = model;
  const marks = meterMarks(bar);
  const hidden = { accessibilityElementsHidden: true, importantForAccessibility: "no-hide-descendants" as const };
  if (model.final)
    return (
      <View {...hidden}>
        {model.final.met ? <Icons.CheckCircle size={20} weight="fill" color={ink} /> : <Icons.AlertTriangle size={20} weight="fill" color={v.redFg} />}
      </View>
    );
  if (!bar || !marks) return null;
  return (
    <View {...hidden} style={{ flexDirection: "row", alignItems: "center", gap: 3, flexShrink: 0 }}>
      {marks.allowed > 0 &&
        (marks.joined ? (
          <View style={{ width: 56, height: H, borderRadius: H / 2, borderWidth: 1.5, borderColor: color, overflow: "hidden" }}>
            {!bar.estimate && bar.used > 0 && (
              <View style={{ width: `${(Math.min(bar.used, bar.allowed) / bar.allowed) * 100}%`, height: "100%", backgroundColor: color }} />
            )}
          </View>
        ) : (
          Array.from({ length: marks.allowed }, (_, i) => (
            <View
              // biome-ignore lint/suspicious/noArrayIndexKey: dots are positions, nothing else tells them apart
              key={i}
              style={{
                width: W,
                height: H,
                borderRadius: H / 2,
                ...(!bar.estimate && i < bar.used
                  ? { backgroundColor: color }
                  : { borderWidth: 1.5, borderColor: color, ...(bar.estimate ? { borderStyle: "dashed" as const } : {}) }),
              }}
            />
          ))
        ))}
      {marks.over > 0 && (
        <>
          <View style={{ width: 2, height: H + 6, borderRadius: 1, backgroundColor: v.fg, marginHorizontal: 1 }} />
          {Array.from({ length: marks.over }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: dots are positions, nothing else tells them apart
            <View key={i} style={{ width: W, height: H, borderRadius: H / 2, backgroundColor: v.redFg }} />
          ))}
        </>
      )}
    </View>
  );
}
