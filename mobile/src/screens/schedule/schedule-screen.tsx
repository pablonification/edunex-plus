// Jadwal (round 2, v4: mobile/design/r2-directions/v4, "v4-jadwal"): where am I next, and what's this week like. The
// month is the screen's one title, the term's week quietly under it; the week strip with each day's courses as dots,
// today in the brand's blue; then the day picked (today first) as hours with each class a block in its course's tint,
// the now-line in the same blue. A swipe across the day moves a day, across the strip a week. A class opens Beranda's
// class sheet (one sheet for a class, wherever it's opened); a hand-in, a deadline or a meeting only Edunex announced
// opens its own (./details.tsx).
// The month is the top bar's calendar button; the reminder before class, the phone's calendar and the .ics are in ⋮.
// Data and reasoning are the desktop's (scheduleDays over the same input); the minute's tick reaches only the now-line
// and the block on now (./clock.ts).
import * as Notifications from "expo-notifications";
import { router, useIsFocused, useScrollToTop } from "expo-router";
import { type ComponentRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Linking, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, { FadeInLeft, FadeInRight } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTermCourses } from "../../../../src/app/courses";
import { useClock, useLang, useT } from "../../../../src/app/i18n";
import { useBridge, useSettings, useStatus } from "../../../../src/app/store";
import { wibDay } from "../../../../src/core/course-meetings";
import { isEmptyDay, minuteOfDay, type ScheduleDay, scheduleDays, shiftDay, termWeek, weekStart } from "../../../../src/core/schedule";
import { useParam } from "../../nav";
import { SixPageNote, useChangedPage } from "../../parts/six-page-note";
import { usePerfDrawn } from "../../perf";
import { StatusLine, SyncPanel, TabActions, useSignIn, useSyncText } from "../../shell/source-status";
import { toast } from "../../swaps/overlays";
import { Button } from "../../ui/controls";
import { Skeleton } from "../../ui/display";
import { Rise } from "../../ui/expressive";
import { Icons } from "../../ui/icons";
import { Notice } from "../../ui/layout";
import { OverflowMenu } from "../../ui/menu";
import { useReduceMotion } from "../../ui/motion";
import { Part } from "../../ui/parts";
import { Text } from "../../ui/text";
import { space, TOUCH, useTheme } from "../../ui/theme";
import { PhoneCalendarSync, useCalendarSync, useShareIcs } from "./calendar-sync";
import { useDayFormat, useToday } from "./clock";
import { DayView, HOUR, hoursOf } from "./day";
import { useAgendaInput } from "./input";
import { useScheduleSheets } from "./sheets";
import { WeekStrip } from "./strip";
import { ScheduleWorldProvider } from "./world";

/** A day another screen asked Jadwal to show (the month's "Lihat minggunya"): taken when Jadwal is next in front. */
let wanted: string | null = null;
const wantedListeners = new Set<() => void>();
export function showOnSchedule(day: string): void {
  wanted = day;
  for (const listener of wantedListeners) listener();
}

export function ScheduleScreen({ onRefresh, refreshing }: { onRefresh: () => void; refreshing: boolean }) {
  return (
    <ScheduleWorldProvider>
      <Schedule onRefresh={onRefresh} refreshing={refreshing} />
      <PhoneCalendarSync />
    </ScheduleWorldProvider>
  );
}

/** Monday is 0. */
const weekday = (day: string) => (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;

function Schedule({ onRefresh, refreshing }: { onRefresh: () => void; refreshing: boolean }) {
  const theme = useTheme();
  const v = theme.v4;
  const input = useAgendaInput();
  const six = useStatus("six");
  const today = useToday();
  const courses = useTermCourses() ?? [];
  // The day picked: today first; it follows today across midnight while the Student hasn't picked another.
  const [picked, setPicked] = useState(today);
  const [direction, setDirection] = useState(0);
  const shownToday = useRef(today);
  if (shownToday.current !== today) {
    if (picked === shownToday.current) setPicked(today);
    shownToday.current = today;
  }
  const pick = useCallback((day: string, by = 0) => {
    setDirection(by);
    setPicked(day);
  }, []);
  const timetableChanged = useChangedPage(["six.schedule"]);
  const waiting = !input || (!input.six && (six.state === "connecting" || six.state === "live") && !timetableChanged);
  usePerfDrawn(!waiting);

  const monday = weekStart(picked);
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => shiftDay(monday, i)), [monday]);
  const plan = useMemo(() => (input ? scheduleDays(week, input) : []), [week, input]);
  const byDay = useMemo(() => new Map(plan.map((day) => [day.day, day])), [plan]);
  const day = byDay.get(picked);
  const covered = new Set(input?.months ?? []);
  const free = Boolean(input?.six && day && isEmptyDay(day) && !day.holiday && covered.has(picked.slice(0, 7)) && weekday(picked) < 5);
  // The first class after the day picked, for an empty day's way on ("Berikutnya Kam 08:00").
  const nextStart = useMemo(() => {
    if (!input) return null;
    let first: number | null = null;
    for (const s of [...input.schedule, ...input.outside, ...(input.edunex ?? [])])
      if (wibDay(s.start) > picked && (first === null || s.start < first)) first = s.start;
    return first;
  }, [input, picked]);
  // A class tapped: Beranda's sheet; anything else, Jadwal's own (./sheets.tsx).
  const { open, sheets } = useScheduleSheets();

  // A class asked for from outside (the "Hari ini" widget's tap): its day, then its sheet.
  const asked = useParam("class");
  useEffect(() => {
    if (!asked || !input) return;
    const session = input.schedule.find((s) => s.id === asked);
    if (session) {
      const day = wibDay(session.start);
      pick(day);
      const scheduled = scheduleDays([day], input)[0]?.classes.find((c) => c.session.id === asked);
      if (scheduled) open({ kind: "class", item: scheduled });
    }
    router.setParams({ class: undefined } as never);
  }, [asked, input, open, pick]);
  // A day asked for by the month.
  useEffect(() => {
    const take = () => {
      if (wanted === null) return;
      const day = wanted;
      wanted = null;
      pick(day);
    };
    take();
    wantedListeners.add(take);
    return () => void wantedListeners.delete(take);
  }, [pick]);

  return (
    // On the grey page every tab has (round 3: Jadwal alone was white), the day's blocks in their tints on it.
    <View testID="screen.schedule" style={{ flex: 1, backgroundColor: v.page }}>
      <ScheduleHeader monday={monday} picked={picked} onToday={() => pick(today, today > picked ? 1 : -1)} />
      {waiting || !input || !day ? (
        <Loading />
      ) : (
        <>
          <Rise screen="schedule" index={0}>
            <WeekStrip
              monday={monday}
              picked={picked}
              plan={byDay}
              onPick={(next) => pick(next, next > picked ? 1 : -1)}
              onWeek={(by) => pick(shiftDay(picked, by * 7), by)}
            />
          </Rise>
          <Notes six={input.six} />
          {/* The day's hours under the strip: a part of its own on a first draw ahead (../../ui/parts.tsx). */}
          <Part at={1} fallback={<View style={{ flex: 1 }} />}>
            <DayScroll
              day={day}
              today={today}
              direction={direction}
              onSwipe={(by) => pick(shiftDay(picked, by), by)}
              onRefresh={onRefresh}
              refreshing={refreshing}
            >
              <DayView
                day={day}
                courses={courses}
                six={input.six}
                free={free}
                onPick={open}
                next={nextStart}
                onNext={nextStart === null ? undefined : () => pick(wibDay(nextStart), 1)}
              />
            </DayScroll>
          </Part>
        </>
      )}
      {sheets}
    </View>
  );
}

/**
 * The day, scrolling down its hours: opens where it matters (today: an hour before now, so the now-line and the class
 * on now are in view each time Jadwal is opened; another day: its first class), pulls to refresh, and moves a day on a
 * swipe across it. A new day comes in from the side it was swiped from.
 */
function DayScroll({
  day,
  today,
  direction,
  onSwipe,
  onRefresh,
  refreshing,
  children,
}: {
  day: ScheduleDay;
  today: string;
  direction: number;
  onSwipe: (by: number) => void;
  onRefresh: () => void;
  refreshing: boolean;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  const still = useReduceMotion();
  const clock = useClock();
  const focused = useIsFocused();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  useScrollToTop(scroll);
  const swipe = usePanGesture({
    activeOffsetX: [-28, 28],
    failOffsetY: [-14, 14],
    runOnJS: true,
    onDeactivate: (event) => {
      if (event.canceled) return;
      if (event.translationX <= -60) onSwipe(1);
      else if (event.translationX >= 60) onSwipe(-1);
    },
  });
  const { from } = hoursOf(day);
  // Now from the app's clock, as the now-line reads it (the demo's is not the phone's): the phone's own time opened the
  // day hours away from the now-line.
  const y = Math.max(0, ((openAt(day, today, clock.now()) - from * 60) / 60) * HOUR);
  const items = day.classes.length + day.outside.length + day.edunex.length;
  // A new day, its classes coming in, or Jadwal shown again (the tab is drawn ahead, maybe long before): to its place.
  // biome-ignore lint/correctness/useExhaustiveDependencies: `y` moves with the minute, and a tick shouldn't scroll the day under the Student
  useEffect(() => {
    if (focused) scroll.current?.scrollTo({ y, animated: false });
  }, [day.day, items, from, focused]);
  // With less motion asked for (Android's "Remove animations"), a new day just appears: a fade in its place was
  // left at nothing on the emulator with animations off, a blank day under the strip.
  const entering =
    direction === 0 || still
      ? undefined
      : direction > 0
        ? FadeInRight.springify().damping(20).stiffness(220)
        : FadeInLeft.springify().damping(20).stiffness(220);
  return (
    <GestureDetector gesture={swipe}>
      <ScrollView
        ref={scroll}
        collapsable={false}
        style={{ flex: 1 }}
        contentOffset={{ x: 0, y }}
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.color.primary]}
            progressBackgroundColor={theme.color.surfaceContainerHigh}
          />
        }
        testID="list.agenda"
      >
        <Animated.View key={day.day} entering={entering} style={{ flexGrow: 1 }}>
          {children}
        </Animated.View>
      </ScrollView>
    </GestureDetector>
  );
}

/**
 * The minute the day opens at: today an hour before now, another day 20 minutes before its first class. Never inside a
 * block: one the top would cut (the class on now, a long one before it) is shown whole, from 20 minutes before it.
 */
function openAt(day: ScheduleDay, today: string, now: number): number {
  const spans = [...day.classes.map((c) => c.session), ...day.outside, ...day.edunex].map(
    (s) => [minuteOfDay(s.start), minuteOfDay(s.start) + (s.end - s.start) / 60_000] as const,
  );
  const first = Math.min(...spans.map(([start]) => start));
  let target = day.day === today ? minuteOfDay(now) - 60 : Number.isFinite(first) ? first - 20 : hoursOf(day).from * 60;
  for (;;) {
    const cut = spans.filter(([start, end]) => start < target && target < end).map(([start]) => start);
    if (!cut.length) return target;
    target = Math.min(...cut) - 20;
  }
}

/**
 * Jadwal's top bar: the month of the week on screen as its one title (Plus Jakarta Sans), the term's week quietly
 * under it ("Minggu ke-7 · 5–11 Okt") with the data's status only when it says something; then "Hari ini" when away
 * from today, the month and ⋮. A tap on the title opens the sources' sheet, as on every tab.
 */
function ScheduleHeader({ monday, picked, onToday }: { monday: string; picked: string; onToday: () => void }) {
  const t = useT();
  const lang = useLang();
  const f = useDayFormat();
  const v = useTheme().v4;
  const insets = useSafeAreaInsets();
  const input = useAgendaInput();
  const today = useToday();
  const sync = useSyncText();
  const [panel, setPanel] = useState(false);
  const noon = Date.parse(`${picked}T12:00:00+07:00`);
  const month = new Intl.DateTimeFormat(lang === "id" ? "id-ID" : "en-GB", {
    month: "long",
    ...(picked.slice(0, 4) !== today.slice(0, 4) ? { year: "numeric" } : {}),
    timeZone: "Asia/Jakarta",
  }).format(noon);
  const n = input ? termWeek(input.events, monday) : null;
  const range = f.dayRange(monday, shiftDay(monday, 6));
  const place = n ? t("schedule.weekOf", { n, range }) : range;
  return (
    <View style={{ backgroundColor: v.page, paddingTop: insets.top }}>
      <View style={{ flexDirection: "row", alignItems: "center", minHeight: 64, paddingLeft: space[5], paddingRight: space[1] }}>
        <Pressable
          onPress={() => setPanel(true)}
          accessibilityRole="button"
          accessibilityLabel={`${month}, ${place}. ${t("sync.title")}: ${sync}`}
          testID="action.syncStatus"
          style={{ flex: 1, minWidth: 0, minHeight: TOUCH, justifyContent: "center" }}
        >
          <Text size="titleLarge" face="display" weight="bold" accessibilityRole="header" numberOfLines={1} style={{ color: v.fg, letterSpacing: -0.3 }}>
            {month}
          </Text>
          <Text size="bodyMedium" tabular numberOfLines={1} testID="label.place" style={{ color: v.muted, marginTop: -2 }}>
            {place}
          </Text>
          <StatusLine />
        </Pressable>
        {picked !== today && (
          <Button size="sm" variant="tonal" onPress={onToday} label={t("mobile.schedule.todayLabel")} testID="action.today">
            {t("mobile.schedule.today")}
          </Button>
        )}
        <ScheduleActions />
      </View>
      <SyncPanel open={panel} onClose={() => setPanel(false)} />
    </View>
  );
}

/** Above the day, only when there's something to say: SIX's page changed, SIX not signed in, the phone's calendar. */
function Notes({ six }: { six: boolean }) {
  const timetableChanged = useChangedPage(["six.schedule"]);
  const sync = useCalendarSync();
  const items = [
    timetableChanged ? <SixPageNote key="page" datasets={["six.schedule"]} /> : null,
    !six && !timetableChanged ? <NeedsSix key="six" /> : null,
    sync.on && sync.problem ? <CalendarProblem key="calendar" problem={sync.problem} onRetry={sync.retry} /> : null,
  ].filter(Boolean);
  if (!items.length) return null;
  return <View style={{ gap: space[3], paddingHorizontal: space[4], paddingBottom: space[3] }}>{items}</View>;
}

/** The phone's calendar couldn't be written: why, and the fix. Never a snackbar: it stays until it's fixed. */
function CalendarProblem({ problem, onRetry }: { problem: "denied" | "failed"; onRetry: () => void }) {
  const t = useT();
  if (problem === "denied")
    return (
      <Notice
        tone="warning"
        title={t("mobile.calendar.denied")}
        action={
          <Button size="sm" onPress={() => void Linking.openSettings()} testID="action.calendarSettings">
            {t("mobile.calendar.settings")}
          </Button>
        }
        testID="note.calendarDenied"
      />
    );
  return (
    <Notice
      tone="warning"
      title={t("mobile.calendar.sync.failed")}
      action={
        <Button size="sm" onPress={onRetry} testID="action.calendarRetry">
          {t("action.tryAgain")}
        </Button>
      }
      testID="note.calendarFailed"
    />
  );
}

/** The top bar's own: ⋮ with the month, the reminder before class, the phone's calendar and the .ics; then every tab's three. */
function ScheduleActions() {
  const t = useT();
  const v = useTheme().v4;
  const bridge = useBridge();
  const { classSoonAlerts } = useSettings();
  const sync = useCalendarSync();
  const share = useShareIcs();
  const wasOn = useRef(sync.on);
  // Once the calendar is written after turning it on: how many events, once.
  useEffect(() => {
    if (sync.on && !wasOn.current && sync.written && sync.events > 0) {
      wasOn.current = true;
      toast(t("mobile.calendar.sync.on", { count: sync.events }));
    }
    if (!sync.on) wasOn.current = false;
  }, [sync.on, sync.written, sync.events, t]);
  return (
    <>
      <OverflowMenu
        testID="action.scheduleMenu"
        label={t("mobile.schedule.menu")}
        choices={[
          {
            label: t("mobile.schedule.month"),
            icon: <Icons.Calendar size={20} color={v.muted} />,
            onPress: () => router.push("/schedule-month"),
            testID: "action.month",
          },
          {
            label: t("mobile.schedule.remind"),
            hint: t("mobile.schedule.remind.hint"),
            icon: <Icons.Bell size={20} color={v.muted} />,
            checked: classSoonAlerts,
            onPress: () => {
              const next = !classSoonAlerts;
              void bridge.invoke("settings.update", { classSoonAlerts: next }).then(
                () => toast(t(next ? "mobile.schedule.remind.on" : "mobile.schedule.remind.off")),
                () => undefined,
              );
              // A reminder needs Android's permission for notifications: asked for here, where it's wanted.
              if (next)
                void Notifications.getPermissionsAsync()
                  .then((now) => (!now.granted && now.canAskAgain ? Notifications.requestPermissionsAsync() : now))
                  .catch(() => undefined);
            },
            testID: "action.remindBeforeClass",
          },
          {
            label: t("mobile.calendar.sync"),
            hint: t("mobile.calendar.sync.hint"),
            icon: <Icons.Smartphone size={20} color={v.muted} />,
            checked: sync.on,
            onPress: () => {
              if (sync.on) void sync.turnOff().then(() => toast(t("mobile.calendar.sync.off")));
              else sync.turnOn();
            },
            testID: "action.calendarSync",
          },
          {
            label: t("mobile.calendar.share"),
            icon: <Icons.ArrowUpRight size={20} color={v.muted} />,
            onPress: () => void share().catch(() => toast(t("mobile.calendar.shareFailed"), "danger")),
            testID: "action.shareIcs",
          },
        ]}
      />
      <TabActions />
    </>
  );
}

/**
 * Without SIX: what SIX adds, with the way in, as one flat row of a fixed height above the day (never a card), so the
 * day under it sits where it will stay.
 */
function NeedsSix() {
  const t = useT();
  const v = useTheme().v4;
  const six = useStatus("six");
  const { signIn, busy } = useSignIn();
  return (
    <View testID="note.needsSix" style={{ flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 56 }}>
      <Icons.Lock size={20} color={v.muted} />
      <Text size="bodyMedium" numberOfLines={2} style={{ flex: 1, minWidth: 0, color: v.fg2 }}>
        {t("mobile.schedule.needsSix")}
      </Text>
      {six.state === "signed-out" && (
        <Button size="sm" variant="tonal" busy={busy} onPress={() => void signIn("six")} testID="action.signInSix">
          {t("schedule.signInSix")}
        </Button>
      )}
    </View>
  );
}

/** While SIX's timetable is on its way: the strip's days, then two blocks on the hours. */
function Loading() {
  return (
    <View accessibilityState={{ busy: true }} style={{ paddingHorizontal: space[4], gap: space[3] }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", paddingTop: space[3] }}>
        {Array.from({ length: 7 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholder days have no identity and never move
          <Skeleton key={i} height={60} width={38} />
        ))}
      </View>
      <Skeleton height={120} style={{ marginTop: space[6], marginLeft: 50, borderRadius: 14 }} />
      <Skeleton height={120} style={{ marginTop: space[8], marginLeft: 50, borderRadius: 14 }} />
    </View>
  );
}
