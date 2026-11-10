// A course on Kuliah (the super-app round): one block the page's width, in the course's own colour, so the name is
// whole on up to two lines at font size 1.3. Under the name, the one thing Kuliah is for, readable without a key: the
// state in the app's own words and one absence colouring (red past the limit, amber at it, calm otherwise; the same
// words Beranda's strip counts), then the count once, in words ("2 dari 3 absen": used of allowed). No pips: round 1's
// judges had to learn them. At its end the chevron every row that opens has. The code isn't drawn (the course's
// colour on its own tint failed contrast, and beside the count it pushed the status onto a second line): a screen
// reader still hears it, and it is the title of the course's page. A tap opens the course on its material; tap and
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
import { space, useTheme } from "../../ui/theme";
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
  const v = useTheme().v4;
  const { tint } = useCourseTile()(course.code);
  // Without SIX nothing is counted: Kuliah says so once, at the top, and a course keeps its name and code.
  const model = context.signedOut ? null : meterModel(t, item, context.soFar);
  // A course with no words of its own (lectures over without a count): the desktop's row end.
  const side = !model && !context.signedOut ? sideText(t, group, item.health) : "";
  const ink = model?.tone === "red" ? v.redFg : model?.tone === "amber" ? v.ambFg : model?.tone === "ok" ? v.okFg : b.fg2;
  // Used of allowed, once, in words. Before SIX counts (an estimate) there is nothing used to say.
  const bar = model?.bar && !model.bar.estimate ? model.bar : null;
  const count = bar && bar.allowed > 0 ? t("mobile.kuliah.absences", { used: bar.used + bar.over, allowed: bar.allowed }) : null;
  const word = model?.word ?? (model ? model.label : side);
  return (
    <Tap
      feel="card"
      testID={`row.course.${course.code}`}
      onPress={() => go({ screen: "course", code: course.code })}
      onLongPress={() => openCourseColorPicker(course.code)}
      accessibilityLabel={factsLabel(course.code, title, model?.label ?? side, ...metaParts(t, f, item, context))}
      style={{
        borderRadius: 20,
        backgroundColor: tint,
        paddingVertical: space[2],
        paddingLeft: space[4],
        paddingRight: space[3],
        minHeight: 64,
        flexDirection: "row",
        alignItems: "center",
        gap: space[2],
      }}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text size="bodyLarge" weight="semibold" style={{ color: b.fg, lineHeight: 21 }}>
          {title}
        </Text>
        {/* The state, then the count: neither shrinks or cuts; on a narrow line (font size 1.3) the count drops under. */}
        {word ? (
          <View
            testID={`status.course.${course.code}`}
            style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space[2], marginTop: 4 }}
          >
            <Text size="bodyMedium" weight="semibold" tabular style={{ color: ink }}>
              {word}
            </Text>
            {count && (
              <Text size="bodyMedium" tabular style={{ color: b.fg2 }}>
                {count}
              </Text>
            )}
          </View>
        ) : null}
      </View>
      <Icons.ChevronRight size={18} color={b.fg2} />
    </Tap>
  );
});
