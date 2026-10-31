// Jadwal on the phone (W13, round 2): where am I next, and what's this week like. The agenda is the screen: the
// term's days down the page, opening on today, from the desktop's own data (scheduleDays over the same input), in
// one FlashList so a term of days scrolls at the screen's full rate. The week strip on top follows the list and moves
// it. The month is a screen away (the top bar's calendar button); the reminder before class and the phone's calendar
// are settings in ⋮, where a Student looks for them on a calendar. A class opens its sheet (./details.tsx).
// The minute's tick redraws only the cards whose class starts or ends (./clock.ts).
import { FlashList, type FlashListRef, type ViewToken } from "@shopify/flash-list";
import { router, useScrollToTop } from "expo-router";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Linking, RefreshControl, View } from "react-native";
import { useT } from "../../../../src/app/i18n";
import type { ScheduleData } from "../../../../src/app/schedule-data";
import { useBridge, useSettings, useStatus } from "../../../../src/app/store";
import { type ScheduleDay, scheduleDays, shiftDay, weekStart } from "../../../../src/core/schedule";
import { useParam } from "../../nav";
import { SixPageNote, useChangedPage } from "../../parts/six-page-note";
import { TabHeader, useSignIn } from "../../shell/source-status";
import { toast } from "../../swaps/overlays";
import { Button, IconButton } from "../../ui/controls";
import { Skeleton } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { Notice } from "../../ui/layout";
import { OverflowMenu } from "../../ui/menu";
import { shape, space, useTheme } from "../../ui/theme";
import { type AgendaLine, agendaDays, agendaLines, dayOfLine, lineOf } from "./agenda";
import { PhoneCalendarSync, useCalendarSync, useShareIcs } from "./calendar-sync";
import { useToday } from "./clock";
import { DetailSheet, type Picked } from "./details";
import { useAgendaInput } from "./input";
import { DayBlock, WeekLine } from "./rows";
import { type TopDay, topDayStore, WeekStrip } from "./strip";
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

/** "2026-11" → "2026-11-30". */
const lastDayOf = (month: string) => shiftDay(`${shiftDay(`${month}-28`, 4).slice(0, 7)}-01`, -1);

function Schedule({ onRefresh, refreshing }: { onRefresh: () => void; refreshing: boolean }) {
  const t = useT();
  const theme = useTheme();
  const input = useAgendaInput();
  const six = useStatus("six");
  const today = useToday();
  const [picked, setPicked] = useState<Picked | null>(null);
  // The timetable's page changed and nothing was read yet: no use waiting for it.
  const timetableChanged = useChangedPage(["six.schedule"]);
  const waiting = !input || (!input.six && (six.state === "connecting" || six.state === "live") && !timetableChanged);

  // From three weeks back to the end of what SIX published (or six weeks ahead), worked out again only when that changes.
  const lastMonth = input?.months.length ? [...input.months].sort().at(-1)! : null;
  const days = useMemo(() => agendaDays(today, lastMonth ? lastDayOf(lastMonth) : null), [today, lastMonth]);
  const plan = useMemo(() => (input ? scheduleDays(days, input) : []), [days, input]);
  const byDay = useMemo(() => new Map(plan.map((day) => [day.day, day])), [plan]);
  const agenda = useMemo(() => agendaLines(plan, { six: input?.six ?? false, months: input?.months ?? [], today }), [plan, input?.six, input?.months, today]);

  return (
    <View testID="screen.schedule" style={{ flex: 1, backgroundColor: theme.color.surface }}>
      <TabHeader title={t("nav.schedule")} actions={<ScheduleActions />} />
      {waiting || !input ? (
        <Loading />
      ) : (
        <Agenda input={input} agenda={agenda} byDay={byDay} onPick={setPicked} onRefresh={onRefresh} refreshing={refreshing} />
      )}
      <DetailSheet picked={picked} onClose={() => setPicked(null)} />
    </View>
  );
}

function Agenda({
  input,
  agenda,
  byDay,
  onPick,
  onRefresh,
  refreshing,
}: {
  input: ScheduleData;
  agenda: ReturnType<typeof agendaLines>;
  byDay: ReadonlyMap<string, ScheduleDay>;
  onPick: (picked: Picked) => void;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const theme = useTheme();
  const today = useToday();
  const list = useRef<FlashListRef<AgendaLine>>(null);
  const top = useRef<TopDay>(topDayStore(today)).current;
  const lines = useRef(agenda);
  lines.current = agenda;
  // Opens on today: its line, else its week's.
  const [initial] = useState(() => lineOf(agenda, today) ?? 0);

  const go = useCallback(
    (day: string) => {
      const index = lineOf(lines.current, day);
      if (index === undefined) return;
      top.set(day);
      list.current?.scrollToIndex({ index, animated: true, viewPosition: 0 });
    },
    [top],
  );
  // A second tap on Jadwal's tab brings today back to the top, as a calendar's does.
  useScrollToTop(useRef({ scrollToTop: () => go(today) }));

  // A class asked for from outside (the widget's tap): its day comes up and its sheet opens.
  const asked = useParam("class");
  useEffect(() => {
    if (!asked) return;
    for (const day of byDay.values()) {
      const item = day.classes.find((c) => c.session.id === asked);
      if (!item) continue;
      go(day.day);
      onPick({ kind: "class", item });
      break;
    }
    router.setParams({ class: undefined } as never);
  }, [asked, byDay, go, onPick]);
  // A day asked for by the month.
  useEffect(() => {
    const take = () => {
      if (wanted === null) return;
      const day = wanted;
      wanted = null;
      go(day);
    };
    take();
    wantedListeners.add(take);
    return () => void wantedListeners.delete(take);
  }, [go]);

  // The strip follows the day at the top of the list (a week's line counts as its first day shown).
  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken<AgendaLine>[] }) => {
    const shown = viewableItems.filter((v) => v.isViewable && v.item).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
    const first = shown[0]?.item;
    if (!first) return;
    const next = shown[1]?.item;
    top.set(first.type === "week" && next?.type === "day" && weekStart(next.day.day) === first.monday ? next.day.day : dayOfLine(first));
  }).current;

  const renderItem = useCallback(
    ({ item }: { item: AgendaLine }) =>
      item.type === "week" ? (
        <WeekLine monday={item.monday} days={item.days} uncovered={item.uncovered} input={input} />
      ) : (
        <DayBlock day={item.day} free={item.free} six={input.six} onPick={onPick} />
      ),
    [input, onPick],
  );

  return (
    <>
      <WeekStrip top={top} plan={byDay} input={input} onGo={go} />
      <FlashList
        ref={list}
        data={agenda.lines}
        keyExtractor={(line) => line.key}
        getItemType={(line) => line.type}
        renderItem={renderItem}
        initialScrollIndex={initial}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 10, minimumViewTime: 0 }}
        ListHeaderComponent={<Notes six={input.six} />}
        contentContainerStyle={{ paddingHorizontal: space.page, paddingBottom: space[12] }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.color.primary]} progressBackgroundColor={theme.color.surfaceContainerHigh} />
        }
        testID="list.agenda"
      />
    </>
  );
}

/** Above the agenda, only when there's something to say: SIX's page changed, SIX not signed in, the phone's calendar. */
function Notes({ six }: { six: boolean }) {
  const timetableChanged = useChangedPage(["six.schedule"]);
  const sync = useCalendarSync();
  return (
    <View style={{ gap: space[3], paddingTop: space[2] }}>
      <SixPageNote datasets={["six.schedule"]} />
      {!six && !timetableChanged && <NeedsSix />}
      {sync.on && sync.problem && <CalendarProblem problem={sync.problem} onRetry={sync.retry} />}
    </View>
  );
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
      >
        {t("mobile.calendar.deniedHint")}
      </Notice>
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
    >
      {t("mobile.calendar.sync.failedHint")}
    </Notice>
  );
}

/** The top bar's own: the month, and ⋮ with the reminder before class, the phone's calendar and the .ics. */
function ScheduleActions() {
  const t = useT();
  const theme = useTheme();
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
        <Icons.Calendar size={24} color={theme.color.onSurfaceVariant} />
      </IconButton>
      <OverflowMenu
        testID="action.scheduleMenu"
        choices={[
          {
            label: t("mobile.schedule.remind"),
            hint: t("mobile.schedule.remind.hint"),
            icon: <Icons.Bell size={20} color={theme.color.onSurfaceVariant} />,
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
            icon: <Icons.Smartphone size={20} color={theme.color.onSurfaceVariant} />,
            checked: sync.on,
            onPress: () => {
              if (sync.on) void sync.turnOff().then(() => toast(t("mobile.calendar.sync.off")));
              else sync.turnOn();
            },
            testID: "action.calendarSync",
          },
          {
            label: t("mobile.calendar.share"),
            icon: <Icons.ArrowUpRight size={20} color={theme.color.onSurfaceVariant} />,
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
    >
      {t("schedule.needsSix.hint")}
    </Notice>
  );
}

/** While SIX's timetable is on its way: the strip's days, then two days of cards. */
function Loading() {
  return (
    <View accessibilityState={{ busy: true }} style={{ paddingHorizontal: space.page, gap: space[3] }}>
      <Skeleton height={20} width={180} style={{ alignSelf: "center", marginVertical: space[3] }} />
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {Array.from({ length: 7 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholder days have no identity and never move
          <Skeleton key={i} height={52} width={36} />
        ))}
      </View>
      {[0, 1].map((day) => (
        <View key={day} style={{ flexDirection: "row", gap: space[3], marginTop: space[4] }}>
          <Skeleton height={56} width={48} />
          <View style={{ flex: 1, gap: space[2] }}>
            <Skeleton height={88} style={{ borderRadius: shape.md }} />
            <Skeleton height={88} style={{ borderRadius: shape.md }} />
          </View>
        </View>
      ))}
    </View>
  );
}
