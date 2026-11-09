// The week strip over Jadwal's day (v4): the week's seven days, a dot under each in the ink of every course that meets
// that day, today in the brand's blue (its one meaning on the screen, with the now-line), the day picked, when it isn't today, in the
// brand's tint, and an amber mark on a day with two classes at once. A tap picks a day; a swipe across the strip moves a
// week.
import { memo } from "react";
import { View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import { useCourseColor } from "../../../../src/app/courses";
import { useT } from "../../../../src/app/i18n";
import { dayNoon, type ScheduleDay, shiftDay } from "../../../../src/core/schedule";
import { PressScale } from "../../ui/press";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { useDayFormat, useToday } from "./clock";
import { nowColour, onNowColour } from "./day";

/** The courses meeting on a day, each once, in time order: their dots. */
const codesOf = (day: ScheduleDay | undefined) =>
  day
    ? [
        ...new Set(
          [...day.classes.map((c) => ({ code: c.session.courseCode, start: c.session.start })), ...day.outside, ...day.edunex]
            .sort((a, b) => a.start - b.start)
            .map((one) => one.code),
        ),
      ]
    : [];

export const WeekStrip = memo(function WeekStrip({
  monday,
  picked,
  plan,
  onPick,
  onWeek,
}: {
  monday: string;
  picked: string;
  plan: ReadonlyMap<string, ScheduleDay>;
  onPick: (day: string) => void;
  /** A week on (1) or back (-1). */
  onWeek: (by: number) => void;
}) {
  const t = useT();
  const f = useDayFormat();
  const theme = useTheme();
  const v = theme.v4;
  const today = useToday();
  const colour = useCourseColor();
  const days = Array.from({ length: 7 }, (_, i) => shiftDay(monday, i));
  const swipe = usePanGesture({
    activeOffsetX: [-24, 24],
    failOffsetY: [-16, 16],
    runOnJS: true,
    onDeactivate: (event) => {
      if (event.canceled) return;
      if (event.translationX <= -48) onWeek(1);
      else if (event.translationX >= 48) onWeek(-1);
    },
  });
  return (
    <GestureDetector gesture={swipe}>
      <View
        collapsable={false}
        testID="strip.week"
        accessibilityRole="tablist"
        style={{ flexDirection: "row", justifyContent: "space-between", paddingHorizontal: space[2], paddingTop: space[3], paddingBottom: 10 }}
      >
        {days.map((day) => {
          const noon = dayNoon(day);
          const isToday = day === today;
          const on = day === picked;
          const codes = codesOf(plan.get(day)).slice(0, 4);
          // Two classes at once that day: an amber mark on its date, as the blocks and the gutter show it on the day.
          const clash = plan.get(day)?.classes.some((c) => c.overlaps.length > 0) ?? false;
          const circle = isToday && on ? nowColour(theme.scheme) : on ? v.brandTint : "transparent";
          const number = isToday && on ? onNowColour(theme.scheme) : isToday ? nowColour(theme.scheme) : on ? v.brandInk : v.fg;
          return (
            <PressScale
              key={day}
              testID={`day.${day}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={clash ? `${f.dateLong(noon)}, ${t("mobile.schedule.clashDay")}` : f.dateLong(noon)}
              onPress={() => onPick(day)}
              style={{ width: 48, alignItems: "center", gap: 6, paddingVertical: 2 }}
            >
              <Text size="labelMedium" weight={isToday ? "bold" : "regular"} style={{ color: isToday ? nowColour(theme.scheme) : v.muted, fontSize: 12 }}>
                {f.weekdayShort(noon)}
              </Text>
              <View style={{ width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: circle }}>
                <Text size="titleMedium" face="display" weight="semibold" tabular style={{ color: number, fontSize: 15 }}>
                  {String(Number(day.slice(8)))}
                </Text>
                {clash && (
                  <View
                    testID={`mark.clashDay.${day}`}
                    style={{
                      position: "absolute",
                      top: 0,
                      right: 0,
                      width: 10,
                      height: 10,
                      borderRadius: 5,
                      backgroundColor: v.ambFg,
                      borderWidth: 2,
                      borderColor: v.page,
                    }}
                  />
                )}
              </View>
              <View style={{ flexDirection: "row", gap: 3, height: 5 }}>
                {codes.map((code) => (
                  <View key={code} style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: theme.courseTile(colour(code)).ink }} />
                ))}
              </View>
            </PressScale>
          );
        })}
      </View>
    </GestureDetector>
  );
});
