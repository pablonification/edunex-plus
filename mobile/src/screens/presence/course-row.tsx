// A course on Kuliah (round 4): one card in the grid, two across, filled with the course's own colour, so the tab is
// the courses themselves and is told apart from Tugas' list at a glance. Its glyph in the course's ink, its short name
// (two lines at most), and at its foot what's left of its absences as a picture: a dot per absence the target allows,
// the used ones filled, with "used/allowed" beside them. A course at or past its limit takes the risk's ink (red or
// amber) on its dots and says its one name ("Jatah absen habis", "Lewat jatah absen 1×"); a safe one needs no word.
// The card opens the course; tap and hold for its colour. A screen reader hears the whole name, then the absences in
// words and the next class, as the row said them. Figures and words are the desktop's (src/app/screens/presence.tsx).
import { memo } from "react";
import { View } from "react-native";
import type { CourseAttendance } from "../../../../src/app/attendance";
import { useFormat, useT } from "../../../../src/app/i18n";
import { useCourseNames } from "../../../../src/app/schedule-data";
import type { PresenceGroup } from "../../../../src/core/attendance";
import { useNav } from "../../nav";
import { type MeterModel, meterModel } from "../../parts/attendance-meter";
import { openCourseColorPicker } from "../../parts/course-color-picker";
import { meterMarks } from "../../parts/meter-marks";
import { Icons } from "../../ui/icons";
import { factsLabel } from "../../ui/layout";
import { PressScale } from "../../ui/press";
import { Text } from "../../ui/text";
import { useTheme } from "../../ui/theme";
import { CourseGlyph, useCourseTile } from "../../ui/tile";
import { shortName } from "../home/parts";
import { cardFill, metaParts, type RowContext, sideText } from "./logic";

/** The card's least height: the glyph, two lines of name and the dots, so a row of two lines up at any name. */
export const CARD_HEIGHT = 136;

export const CourseCard = memo(function CourseCard({ item, group, context }: { item: CourseAttendance; group: PresenceGroup; context: RowContext }) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const v = theme.v4;
  const { go } = useNav();
  const name = useCourseNames();
  const tile = useCourseTile()(item.course.code);
  const { course } = item;
  const title = name(course.code, course.name);
  const model = context.signedOut ? null : meterModel(t, item, context.soFar);
  // A course with no picture of its own (lectures over without a count): the desktop's row end, in words.
  const side = !model && !context.signedOut ? sideText(t, group, item.health) : "";
  return (
    <PressScale
      testID={`row.course.${course.code}`}
      // Kuliah is the way into a course: the card opens its page (one target, one outcome).
      onPress={() => go({ screen: "course", code: course.code })}
      // The course's colour, as a long-press (the desktop's right-click on its sidebar row).
      onLongPress={() => openCourseColorPicker(course.code)}
      accessibilityLabel={factsLabel(course.code, title, model?.label ?? side, ...metaParts(t, f, item, context))}
      style={{ flex: 1, minHeight: CARD_HEIGHT, borderRadius: 20, padding: 14, gap: 10, backgroundColor: cardFill(tile, theme.scheme) }}
    >
      <CourseGlyph code={course.code} name={title} size={28} />
      <Text size="bodyLarge" face="display" weight="bold" numberOfLines={2} style={{ color: v.fg, lineHeight: 21, flex: 1 }}>
        {shortName(title)}
      </Text>
      {model ? (
        <CardMeter model={model} ink={tile.ink} code={course.code} />
      ) : side ? (
        <Text size="bodyMedium" weight="medium" tabular numberOfLines={2} style={{ color: v.fg }}>
          {side}
        </Text>
      ) : null}
    </PressScale>
  );
});

/**
 * A card's foot: the dots and "used/allowed" in the course's ink when it's safe, in the risk's ink at or past the
 * limit, with the risk's one name under them. A finished course: its mark and its share. Read in the card's own label.
 */
function CardMeter({ model, ink, code }: { model: MeterModel; ink: string; code: string }) {
  const v = useTheme().v4;
  const risk = model.tone === "red" ? v.redFg : model.tone === "amber" ? v.ambFg : null;
  const color = risk ?? ink;
  const { bar } = model;
  const marks = meterMarks(bar);
  const word = model.word && (risk || !bar || bar.estimate) && (
    <Text testID={risk ? `status.course.${code}` : undefined} size="bodyMedium" weight="semibold" tabular numberOfLines={2} style={{ color: risk ?? v.fg }}>
      {model.word}
    </Text>
  );
  if (model.final)
    return (
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        {model.final.met ? <Icons.CheckCircle size={16} weight="fill" color={ink} /> : <Icons.AlertTriangle size={16} weight="fill" color={color} />}
        <View style={{ flex: 1 }}>{word}</View>
      </View>
    );
  if (!bar || !marks) return word || null;
  const H = 8;
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1, flexWrap: "wrap" }}>
          {marks.allowed > 0 &&
            (marks.joined ? (
              <View style={{ width: 72, height: H, borderRadius: H / 2, borderWidth: 1.5, borderColor: color, overflow: "hidden" }}>
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
                    width: 12,
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
                <View key={i} style={{ width: 12, height: H, borderRadius: H / 2, backgroundColor: v.redFg }} />
              ))}
            </>
          )}
        </View>
        {!bar.estimate && (
          <Text size="bodyMedium" face="display" weight="bold" tabular style={{ color: risk ?? v.fg }}>
            {`${bar.used + bar.over}/${bar.allowed}`}
          </Text>
        )}
      </View>
      {word}
    </View>
  );
}
