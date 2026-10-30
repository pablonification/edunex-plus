// Jadwal on the phone (src/app/screens/schedule.tsx): the week (the default) and the month, from
// the desktop's own data (useScheduleInput, scheduleDays). The week is a strip of its days that
// stays on top while the chosen day's list scrolls under it; the month is a grid of days, the one
// tapped listed below it. A row opens its sheet. The view, the week and the day the Student chose
// stay while the app is open. Without SIX, what Edunex knows, with the way in. "Tambahkan ke
// kalender HP" closes the page, within reach.
import { type ReactNode, useCallback, useMemo, useState } from "react";
import { View } from "react-native";
import { useFormat, useLang, useNow, useT } from "../../../../src/app/i18n";
import { useScheduleInput } from "../../../../src/app/schedule-data";
import { useStatus } from "../../../../src/app/store";
import { useViewChoice } from "../../../../src/app/view-choice";
import { wibDay } from "../../../../src/core/course-meetings";
import { dayStart, isEmptyDay, monthGrid, scheduleDays, shiftDay, termWeek, weekStart } from "../../../../src/core/schedule";
import { SixPageNote, useChangedPage } from "../../parts/six-page-note";
import { useSignIn } from "../../shell/source-status";
import { Button, IconButton, Segmented } from "../../ui/controls";
import { Skeleton } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { Page, PageHeader } from "../../ui/layout";
import { Text } from "../../ui/text";
import { radius, space, useTheme } from "../../ui/theme";
import { AddToCalendarButton } from "./calendar";
import { DetailSheet, type Picked } from "./details";
import { MonthView } from "./month";
import { DayAgenda, WeekBands, WeekStrip } from "./week";
import { ScheduleWorldProvider } from "./world";

type View_ = "week" | "month";

/** Where the Student is in Jadwal: the view, the week's Monday, the month ("2026-10") and the day; null = the current one. */
interface Place {
  view: View_;
  week: string | null;
  month: string | null;
  day: string | null;
}

/** Jadwal's place, kept for as long as the app is open (going to a course and back keeps it). */
function usePlace(): [Place, (patch: Partial<Place>) => void] {
  const [place, setPlace] = useViewChoice<Place>("schedule.place", { view: "week", week: null, month: null, day: null });
  const update = useCallback((patch: Partial<Place>) => setPlace((current) => ({ ...current, ...patch })), [setPlace]);
  return [place, update];
}

/** Months from "2026-10" to "2027-01": 3. */
const monthsBetween = (from: string, to: string) => {
  const [a, b] = [from, to].map((m) => m.split("-").map(Number)) as [number[], number[]];
  return (b[0]! - a[0]!) * 12 + (b[1]! - a[1]!);
};

/** Monday is 0. */
const weekdayIndex = (day: string) => Math.round((dayStart(day) - dayStart(weekStart(day))) / (24 * 3_600_000));

export function ScheduleScreen({ header, onRefresh, refreshing }: { header: ReactNode; onRefresh: () => void; refreshing: boolean }) {
  return (
    <ScheduleWorldProvider>
      <Schedule header={header} onRefresh={onRefresh} refreshing={refreshing} />
    </ScheduleWorldProvider>
  );
}

function Schedule({ header, onRefresh, refreshing }: { header: ReactNode; onRefresh: () => void; refreshing: boolean }) {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const now = useNow();
  const input = useScheduleInput();
  const six = useStatus("six");
  const [place, setPlace] = usePlace();
  const [picked, setPicked] = useState<Picked | null>(null);
  const today = wibDay(now);
  const thisWeek = weekStart(today);
  const thisMonth = today.slice(0, 7);
  const monday = place.week ?? thisWeek;
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => shiftDay(monday, i)), [monday]);
  const month = useMemo(() => monthGrid(now, monthsBetween(thisMonth, place.month ?? thisMonth)), [now, thisMonth, place.month]);
  const week = place.view === "week";
  // Weeks or months from today's: 0 is this one.
  const offset = week ? Math.round((dayStart(monday) - dayStart(thisWeek)) / (7 * 24 * 3_600_000)) : monthsBetween(thisMonth, month.month);
  // The chosen day: the one the Student picked while it's on screen, else today, else the week's Monday or the month's 1st.
  const chosen = week
    ? place.day && days.includes(place.day)
      ? place.day
      : days.includes(today)
        ? today
        : days[0]!
    : place.day?.startsWith(month.month)
      ? place.day
      : today.startsWith(month.month)
        ? today
        : `${month.month}-01`;

  const weekPlan = useMemo(() => (input ? scheduleDays(days, input) : []), [days, input]);
  const monthPlan = useMemo(() => (input ? scheduleDays(month.weeks.flat(), input) : []), [month, input]);

  const stepWeek = (by: number) => setPlace({ week: shiftDay(monday, by * 7), day: shiftDay(chosen, by * 7) });
  const stepMonth = (by: number) => setPlace({ month: monthGrid(now, monthsBetween(thisMonth, month.month) + by).month, day: null });
  // Past Sunday is next week's Monday, before Monday last week's Sunday.
  const moveDay = (by: number) => {
    const next = shiftDay(chosen, by);
    setPlace({ week: weekStart(next), day: next });
  };
  const showWeek = (day: string) => setPlace({ view: "week", week: weekStart(day), day });
  const atToday = offset === 0 && chosen === today;
  // "Minggu depan", "3 minggu lalu": between the arrows, the week or month on screen said from today.
  const placeName = (() => {
    const count = Math.abs(offset);
    if (offset === 0) return t(week ? "schedule.thisWeek" : "schedule.thisMonth");
    if (offset === 1) return t(week ? "mobile.schedule.nextWeek" : "mobile.schedule.nextMonth");
    if (offset === -1) return t(week ? "mobile.schedule.lastWeek" : "mobile.schedule.lastMonth");
    if (offset > 0) return t(week ? "mobile.schedule.weeksAhead" : "mobile.schedule.monthsAhead", { count });
    return t(week ? "mobile.schedule.weeksAgo" : "mobile.schedule.monthsAgo", { count });
  })();

  const n = input ? termWeek(input.events, monday) : null;
  const range = f.dayRange(days[0]!, days[6]!);
  const description = week
    ? n
      ? t("schedule.weekOf", { n, range })
      : range
    : new Intl.DateTimeFormat(lang === "id" ? "id-ID" : "en-GB", { month: "long", year: "numeric" }).format(dayStart(`${month.month}-15`));
  // The timetable's page changed and nothing was read yet: no use waiting for it.
  const timetableChanged = useChangedPage(["six.schedule"]);
  const waiting = !input || (!input.six && (six.state === "connecting" || six.state === "live") && !timetableChanged);
  const visible = week ? days : month.weeks.flat().filter((day) => day.startsWith(month.month));
  const unpublished = input?.six && !visible.some((day) => input.months.includes(day.slice(0, 7)));
  const covered = new Set(input?.months ?? []);
  const chosenDay = weekPlan.find((d) => d.day === chosen);
  const free =
    Boolean(input?.six) &&
    chosenDay !== undefined &&
    isEmptyDay(chosenDay) &&
    !chosenDay.holiday &&
    covered.has(chosen.slice(0, 7)) &&
    weekdayIndex(chosen) < 5;

  return (
    <Page
      testID="screen.schedule"
      header={header}
      onRefresh={onRefresh}
      refreshing={refreshing}
      // The week's strip stays on top while its day scrolls under it.
      stickyHeaderIndices={week && !waiting ? [1] : undefined}
    >
      <PageHeader
        title={t("nav.schedule")}
        description={description}
        actions={
          <>
            <View style={{ flex: 1 }}>
              <Segmented
                label={t("schedule.view")}
                value={place.view}
                onChange={(view) => setPlace({ view })}
                options={[
                  { value: "week", label: t("schedule.view.week") },
                  { value: "month", label: t("schedule.view.month") },
                ]}
                testID="segment.view"
              />
            </View>
            {/* The way back, in both views. On today it's there but quiet and does nothing: never disabled, so it doesn't look broken. */}
            <Button
              onPress={atToday ? undefined : () => setPlace({ week: null, month: null, day: null })}
              label={t("mobile.schedule.todayLabel")}
              testID="action.today"
            >
              <Text size="small" weight="semibold" tone={atToday ? "faint" : "fg"}>
                {t("mobile.schedule.today")}
              </Text>
            </Button>
          </>
        }
      />
      {waiting ? (
        <Loading />
      ) : week ? (
        <WeekStrip plan={weekPlan} chosen={chosen} onChoose={(day) => setPlace({ day })} onStep={stepWeek} name={placeName} />
      ) : (
        <MonthNav month={description} name={placeName} onStep={stepMonth} />
      )}
      {!waiting && (
        <View style={{ marginTop: space[3] }}>
          <View style={{ gap: space[3], marginBottom: space[4] }}>
            <SixPageNote datasets={["six.schedule"]} />
            {!input.six && !timetableChanged && <NeedsSix />}
            {unpublished && (
              <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space[2], borderRadius: radius.lg, padding: space[3] }}>
                <Icons.Info size={14} />
                <Text size="small" tone="muted" style={{ flex: 1 }}>
                  {t("schedule.notCovered")}
                </Text>
              </View>
            )}
          </View>
          {week ? (
            <>
              <WeekBands days={days} plan={weekPlan} events={input.events} />
              {chosenDay && <DayAgenda day={chosenDay} input={input} free={free} onPick={setPicked} onSwipe={moveDay} />}
            </>
          ) : (
            <MonthView
              month={month}
              plan={monthPlan}
              periods={input.events}
              chosen={chosen}
              onChoose={(day) => setPlace({ day })}
              onPick={setPicked}
              onShowWeek={showWeek}
            />
          )}
          <View style={{ marginTop: space[8] }}>
            <AddToCalendarButton />
          </View>
          <DetailSheet picked={picked} onClose={() => setPicked(null)} />
        </View>
      )}
    </Page>
  );
}

/** The month's arrows, the month on screen named between them ("Bulan depan"). */
function MonthNav({ month, name, onStep }: { month: string; name: string; onStep: (by: number) => void }) {
  const t = useT();
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginHorizontal: -space[2] }} accessibilityLabel={month}>
      <IconButton label={t("schedule.prevMonth")} onPress={() => onStep(-1)} testID="action.prevMonth">
        <Icons.ChevronLeft size={20} color={theme.color.fg} />
      </IconButton>
      <View style={{ flex: 1, alignItems: "center" }}>
        <Text size="small" weight="semibold" accessibilityLiveRegion="polite" testID="label.place">
          {name}
        </Text>
      </View>
      <IconButton label={t("schedule.nextMonth")} onPress={() => onStep(1)} testID="action.nextMonth">
        <Icons.ChevronRight size={20} color={theme.color.fg} />
      </IconButton>
    </View>
  );
}

/** Without SIX: one slim line saying what SIX adds, with the way in. */
function NeedsSix() {
  const t = useT();
  const theme = useTheme();
  const six = useStatus("six");
  const { signIn, busy } = useSignIn();
  return (
    <View
      style={{
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: theme.color.edge,
        backgroundColor: theme.color.sunken,
        padding: space[3.5],
        gap: space[3],
      }}
    >
      <View style={{ flexDirection: "row", gap: space[2] }}>
        <View style={{ paddingTop: 3 }}>
          <Icons.Lock size={14} color={theme.color.muted} />
        </View>
        <View style={{ flex: 1 }}>
          <Text size="small" weight="semibold">
            {t("schedule.needsSix")}
          </Text>
          <Text size="small" tone="muted">
            {t("schedule.needsSix.hint")}
          </Text>
        </View>
      </View>
      {six.state === "signed-out" && (
        <Button busy={busy} onPress={() => void signIn("six")} testID="action.signInSix" style={{ alignSelf: "flex-start" }}>
          {t("schedule.signInSix")}
        </Button>
      )}
    </View>
  );
}

/** While SIX's timetable is on its way: the shape of a week's strip and a day. */
function Loading() {
  return (
    <View accessibilityState={{ busy: true }} style={{ gap: space[3] }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {Array.from({ length: 7 }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: placeholder days have no identity and never move
          <Skeleton key={i} height={52} width={36} />
        ))}
      </View>
      <Skeleton height={24} width={180} style={{ marginTop: space[3] }} />
      <Skeleton height={96} style={{ borderRadius: radius.xl }} />
      <Skeleton height={96} style={{ borderRadius: radius.xl }} />
    </View>
  );
}
