// Rencana studi › Kalender akademik on the phone (src/app/screens/plan/deadlines.tsx, S16): ITB's
// academic calendar, two ways. "Untukmu": this term's and the next term's deadlines and what each
// means for the Student, grouped by how soon, a marker for today, near countdowns in bold, past
// ones folded away. "Kalender lengkap": every event ITB lists, by month, with chips and a search.
// The view picked stays while the app is open; ITB's calendar is named and linked, with when it
// was last checked. Works without SIX. A tap on a date offers to add it to the phone's calendar
// (the phone's own calendar app opens with it filled in, nothing is written without the Student).
import { createEventInCalendarAsync } from "expo-calendar/legacy";
import { Fragment, useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import { useDeadlines, useThisTerm } from "../../../../src/app/deadlines";
import { useOpenExternal } from "../../../../src/app/hooks";
import { useFormat, useLang, useNow, useT } from "../../../../src/app/i18n";
import { useDataset } from "../../../../src/app/store";
import { useViewChoice } from "../../../../src/app/view-choice";
import { CALENDAR_GROUPS, type CalendarEntry, type CalendarGroup, DEADLINE_KINDS, type Deadline, fullCalendar } from "../../../../src/core/academic";
import { relativeTime } from "../../../../src/core/intl";
import { itbCalendar } from "../../../../src/core/links";
import type { AcademicCalendar, CalendarEvent } from "../../../../src/core/models";
import type { StringKey } from "../../../../src/core/strings";
import { toast } from "../../swaps/overlays";
import { Button, Chip, ChipRow, Segmented } from "../../ui/controls";
import { EmptyState } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { List, Meta } from "../../ui/layout";
import { ActionSheet } from "../../ui/sheet";
import { Text } from "../../ui/text";
import { radius, space, type, useTheme } from "../../ui/theme";
import { usePlaceState } from "./place-state";
import { useTermYears } from "./projection";

type Group = "now" | "week" | "month" | "term" | "next";

/** Which group an upcoming deadline falls in: running, the next 7 days, this month, the rest of this term, next term. */
function groupOf(deadline: Deadline, now: number, term: string | null, termEnd: number): Group {
  if (deadline.when === "now") return "now";
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  // The coming seven days, and named so ("7 hari ke depan"): on a Thursday, next Monday's exam is near but not "this week".
  const weekEnd = new Date(today);
  weekEnd.setDate(today.getDate() + 7);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const start = deadline.event.start;
  if (start < weekEnd.getTime()) return "week";
  if (start < monthEnd.getTime()) return "month";
  // A progress check belongs to no term: after this term's last date, it's next term's.
  if (deadline.event.term === null) return start > termEnd ? "next" : "term";
  return term && deadline.event.term !== term ? "next" : "term";
}

const GROUPS: Group[] = ["now", "week", "month", "term", "next"];

/** A date the Student tapped: what the phone's calendar gets (the app's words for it, ITB's title in the notes). */
interface Picked {
  event: CalendarEvent;
  title: string;
  dates: string;
}

const noon = (day: string) => Date.parse(`${day}T12:00:00+07:00`);

export function Tab(_: { onCalendar?: () => void }) {
  const t = useT();
  const theme = useTheme();
  const calendar = useDataset("itb.calendar");
  const [view, setView] = useViewChoice<"mine" | "all">("deadlines.view", "mine");
  const [picked, setPicked] = useState<Picked | null>(null);
  if (!calendar) return <EmptyState icon={<Icons.CalendarClock size={20} color={theme.color.muted} />} title={t("deadlines.empty")} />;
  return (
    <View>
      <View style={{ marginBottom: space[5], gap: space[3] }}>
        <View>
          <Text size="small" tone="muted">
            {t(view === "mine" ? "deadlines.intro" : "calendar.intro")}
          </Text>
          <Source calendar={calendar} />
        </View>
        <Segmented
          label={t("deadlines.view")}
          value={view}
          onChange={setView}
          options={[
            { value: "mine", label: t("deadlines.view.mine") },
            { value: "all", label: t("deadlines.view.all") },
          ]}
          testID="action.calendarView"
        />
      </View>
      {view === "mine" ? <ForYou onPick={setPicked} /> : <EveryEvent onPick={setPicked} />}
      <AddToCalendar picked={picked} onClose={() => setPicked(null)} />
    </View>
  );
}

/** "Dari Kalender Pendidikan ITB 2026/2027 · diperiksa 2 jam yang lalu": where every date here comes from, to read for oneself, and how fresh it is. */
function Source({ calendar }: { calendar: AcademicCalendar }) {
  const t = useT();
  const f = useFormat();
  const open = useOpenExternal();
  const { url, year } = itbCalendar(useThisTerm(), calendar);
  return (
    <View style={{ marginTop: 2 }}>
      <Meta size="caption">
        <Text size="caption" tone="muted">
          {t("deadlines.from")}{" "}
          <Text size="caption" tone="accent" accessibilityRole="link" onPress={() => open(url)} style={{ textDecorationLine: "underline" }}>
            {year ? t("deadlines.source", { years: `${year}/${year + 1}` }) : t("deadlines.sourcePlain")}
          </Text>
        </Text>
        {t("deadlines.checked", { when: f.fromNow(calendar.checkedAt) })}
      </Meta>
    </View>
  );
}

/** The day's marker: "Sekarang · Kam, 8 Okt", with a line to the edge. */
function TodayLine() {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }} testID="marker.today">
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: theme.color.accent }} />
      <Text size="caption" weight="semibold" tone="accent">
        {t("deadlines.todayAt", { date: `${f.weekdayShort(now)}, ${f.dayMonth(now)}` })}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: theme.color.accent, opacity: 0.4 }} />
    </View>
  );
}

function ForYou({ onPick }: { onPick: (picked: Picked) => void }) {
  const t = useT();
  const now = useNow();
  const theme = useTheme();
  const term = useThisTerm();
  const termYears = useTermYears();
  const { upcoming, past } = useDeadlines();
  const [nextOpen, setNextOpen] = usePlaceState("deadlines.nextTerm", false);
  const [pastOpen, setPastOpen] = useState(false);
  const grouped = new Map<Group, Deadline[]>();
  const termEnd = Math.max(0, ...[...upcoming, ...past].filter((d) => d.event.term === term).map((d) => d.event.end));
  for (const d of upcoming) {
    const g = groupOf(d, now, term, termEnd);
    grouped.set(g, [...(grouped.get(g) ?? []), d]);
  }
  const firstAhead = GROUPS.find((g) => g !== "now" && grouped.get(g)?.length);
  return (
    <View>
      <View style={{ gap: space[6] }}>
        {GROUPS.map((group) => {
          const items = grouped.get(group);
          if (!items?.length) return null;
          const collapsed = group === "next" && !nextOpen;
          // "Semester depan" names its term once, when its events share one, instead of on every row.
          const terms = new Set(items.flatMap((d) => (d.event.term ? [d.event.term] : [])));
          const named = group === "next" && terms.size === 1 ? [...terms][0]! : null;
          const heading = (
            <Text size="small" weight="semibold" accessibilityRole="header">
              {t(`deadlines.group.${group}`)}
              {named ? (
                <Text size="small" weight="medium" tone="muted">
                  {`  ·  ${termYears(named)}`}
                </Text>
              ) : null}
              <Text size="small" weight="medium" tone="faint" tabular>
                {`  ${items.length}`}
              </Text>
            </Text>
          );
          return (
            <Fragment key={group}>
              {group === firstAhead && <TodayLine />}
              <View testID={`group.deadlines.${group}`}>
                {group === "next" ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ expanded: !collapsed }}
                    onPress={() => setNextOpen(!nextOpen)}
                    hitSlop={8}
                    style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: space[2], minHeight: 32 }}
                    testID="action.deadlines.next"
                  >
                    <View style={{ transform: [{ rotate: collapsed ? "0deg" : "90deg" }] }}>
                      <Icons.ChevronRight size={14} color={theme.color.faint} />
                    </View>
                    {heading}
                  </Pressable>
                ) : (
                  <View style={{ marginBottom: space[2] }}>{heading}</View>
                )}
                {!collapsed && (
                  <List>
                    {items.map((deadline) => (
                      <DeadlineRow
                        key={deadline.event.id}
                        deadline={deadline}
                        showTerm={deadline.event.term !== term && deadline.event.term !== named}
                        onPick={onPick}
                      />
                    ))}
                  </List>
                )}
              </View>
            </Fragment>
          );
        })}
      </View>
      {past.length > 0 && (
        <View style={{ marginTop: space[8] }}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: pastOpen }}
            onPress={() => setPastOpen(!pastOpen)}
            hitSlop={8}
            style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 32 }}
            testID="action.deadlines.past"
          >
            <View style={{ transform: [{ rotate: pastOpen ? "90deg" : "0deg" }] }}>
              <Icons.ChevronRight size={14} color={theme.color.muted} />
            </View>
            <Text size="small" weight="medium" tone="muted">
              {t("deadlines.past")}
              <Text size="small" tone="faint" tabular>
                {`  ${past.length}`}
              </Text>
            </Text>
          </Pressable>
          {pastOpen && (
            <View style={{ marginTop: space[3] }}>
              <List>
                {past.map((deadline) => (
                  <DeadlineRow key={deadline.event.id} deadline={deadline} showTerm={deadline.event.term !== term} onPick={onPick} />
                ))}
              </List>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

/** `showTerm`: the event's term, only where it isn't the one the Student is reading about (this term, or the group's). */
function DeadlineRow({ deadline, showTerm, onPick }: { deadline: Deadline; showTerm: boolean; onPick: (picked: Picked) => void }) {
  const t = useT();
  const lang = useLang();
  const f = useFormat();
  const theme = useTheme();
  const termYears = useTermYears();
  const { event, meaning, variant, when } = deadline;
  const first = noon(event.firstDay);
  const last = noon(event.lastDay);
  const single = event.firstDay === event.lastDay;
  const sameMonth = event.firstDay.slice(0, 7) === event.lastDay.slice(0, 7);
  const dates = single
    ? f.dayMonth(first)
    : sameMonth
      ? `${event.firstDay.slice(8).replace(/^0/, "")}–${f.dayMonth(last)}`
      : `${f.dayMonth(first)} – ${f.dayMonth(last)}`;
  const days = single ? f.weekdayShort(first) : `${f.weekdayShort(first)}–${f.weekdayShort(last)}`;
  const offset = f.dayOffset(event.start);
  const near = when === "next" && offset < 14;
  const warn = meaning?.warn && when !== "past";
  const kind = t(`deadline.kind.${event.kind}` as StringKey);
  const title = variant ? `${kind} · ${t(`deadline.variant.${variant}`)}` : kind;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPick({ event, title, dates })}
      android_ripple={{ color: theme.color.selected }}
      style={{ paddingHorizontal: space[4], paddingVertical: space[3], gap: 2 }}
      testID={`row.deadline.${event.id}`}
    >
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: space[2] }}>
        <Text size="body" weight="semibold" tone={when === "past" ? "muted" : "fg"} tabular>
          {dates}
        </Text>
        <Text size="caption" tone="faint" style={{ flex: 1 }}>
          {days}
        </Text>
        <Text size="small" weight={when === "now" || near ? "semibold" : "regular"} tone={when === "now" ? "success" : near ? "warning" : "faint"} tabular>
          {when === "now" ? t("deadlines.now") : relativeTime(lang)(offset, "day")}
        </Text>
      </View>
      <Meta tone={when === "past" ? "muted" : "fg"}>
        <Text size="body" weight="medium" tone={when === "past" ? "muted" : "fg"}>
          {kind}
        </Text>
        {variant ? t(`deadline.variant.${variant}`) : null}
        {showTerm && event.term ? termYears(event.term) : null}
      </Meta>
      {meaning && (
        <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}>
          {meaning.done && (
            <View style={{ paddingTop: 3 }}>
              <Icons.Check size={12} color={theme.color.successFg} weight="bold" />
            </View>
          )}
          {warn && (
            <View style={{ paddingTop: 3 }}>
              <Icons.AlertTriangle size={12} color={theme.color.warningFg} weight="bold" />
            </View>
          )}
          <Text size="small" weight={warn ? "medium" : "regular"} tone={warn ? "warning" : meaning.done ? "success" : "muted"} style={{ flex: 1 }}>
            {t(meaning.key, meaning.vars)}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

/** "Oktober 2026" from "2026-10" (the middle of the month, so the phone's own time zone names the same one). */
function useMonthName(): (month: string) => string {
  const lang = useLang();
  const format = new Intl.DateTimeFormat(lang === "id" ? "id-ID" : "en-GB", { month: "long", year: "numeric" });
  return (month) => format.format(Date.parse(`${month}-15T12:00:00+07:00`));
}

/** The full calendar: every event, by month, with chips and a search; months already over are folded until asked for or searched. */
function EveryEvent({ onPick }: { onPick: (picked: Picked) => void }) {
  const t = useT();
  const now = useNow();
  const theme = useTheme();
  const monthName = useMonthName();
  const calendar = useDataset("itb.calendar");
  const krs = useDataset("six.krs");
  const bills = useDataset("six.bills");
  const progress = useDataset("six.progress");
  const [query, setQuery] = usePlaceState("calendar.query", "");
  const [groups, setGroups] = usePlaceState<ReadonlySet<CalendarGroup>>("calendar.groups", new Set());
  const [earlier, setEarlier] = usePlaceState("calendar.earlier", false);
  const { months, total, counts } = fullCalendar(
    { calendar, now, krs, bills, progress },
    // The app's own words count in the search too: its short name for the kind ("UTS", "Midterms"), what it means, the chip.
    {
      groups,
      query,
      extra: (entry) =>
        [
          DEADLINE_KINDS.includes(entry.event.kind) && t(`deadline.kind.${entry.event.kind}` as StringKey),
          entry.meaning && t(entry.meaning.key, entry.meaning.vars),
          t(`calendar.group.${entry.group}`),
        ]
          .filter(Boolean)
          .join(" "),
    },
  );
  const shown = months.reduce((sum, m) => sum + m.entries.length, 0);
  const thisMonth = new Date(now + 7 * 3_600_000).toISOString().slice(0, 7);
  const searching = query.trim() !== "";
  const filtered = searching || groups.size > 0;
  // A month that's over folds away, unless something in it is still running (a payment window opened last month); a search looks in them all.
  const over = (m: (typeof months)[number]) => m.month < thisMonth && m.entries.every((e) => e.when === "past");
  const before = searching ? [] : months.filter(over);
  const visible = earlier || searching ? months : months.filter((m) => !over(m));
  const toggle = (group: CalendarGroup) => {
    const next = new Set(groups);
    if (next.has(group)) next.delete(group);
    else next.add(group);
    setGroups(next);
  };
  return (
    <View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space[2],
          height: 44,
          borderRadius: radius.lg,
          paddingHorizontal: space[3],
          backgroundColor: theme.color.fill,
        }}
      >
        <Icons.Search size={18} color={theme.color.faint} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          accessibilityLabel={t("calendar.search")}
          placeholder={t("calendar.search")}
          placeholderTextColor={theme.color.faint}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          style={{ flex: 1, color: theme.color.fg, ...type.body, paddingVertical: 0 }}
          testID="input.calendarSearch"
        />
      </View>
      <View style={{ marginTop: space[3] }} accessibilityLabel={t("calendar.chips")}>
        <ChipRow>
          {CALENDAR_GROUPS.filter((g) => counts[g] > 0).map((group) => {
            const on = groups.has(group);
            return (
              <Chip key={group} selected={on} onPress={() => toggle(group)} testID={`action.calendarGroup.${group}`}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                  {on && <Icons.Check size={12} color={theme.color.fg} weight="bold" />}
                  <Text size="small" weight={on ? "semibold" : "medium"} tone={on ? "fg" : "muted"}>
                    {t(`calendar.group.${group}`)}
                  </Text>
                  <Text size="small" tone="faint" tabular>
                    {counts[group]}
                  </Text>
                </View>
              </Chip>
            );
          })}
        </ChipRow>
      </View>
      <View style={{ marginTop: space[3], flexDirection: "row", alignItems: "center", gap: space[3] }}>
        {/* Only the count is announced as it changes, not the button beside it. */}
        <Text size="caption" tone="muted" accessibilityLiveRegion="polite">
          {filtered ? t("calendar.countOf", { shown, count: total }) : t("calendar.count", { count: total })}
        </Text>
        {filtered && (
          <Pressable
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => {
              setQuery("");
              setGroups(new Set());
            }}
          >
            <Text size="caption" weight="medium" tone="accent">
              {t("calendar.clear")}
            </Text>
          </Pressable>
        )}
      </View>
      {before.length > 0 && (
        <View style={{ marginTop: space[2], flexDirection: "row" }}>
          <Button
            variant="ghost"
            size="sm"
            onPress={() => setEarlier(!earlier)}
            icon={earlier ? <Icons.ChevronDown size={14} color={theme.color.muted} /> : <Icons.ChevronRight size={14} color={theme.color.muted} />}
            style={{ marginLeft: -space[3] }}
          >
            {t(earlier ? "calendar.earlierHide" : "calendar.earlier", { count: before.length })}
          </Button>
        </View>
      )}
      {shown === 0 && (
        <View
          style={{ marginTop: space[6], borderRadius: radius.xl, backgroundColor: theme.color.sunken, paddingHorizontal: space[4], paddingVertical: space[6] }}
        >
          <Text size="small" tone="muted" style={{ textAlign: "center" }}>
            {t("calendar.none")}
          </Text>
        </View>
      )}
      <View style={{ marginTop: space[4], gap: space[5] }}>
        {visible.map(({ month, entries }) => {
          // The line for today sits before the month's first event still to come.
          const todayAt = month === thisMonth ? entries.findIndex((e) => e.when !== "past") : -2;
          return (
            <View key={month}>
              <Text size="small" weight="semibold" accessibilityRole="header" style={{ marginBottom: space[1.5] }}>
                {monthName(month)}
                <Text size="small" weight="medium" tone="faint" tabular>
                  {`  ${entries.length}`}
                </Text>
              </Text>
              <List>
                {entries.flatMap((entry, i) => [
                  ...(i === todayAt
                    ? [
                        <View key="today" style={{ paddingHorizontal: space[4], paddingVertical: space[1.5] }}>
                          <TodayLine />
                        </View>,
                      ]
                    : []),
                  <EventRow key={entry.event.id} entry={entry} onPick={onPick} />,
                ])}
                {todayAt === -1 && (
                  <View key="today" style={{ paddingHorizontal: space[4], paddingVertical: space[1.5] }}>
                    <TodayLine />
                  </View>
                )}
              </List>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** Meanings that only say again what ITB's title says ("Masa Ujian Tengah Semester": "Midterm exam week."); the search still finds them. */
const RESTATED: ReadonlySet<StringKey> = new Set<StringKey>(["deadline.uts", "deadline.lectureStart"]);

/** One event, compact: its days, ITB's title, and what it means when the app has something to say. */
function EventRow({ entry, onPick }: { entry: CalendarEntry; onPick: (picked: Picked) => void }) {
  const t = useT();
  const f = useFormat();
  const theme = useTheme();
  const { event, when } = entry;
  const meaning = entry.meaning && !RESTATED.has(entry.meaning.key) ? entry.meaning : null;
  const days =
    event.firstDay === event.lastDay ? f.weekdayShort(noon(event.firstDay)) : `${f.weekdayShort(noon(event.firstDay))}–${f.weekdayShort(noon(event.lastDay))}`;
  const warn = meaning?.warn && when !== "past";
  const dates = f.dayRange(event.firstDay, event.lastDay);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onPick({ event, title: entry.title, dates })}
      android_ripple={{ color: theme.color.selected }}
      style={{ paddingHorizontal: space[4], paddingVertical: space[2.5], gap: 2 }}
    >
      <Text size="small" weight="semibold" tone={when === "past" ? "muted" : "fg"} tabular>
        {dates}
        <Text size="small" tone="faint">{`  ${days}`}</Text>
      </Text>
      <Text size="body" tone={when === "past" ? "muted" : "fg"}>
        {entry.title}
        {when === "now" ? (
          <Text size="small" weight="semibold" tone="success">
            {`  ${t("deadlines.now")}`}
          </Text>
        ) : null}
      </Text>
      {(meaning || entry.revised) && (
        <Meta tone={warn ? "fg" : "muted"}>
          {meaning ? (
            <Text size="small" weight={warn ? "medium" : "regular"} tone={warn ? "warning" : meaning.done && when !== "past" ? "success" : "muted"}>
              {t(meaning.key, meaning.vars)}
            </Text>
          ) : null}
          {entry.revised ? (
            <Text size="small" tone="faint">
              {t("calendar.revised")}
            </Text>
          ) : null}
        </Meta>
      )}
    </Pressable>
  );
}

/** The sheet a date opens: add it to the phone's calendar (its own app, filled in), or read it on ITB's calendar. */
function AddToCalendar({ picked, onClose }: { picked: Picked | null; onClose: () => void }) {
  const t = useT();
  const theme = useTheme();
  const open = useOpenExternal();
  const calendar = useDataset("itb.calendar");
  const { url, year } = itbCalendar(useThisTerm(), calendar);
  const add = async (pick: Picked) => {
    try {
      // A whole-day event on its days; noon in WIB is the same date wherever the calendar keeps it.
      await createEventInCalendarAsync({
        title: pick.title,
        startDate: new Date(noon(pick.event.firstDay)),
        endDate: new Date(noon(pick.event.lastDay)),
        allDay: true,
        notes: pick.event.title,
      });
    } catch {
      toast(t("mobile.deadline.calendarFailed"), "danger");
    }
  };
  return (
    <ActionSheet
      open={picked !== null}
      onClose={onClose}
      title={picked ? `${picked.title} · ${picked.dates}` : undefined}
      testID="sheet.deadline"
      choices={
        picked
          ? [
              {
                label: t("mobile.deadline.toCalendar"),
                icon: <Icons.CalendarCheck size={20} color={theme.color.fg} />,
                onPress: () => void add(picked),
                testID: "action.addToCalendar",
              },
              {
                label: year ? t("deadlines.source", { years: `${year}/${year + 1}` }) : t("deadlines.sourcePlain"),
                icon: <Icons.ArrowUpRight size={20} color={theme.color.fg} />,
                onPress: () => open(url),
                testID: "action.openItbCalendar",
              },
            ]
          : []
      }
    />
  );
}
