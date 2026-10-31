// The week strip over Jadwal's agenda: the seven days of the week the agenda is at, the day at the top of the list
// picked, today in the primary colour, a dot under each day that holds something. It follows the list as it scrolls
// (the list says which day is at its top through a little store, so only the strip draws again), and a day tapped,
// the arrows or "Hari ini" move the list. The term's week and its dates name it between the arrows.
import { memo, useSyncExternalStore } from "react";
import { Pressable, View } from "react-native";
import { useT } from "../../../../src/app/i18n";
import type { ScheduleData } from "../../../../src/app/schedule-data";
import { dayNoon, isEmptyDay, type ScheduleDay, shiftDay, termWeek, weekStart } from "../../../../src/core/schedule";
import { Button, IconButton } from "../../ui/controls";
import { Icons } from "../../ui/icons";
import { Text } from "../../ui/text";
import { shape, space, TOUCH, useTheme } from "../../ui/theme";
import { useDayFormat, useToday } from "./clock";

/** The day at the top of the agenda: set by the list as it scrolls, read by the strip. */
export function topDayStore(initial: string) {
  let day = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => day,
    set(next: string) {
      if (next === day) return;
      day = next;
      for (const listener of listeners) listener();
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}
export type TopDay = ReturnType<typeof topDayStore>;

/** A day of ITB's calendar without lectures (an exam week, a holiday): tinted in the strip. */
const NO_LECTURES = new Set(["uts", "uas", "holiday"]);
const offDay = (day: ScheduleDay | undefined) => day?.events.some((e) => NO_LECTURES.has(e.kind)) ?? false;

export const WeekStrip = memo(function WeekStrip({
  top,
  plan,
  input,
  onGo,
}: {
  top: TopDay;
  /** Every day the agenda covers, by date. */
  plan: ReadonlyMap<string, ScheduleDay>;
  input: ScheduleData;
  /** Brings `day` to the top of the list. */
  onGo: (day: string) => void;
}) {
  const t = useT();
  const f = useDayFormat();
  const theme = useTheme();
  const c = theme.color;
  const today = useToday();
  const picked = useSyncExternalStore(top.subscribe, top.get);
  const monday = weekStart(picked);
  const days = Array.from({ length: 7 }, (_, i) => shiftDay(monday, i));
  const n = termWeek(input.events, monday);
  const range = f.dayRange(days[0]!, days[6]!);
  const name = n ? t("schedule.weekOf", { n, range }) : range;
  const first = plan.size ? [...plan.keys()][0]! : monday;
  const last = plan.size ? [...plan.keys()][plan.size - 1]! : monday;
  const awayFromToday = weekStart(today) !== monday;
  return (
    <View style={{ backgroundColor: c.surface, paddingHorizontal: space[1], paddingBottom: space[2] }} testID="strip.week">
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <IconButton label={t("schedule.prevWeek")} onPress={() => onGo(shiftDay(monday, -7) < first ? first : shiftDay(monday, -7))} testID="action.prevWeek">
          <Icons.ChevronLeft size={22} color={c.onSurfaceVariant} />
        </IconButton>
        <Text
          size="titleSmall"
          tabular
          accessibilityLiveRegion="polite"
          testID="label.place"
          style={{ flex: 1, textAlign: awayFromToday ? "left" : "center", marginLeft: awayFromToday ? space[1] : 0 }}
          numberOfLines={1}
        >
          {name}
        </Text>
        {/* The way back, only once the list has left today's week. */}
        {awayFromToday && (
          <Button size="sm" variant="tonal" onPress={() => onGo(today)} label={t("mobile.schedule.todayLabel")} testID="action.today">
            {t("mobile.schedule.today")}
          </Button>
        )}
        <IconButton label={t("schedule.nextWeek")} onPress={() => onGo(shiftDay(monday, 7) > last ? monday : shiftDay(monday, 7))} testID="action.nextWeek">
          <Icons.ChevronRight size={22} color={c.onSurfaceVariant} />
        </IconButton>
      </View>
      <View style={{ flexDirection: "row", paddingHorizontal: space[2] }} accessibilityRole="tablist">
        {days.map((day, i) => {
          const noon = dayNoon(day);
          const on = day === picked;
          const isToday = day === today;
          const info = plan.get(day);
          const off = offDay(info);
          // One band behind a run of ITB's days off: rounded only where the run starts and ends.
          const opens = off && !(i > 0 && offDay(plan.get(days[i - 1]!)));
          const closes = off && !(i < 6 && offDay(plan.get(days[i + 1]!)));
          return (
            <Pressable
              key={day}
              testID={`day.${day}`}
              onPress={() => onGo(day)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={f.dateLong(noon)}
              style={{
                flex: 1,
                alignItems: "center",
                minHeight: TOUCH + space[4],
                paddingVertical: space[1],
                borderTopLeftRadius: opens ? shape.lg : 0,
                borderBottomLeftRadius: opens ? shape.lg : 0,
                borderTopRightRadius: closes ? shape.lg : 0,
                borderBottomRightRadius: closes ? shape.lg : 0,
                backgroundColor: off ? c.tertiaryContainer : undefined,
              }}
            >
              <Text size="labelMedium" style={{ color: isToday ? c.primary : off ? c.onTertiaryContainer : c.onSurfaceVariant }}>
                {f.weekdayShort(noon)}
              </Text>
              <View
                style={{
                  marginTop: 2,
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: isToday ? c.primary : on ? c.secondaryContainer : undefined,
                }}
              >
                <Text
                  size="titleMedium"
                  tabular
                  style={{ color: isToday ? c.onPrimary : on ? c.onSecondaryContainer : off ? c.onTertiaryContainer : c.onSurface }}
                >
                  {String(Number(day.slice(8)))}
                </Text>
              </View>
              <View
                style={{
                  marginTop: 3,
                  width: 5,
                  height: 5,
                  borderRadius: 3,
                  backgroundColor: info && !isEmptyDay(info) ? c.onSurfaceVariant : "transparent",
                }}
              />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});
