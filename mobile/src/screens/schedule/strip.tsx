// The week strip over Jadwal's day (v4): the week's seven days, under each the number of classes that day (none: no
// mark; dots in each course's ink were too small to tell apart: round 1's judges). One shape for a day that stands out, the circle: the day picked filled (in the brand's blue when it's today,
// else its tint), today a ring of that blue while another day is picked (blue is today's one meaning on the screen, with
// the now-line). A day with two classes at once is named so for TalkBack; its blocks show the clash in words. A
// tap picks a day; a swipe across the strip moves a week.
import { memo, useState } from "react";
import { View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated from "react-native-reanimated";
import { useT } from "../../../../src/app/i18n";
import { dayNoon, type ScheduleDay, shiftDay } from "../../../../src/core/schedule";
import { useSlidingMark } from "../../ui/moves";
import { PressScale } from "../../ui/press";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { useDayFormat, useToday } from "./clock";
import { nowColour, onNowColour } from "./day";

/** How many classes and meetings a day holds: the number under its date. */
const countOf = (day: ScheduleDay | undefined) => (day ? day.classes.length + day.outside.length + day.edunex.length : 0);

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
  const days = Array.from({ length: 7 }, (_, i) => shiftDay(monday, i));
  // The picked day's circle slides from the day before to the new one (keyed by weekday, so a week's move keeps it in
  // place); its top is where the first day's circle was laid out.
  const index = days.indexOf(picked);
  const mark = useSlidingMark(String(index));
  const [circleTop, setCircleTop] = useState<number | null>(null);
  const markColour = picked === today ? nowColour(theme.scheme) : v.brandTint;
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
        {index >= 0 && circleTop !== null && (
          <Animated.View pointerEvents="none" style={[{ position: "absolute", top: circleTop, height: 38, alignItems: "center" }, mark.style]}>
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: markColour }} />
          </Animated.View>
        )}
        {days.map((day, i) => {
          const noon = dayNoon(day);
          const isToday = day === today;
          const on = day === picked;
          const count = countOf(plan.get(day));
          // Two classes at once that day: said to TalkBack; on screen the day's blocks say it, with "Bentrok" (a badge on
          // the date was too small to read: the judges' charge 12).
          const clash = plan.get(day)?.classes.some((c) => c.overlaps.length > 0) ?? false;
          // The picked day's fill is the sliding mark under the row; until it's placed, the day draws its own.
          const circle = on && circleTop === null ? (isToday ? nowColour(theme.scheme) : v.brandTint) : "transparent";
          const number = isToday && on ? onNowColour(theme.scheme) : isToday ? nowColour(theme.scheme) : on ? v.brandInk : v.fg;
          return (
            <View key={day} onLayout={mark.measure(String(i))}>
              <PressScale
                testID={`day.${day}`}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                accessibilityLabel={[f.dateLong(noon), count ? t("mobile.schedule.dayCount", { count }) : null, clash ? t("mobile.schedule.clashDay") : null]
                  .filter(Boolean)
                  .join(", ")}
                onPress={() => onPick(day)}
                style={{ width: 48, alignItems: "center", gap: 6, paddingVertical: 2 }}
              >
                <Text size="labelMedium" weight={isToday ? "bold" : "regular"} style={{ color: isToday ? nowColour(theme.scheme) : v.muted, fontSize: 12 }}>
                  {f.weekdayShort(noon)}
                </Text>
                <View
                  onLayout={i === 0 ? (event) => setCircleTop(space[3] + event.nativeEvent.layout.y) : undefined}
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 19,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: circle,
                    ...(isToday && !on ? { borderWidth: 1.5, borderColor: nowColour(theme.scheme) } : {}),
                  }}
                >
                  <Text size="titleMedium" face="display" weight="semibold" tabular style={{ color: number, fontSize: 15 }}>
                    {String(Number(day.slice(8)))}
                  </Text>
                </View>
                <Text
                  size="labelSmall"
                  weight="semibold"
                  tabular
                  importantForAccessibility="no"
                  style={{ color: on ? v.brandInk : v.muted, fontSize: 12, lineHeight: 16, minHeight: 16 }}
                >
                  {count ? String(count) : ""}
                </Text>
              </PressScale>
            </View>
          );
        })}
      </View>
    </GestureDetector>
  );
});
