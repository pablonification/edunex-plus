// Jadwal (round 2, v4: mobile/design/r2-directions/v4, "v4-jadwal"): where am I next, and what's this week like. The
// month is the screen's one title, the term's week quietly under it; the week strip with each day's courses as dots,
// today in red; then the day picked (today first) as hours with each class a block in its course's tint, the now-line in
// red. A swipe across the day moves a day, across the strip a week. A class opens Beranda's class sheet (one sheet for a
// class, wherever it's opened); a hand-in, a deadline or a meeting only Edunex announced opens its own (./details.tsx).
// The month is the top bar's calendar button; the reminder before class, the phone's calendar and the .ics are in ⋮.
// Data and reasoning are the desktop's (scheduleDays over the same input); the minute's tick reaches only the now-line
// and the block on now (./clock.ts).
import * as Notifications from "expo-notifications";
import { router, useScrollToTop } from "expo-router";
import { type ComponentRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Linking, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { GestureDetector, usePanGesture } from "react-native-gesture-handler";
import Animated, { FadeIn, FadeInLeft, FadeInRight } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTermCourses } from "../../../../src/app/courses";
import { useHomeWorld } from "../../../../src/app/home-world";
import { useClock, useLang, useT } from "../../../../src/app/i18n";
import { useBridge, useSettings, useStatus } from "../../../../src/app/store";
import { wibDay } from "../../../../src/core/course-meetings";
import { classFacts, homeContext, type NowCard } from "../../../../src/core/needs";
import { isEmptyDay, minuteOfDay, type ScheduleDay, scheduleDays, shiftDay, termWeek, weekStart } from "../../../../src/core/schedule";
import { useParam } from "../../nav";
import { SixPageNote, useChangedPage } from "../../parts/six-page-note";
import { usePerfDrawn } from "../../perf";
import { StatusLine, SyncPanel, useSignIn, useSyncText } from "../../shell/source-status";
import { toast } from "../../swaps/overlays";
import { Button, IconButton } from "../../ui/controls";
import { Skeleton } from "../../ui/display";
import { Rise } from "../../ui/expressive";
import { Icons } from "../../ui/icons";
import { Notice } from "../../ui/layout";
import { OverflowMenu } from "../../ui/menu";
import { useReduceMotion } from "../../ui/motion";
import { Text } from "../../ui/text";
import { space, TOUCH, useTheme } from "../../ui/theme";
import { ClassSheet, classCard } from "../home/class-sheet";
import { PhoneCalendarSync, useCalendarSync, useShareIcs } from "./calendar-sync";
import { useDayFormat, useToday } from "./clock";
import { DayView, HOUR, hoursOf } from "./day";
import { DetailSheet, type Picked } from "./details";
import { useAgendaInput } from "./input";
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
  const world = useHomeWorld();
  const worldRef = useRef(world);
  worldRef.current = world;
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
  const [sheet, setSheet] = useState<{ card: NowCard } | { picked: Picked } | null>(null);
  const timetableChanged = useChangedPage(["six.schedule"]);
  const waiting = !input || (!input.six && (six.state === "connecting" || six.state === "live") && !timetableChanged);
  usePerfDrawn(!waiting, "tab");

  const monday = weekStart(picked);
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => shiftDay(monday, i)), [monday]);
  const plan = useMemo(() => (input ? scheduleDays(week, input) : []), [week, input]);
  const byDay = useMemo(() => new Map(plan.map((day) => [day.day, day])), [plan]);
  const day = byDay.get(picked);
  const covered = new Set(input?.months ?? []);
  const free = Boolean(input?.six && day && isEmptyDay(day) && !day.holiday && covered.has(picked.slice(0, 7)) && weekday(picked) < 5);

  // A class tapped: Beranda's sheet, from the same facts Beranda reads; anything else, its own.
  const clock = useClock();
  const open = useCallback(
    (what: Picked) => {
      if (what.kind === "class" && worldRef.current) {
        const facts = classFacts(homeContext(worldRef.current), what.item.session);
        setSheet({ card: classCard(facts, clock.now()) });
        return;
      }
      if (what.kind === "meeting" && "number" in what.meeting && typeof what.meeting.number === "number") {
        const meeting = what.meeting;
        setSheet({
          card: {
            state: "next",
            class: null,
            meeting: {
              code: meeting.code,
              meeting: { number: meeting.number!, start: meeting.start, end: meeting.end, note: null, online: meeting.online, link: meeting.link },
              ...(what.notInSix ? {} : { maybeInSix: true as const }),
            },
            presence: null,
            after: null,
            unreadDay: null,
          },
        });
        return;
      }
      setSheet({ picked: what });
    },
    [clock],
  );

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
    <View testID="screen.schedule" style={{ flex: 1, backgroundColor: v.card }}>
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
          <DayScroll
            day={day}
            today={today}
            direction={direction}
            onSwipe={(by) => pick(shiftDay(picked, by), by)}
            onRefresh={onRefresh}
            refreshing={refreshing}
          >
            <DayView day={day} courses={courses} six={input.six} free={free} onPick={open} />
          </DayScroll>
        </>
      )}
      <ClassSheet
        card={sheet && "card" in sheet ? sheet.card : null}
        courses={courses}
        open={sheet !== null && "card" in sheet}
        onClose={() => setSheet(null)}
      />
      <DetailSheet picked={sheet && "picked" in sheet ? sheet.picked : null} onClose={() => setSheet(null)} />
    </View>
  );
}

/**
 * The day, scrolling down its hours: opens where it matters (today: an hour before now; another day: its first class),
 * pulls to refresh, and moves a day on a swipe across it. A new day comes in from the side it was swiped from.
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
  const first = Math.min(
    ...[...day.classes.map((c) => c.session.start), ...day.outside.map((m) => m.start), ...day.edunex.map((m) => m.start)].map(minuteOfDay),
  );
  const target = day.day === today ? minuteOfDay(Date.now()) - 60 : Number.isFinite(first) ? first - 20 : from * 60;
  const y = Math.max(0, ((target - from * 60) / 60) * HOUR);
  useEffect(() => {
    scroll.current?.scrollTo({ y, animated: false });
  }, [day.day, y]);
  const entering =
    direction === 0
      ? undefined
      : still
        ? FadeIn.duration(150)
        : direction > 0
          ? FadeInRight.springify().damping(20).stiffness(220)
          : FadeInLeft.springify().damping(20).stiffness(220);
  return (
    <GestureDetector gesture={swipe}>
      <ScrollView
        ref={scroll}
        collapsable={false}
        style={{ flex: 1, borderTopWidth: 1, borderTopColor: theme.v4.line }}
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
    <View style={{ backgroundColor: v.card, paddingTop: insets.top }}>
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

/** The top bar's own: the month, and ⋮ with the reminder before class, the phone's calendar and the .ics. */
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
      <IconButton label={t("mobile.schedule.month")} onPress={() => router.push("/schedule-month")} testID="action.month">
        <Icons.Calendar size={24} color={v.fg} />
      </IconButton>
      <OverflowMenu
        testID="action.scheduleMenu"
        choices={[
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
    </>
  );
}

/** Without SIX: what SIX adds, with the way in. */
function NeedsSix() {
  const t = useT();
  const six = useStatus("six");
  const { signIn, busy } = useSignIn();
  return (
    <Notice
      tone="neutral"
      icon={<Icons.Lock size={18} />}
      title={t("schedule.needsSix")}
      action={
        six.state === "signed-out" ? (
          <Button size="sm" busy={busy} onPress={() => void signIn("six")} testID="action.signInSix">
            {t("schedule.signInSix")}
          </Button>
        ) : undefined
      }
    />
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
