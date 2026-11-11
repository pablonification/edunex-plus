// Rencana studi › Kalender akademik on the phone (src/app/screens/plan/deadlines.tsx, S16; round 2, v4): ITB's
// academic calendar, two ways. Works without SIX.
// 1. One card led by the next date: the days to it, big (counting up once), and what and when on one line, today's
//    date a quiet line over it. A tap offers to add it to the phone's calendar.
// 2. "Untukmu": this term's deadlines by month, each a row with its date in a small tile, what it is, its days and how
//    soon (not on the date the card leads with: the card says it); running ones say so. What a date means for the
//    Student is in its sheet. Next term's and the
//    past ones fold away. "Kalender lengkap": every event ITB lists, by month, with chips and a search. The view
//    picked stays while the app is open.
// 3. ITB's calendar, named and linked, with when it was last checked, at the end.
// A tap on a date opens its sheet: what it means for the Student, when the app has something to say, and the offer to
// add it to the phone's calendar: into the app's own "Edunex Plus" calendar there, the one Jadwal's "Kalender HP"
// switch keeps (../schedule/phone-calendar.ts), so both screens know what's in it. A date already there says so, and
// comes out again from the same row, unless Jadwal's switch is the one keeping it.
import { useState } from "react";
import { Linking, TextInput, View } from "react-native";
import { useDeadlines, useThisTerm } from "../../../../src/app/deadlines";
import { useOpenExternal } from "../../../../src/app/hooks";
import { useFormat, useLang, useNow, useT } from "../../../../src/app/i18n";
import { useDataset } from "../../../../src/app/store";
import { useViewChoice } from "../../../../src/app/view-choice";
import { CALENDAR_GROUPS, type CalendarEntry, type CalendarGroup, DEADLINE_KINDS, type Deadline, fullCalendar } from "../../../../src/core/academic";
import { relativeTime } from "../../../../src/core/intl";
import { itbCalendar } from "../../../../src/core/links";
import type { CalendarEvent } from "../../../../src/core/models";
import { type StringKey, translate } from "../../../../src/core/strings";
import { toast } from "../../swaps/overlays";
import { Button, Chip, ChipRow, Segmented } from "../../ui/controls";
import { EmptyState } from "../../ui/display";
import { Rise } from "../../ui/expressive";
import { Figure, Group, GroupRow, Heading, IconTile, Panel, Pill } from "../../ui/group";
import { haptic } from "../../ui/haptics";
import { Icons } from "../../ui/icons";
import { factsLabel, Notice } from "../../ui/layout";
import { Tap } from "../../ui/moves";
import { ROW_SIDE } from "../../ui/row-end";
import { ActionSheet } from "../../ui/sheet";
import { LINK_SLOP } from "../../ui/sizes";
import { Text, useFieldColors } from "../../ui/text";
import { font, space, type, useTheme } from "../../ui/theme";
import { itbItem, itbUid } from "../schedule/calendar-plan";
import { usePlacement } from "../schedule/calendar-sync";
import { addToPhoneCalendar, removeFromPhoneCalendar } from "../schedule/phone-calendar";
import { Later } from "./deferred";
import { usePlaceState } from "./place-state";
import { useTermYears } from "./projection";

type Soon = "now" | "week" | "month" | "term" | "next";

/** Which group an upcoming deadline falls in: running, the next 7 days, this month, the rest of this term, next term. */
function groupOf(deadline: Deadline, now: number, term: string | null, termEnd: number): Soon {
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

/** A date the Student tapped: the sheet's words for it; the phone's calendar gets ITB's own title, as from Jadwal. */
interface Picked {
  event: CalendarEvent;
  title: string;
  dates: string;
  /** What it means for the Student, and whether ITB changed it: said in the sheet, never on the row. */
  about?: string | null;
}

const noon = (day: string) => Date.parse(`${day}T12:00:00+07:00`);

const RISE = "plan-deadlines";

/** "12–16 Okt", "4 Des", "30 Nov – 11 Des": a deadline's days as the list says them. */
function useDates(): (event: CalendarEvent) => string {
  const f = useFormat();
  return (event) => {
    const first = noon(event.firstDay);
    const last = noon(event.lastDay);
    if (event.firstDay === event.lastDay) return f.dayMonth(first);
    if (event.firstDay.slice(0, 7) === event.lastDay.slice(0, 7)) return `${event.firstDay.slice(8).replace(/^0/, "")}–${f.dayMonth(last)}`;
    return `${f.dayMonth(first)} – ${f.dayMonth(last)}`;
  };
}

/** "UTS", "Batas perubahan nilai · TA": the app's name for a deadline. */
function useDeadlineTitle(): (deadline: Deadline) => string {
  const t = useT();
  return ({ event, variant }) => {
    const kind = t(`deadline.kind.${event.kind}` as StringKey);
    return variant ? `${kind} · ${t(`deadline.variant.${variant}`)}` : kind;
  };
}

export function Tab(_: { onCalendar?: () => void }) {
  const t = useT();
  const theme = useTheme();
  const calendar = useDataset("itb.calendar");
  const [view, setView] = useViewChoice<"mine" | "all">("deadlines.view", "mine");
  const [picked, setPicked] = useState<Picked | null>(null);
  // The date didn't go into the phone's calendar: why and its fix, on the page, at its top, until the next try (never a snackbar).
  const [problem, setProblem] = useState<CalendarProblem>(null);
  if (!calendar) return <EmptyState icon={<Icons.CalendarClock size={20} color={theme.color.muted} />} title={t("deadlines.empty")} />;
  return (
    <View>
      {problem && (
        <View accessibilityRole="alert" accessibilityLiveRegion="assertive" style={{ marginBottom: space[3] }}>
          {problem === "denied" ? (
            <Notice
              tone="warning"
              title={t("mobile.exam.calendarDenied")}
              action={
                <Button size="sm" onPress={() => void Linking.openSettings()} testID="action.calendarSettings">
                  {t("mobile.calendar.settings")}
                </Button>
              }
              testID="note.calendarDenied"
            />
          ) : (
            <Notice tone="danger" title={t("mobile.calendar.addFailed")} testID="note.calendarFailed" />
          )}
        </View>
      )}
      <Rise screen={RISE} index={0}>
        <Next onPick={setPicked} />
      </Rise>
      <Rise screen={RISE} index={1} style={{ marginTop: space[4] }}>
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
      </Rise>
      <Rise screen={RISE} index={2}>
        {view === "mine" ? <ForYou onPick={setPicked} /> : <EveryEvent onPick={setPicked} />}
      </Rise>
      <Later>
        <Source />
      </Later>
      <AddToCalendar picked={picked} onClose={() => setPicked(null)} onProblem={setProblem} />
    </View>
  );
}

/** The leading card: the next date's days to go, big; what and when on one line; today's date a quiet line over it. */
function Next({ onPick }: { onPick: (picked: Picked) => void }) {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const v = useTheme().v4;
  const dates = useDates();
  const titleOf = useDeadlineTitle();
  const { upcoming } = useDeadlines();
  const next = upcoming.find((d) => d.when === "next");
  const today = (
    <Text size="bodyMedium" style={{ color: v.muted }} testID="marker.today">
      {t("deadlines.todayAt", { date: `${f.weekdayShort(now)}, ${f.dayMonth(now)}` })}
    </Text>
  );
  if (!next)
    return (
      <Panel style={{ padding: space[5], gap: space[2] }} testID="card.deadlines.next">
        {today}
        <Text size="bodyLarge" style={{ color: v.fg }}>
          {t("mobile.calendar.noneLeft")}
        </Text>
      </Panel>
    );
  const title = titleOf(next);
  const when = dates(next.event);
  const offset = Math.max(0, f.dayOffset(next.event.start));
  const days = offset === 0 ? t("mobile.calendar.today") : `${offset} ${t("mobile.calendar.daysLeft", { count: offset })}`;
  return (
    <Panel
      onPress={() => onPick({ event: next.event, title, dates: when, about: next.meaning ? t(next.meaning.key, next.meaning.vars) : null })}
      accessibilityLabel={factsLabel(days, title, when)}
      accessibilityHint={t("mobile.deadline.toCalendar")}
      testID="card.deadlines.next"
      style={{ padding: space[5], gap: space[2] }}
    >
      {today}
      {offset === 0 ? (
        <Text style={{ fontFamily: font.display.extrabold, fontSize: 44, lineHeight: 51, letterSpacing: -1, color: v.fg }}>{days}</Text>
      ) : (
        <Figure id={`deadlines.next.${next.event.id}`} value={offset} unit={t("mobile.calendar.daysLeft", { count: offset })} />
      )}
      <Text size="bodyLarge" weight="medium" style={{ color: v.fg }}>
        {factsLabel(title, when)}
      </Text>
    </Panel>
  );
}

/** "Oktober 2026" from "2026-10" (the middle of the month, so the phone's own time zone names the same one). */
function useMonthName(): (month: string) => string {
  const lang = useLang();
  const format = new Intl.DateTimeFormat(lang === "id" ? "id-ID" : "en-GB", { month: "long", year: "numeric" });
  return (month) => format.format(Date.parse(`${month}-15T12:00:00+07:00`));
}

/** Items in order, by the month they start in ("2026-10"). */
function byMonth<T>(items: readonly T[], day: (item: T) => string): { month: string; items: T[] }[] {
  const months: { month: string; items: T[] }[] = [];
  for (const item of items) {
    const month = day(item).slice(0, 7);
    const last = months.at(-1);
    if (last?.month === month) last.items.push(item);
    else months.push({ month, items: [item] });
  }
  return months;
}

function ForYou({ onPick }: { onPick: (picked: Picked) => void }) {
  const t = useT();
  const now = useNow();
  const term = useThisTerm();
  const termYears = useTermYears();
  const monthName = useMonthName();
  const { upcoming, past } = useDeadlines();
  // The date the card leads with: its row leaves the countdown to the card.
  const lead = upcoming.find((d) => d.when === "next")?.event.id;
  const [nextOpen, setNextOpen] = usePlaceState("deadlines.nextTerm", false);
  const [pastOpen, setPastOpen] = useState(false);
  const termEnd = Math.max(0, ...[...upcoming, ...past].filter((d) => d.event.term === term).map((d) => d.event.end));
  const thisTerm = upcoming.filter((d) => groupOf(d, now, term, termEnd) !== "next");
  const nextTerm = upcoming.filter((d) => groupOf(d, now, term, termEnd) === "next");
  // "Semester depan" names its term once, when its events share one, instead of on every row.
  const terms = new Set(nextTerm.flatMap((d) => (d.event.term ? [d.event.term] : [])));
  const named = terms.size === 1 ? [...terms][0]! : null;
  return (
    <View>
      {byMonth(thisTerm, (d) => d.event.firstDay).map(({ month, items }) => (
        <View key={month} testID={`group.deadlines.${month}`}>
          <Heading>{monthName(month)}</Heading>
          <Group>
            {items.map((deadline, i) => (
              <DeadlineRow
                key={deadline.event.id}
                first={i === 0}
                deadline={deadline}
                showTerm={deadline.event.term !== term}
                showSoon={deadline.event.id !== lead}
                onPick={onPick}
              />
            ))}
          </Group>
        </View>
      ))}
      {nextTerm.length > 0 && (
        <Group testID="group.deadlines.next" style={{ marginTop: space[6] }}>
          <Fold
            open={nextOpen}
            onToggle={() => setNextOpen(!nextOpen)}
            title={t("deadlines.group.next")}
            meta={factsLabel(named && termYears(named), t("mobile.calendar.dates", { count: nextTerm.length }))}
            testID="action.deadlines.next"
          />
          {nextOpen &&
            nextTerm.map((deadline) => (
              <DeadlineRow
                key={deadline.event.id}
                first={false}
                deadline={deadline}
                showTerm={deadline.event.term !== term && deadline.event.term !== named}
                showSoon={deadline.event.id !== lead}
                onPick={onPick}
              />
            ))}
        </Group>
      )}
      {past.length > 0 && (
        <Group testID="group.deadlines.past" style={{ marginTop: space[3] }}>
          <Fold
            open={pastOpen}
            onToggle={() => setPastOpen(!pastOpen)}
            title={t("deadlines.past")}
            meta={t("mobile.calendar.dates", { count: past.length })}
            testID="action.deadlines.past"
          />
          {pastOpen &&
            past.map((deadline) => (
              <DeadlineRow key={deadline.event.id} first={false} deadline={deadline} showTerm={deadline.event.term !== term} onPick={onPick} />
            ))}
        </Group>
      )}
    </View>
  );
}

/** A fold's row: its name, how many dates it holds, a chevron that turns as it opens. */
function Fold({ open, onToggle, title, meta, testID }: { open: boolean; onToggle: () => void; title: string; meta: string; testID: string }) {
  const v = useTheme().v4;
  return (
    <GroupRow
      first
      title={title}
      meta={meta}
      onPress={onToggle}
      accessibilityState={{ expanded: open }}
      testID={testID}
      trailing={
        <View style={{ transform: [{ rotate: open ? "90deg" : "0deg" }] }}>
          <Icons.ChevronRight size={20} color={v.muted} />
        </View>
      }
    />
  );
}

/** A date in a small tile: the day (or days), the month under it; tinted while it's ahead, green while running, grey once past. */
function DateTile({ event, when }: { event: CalendarEvent; when: Deadline["when"] }) {
  const f = useFormat();
  const v = useTheme().v4;
  const day = (iso: string) => iso.slice(8).replace(/^0/, "");
  const sameMonth = event.firstDay.slice(0, 7) === event.lastDay.slice(0, 7);
  const days = event.firstDay === event.lastDay || !sameMonth ? day(event.firstDay) : `${day(event.firstDay)}–${day(event.lastDay)}`;
  const month = f.dayMonth(noon(event.firstDay)).split(/\s/).at(-1) ?? "";
  const { bg, fg } = when === "past" ? { bg: v.chip, fg: v.muted } : when === "now" ? { bg: v.okBg, fg: v.okFg } : { bg: v.brandTint, fg: v.brandInk };
  return (
    <View
      style={{
        minWidth: 44,
        minHeight: 44,
        borderRadius: 14,
        paddingHorizontal: space[1],
        backgroundColor: bg,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* One text, two lines ("12–16" over "Okt"), so the tile reads as one date. */}
      <Text style={{ textAlign: "center", color: fg, lineHeight: 16 }}>
        <Text face="display" weight="bold" tabular style={{ color: fg, fontSize: days.length > 2 ? 14 : 17, lineHeight: 19 }}>
          {days}
        </Text>
        {"\n"}
        <Text size="labelSmall" weight="medium" style={{ color: fg }}>
          {month}
        </Text>
      </Text>
    </View>
  );
}

/**
 * `showTerm`: the event's term, only where it isn't the one the Student is reading about (this term, or the fold's).
 * `showSoon`: how soon, except on the date the card leads with.
 */
function DeadlineRow({
  deadline,
  first,
  showTerm,
  showSoon = true,
  onPick,
}: {
  deadline: Deadline;
  first: boolean;
  showTerm: boolean;
  showSoon?: boolean;
  onPick: (picked: Picked) => void;
}) {
  const t = useT();
  const lang = useLang();
  const f = useFormat();
  const v = useTheme().v4;
  const termYears = useTermYears();
  const dates = useDates();
  const titleOf = useDeadlineTitle();
  const { event, meaning, when } = deadline;
  const title = titleOf(deadline);
  const range = dates(event);
  const start = noon(event.firstDay);
  const end = noon(event.lastDay);
  const days = event.firstDay === event.lastDay ? f.weekdayShort(start) : `${f.weekdayShort(start)}–${f.weekdayShort(end)}`;
  const offset = f.dayOffset(event.start);
  const near = when === "next" && offset < 14;
  const warn = meaning?.warn && when !== "past";
  const soon = when === "now" ? t("deadlines.now") : relativeTime(lang)(offset, "day");
  const means = meaning ? t(meaning.key, meaning.vars) : null;
  const term = showTerm && event.term ? termYears(event.term) : null;
  return (
    <GroupRow
      first={first}
      leading={<DateTile event={event} when={when} />}
      title={
        <Text size="bodyLarge" weight="medium" style={{ color: when === "past" ? v.muted : v.fg, lineHeight: 21 }}>
          {title}
        </Text>
      }
      // Its dates only: what it means for the Student is in its sheet.
      meta={factsLabel(range, days, term)}
      metaTone={warn ? "amber" : meaning?.done && when !== "past" ? "ok" : "muted"}
      trailing={
        when === "now" ? (
          <Pill tone="ok">{soon}</Pill>
        ) : showSoon ? (
          <Text size="bodyMedium" weight={near ? "semibold" : "regular"} tabular style={{ color: near ? v.ambFg : v.muted }}>
            {soon}
          </Text>
        ) : undefined
      }
      onPress={() => onPick({ event, title, dates: range, about: means })}
      accessibilityLabel={factsLabel(title, range, days, (showSoon || when === "now") && soon, term)}
      accessibilityHint={t("mobile.deadline.toCalendar")}
      testID={`row.deadline.${event.id}`}
    />
  );
}

/** The day's marker among the full calendar's rows: "Sekarang · Kam, 8 Okt", with a line to the edge. */
function TodayLine() {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const v = useTheme().v4;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space[2], paddingHorizontal: ROW_SIDE, paddingVertical: space[2] }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: v.brandInk }} />
      <Text size="labelMedium" weight="semibold" style={{ color: v.brandInk }}>
        {t("deadlines.todayAt", { date: `${f.weekdayShort(now)}, ${f.dayMonth(now)}` })}
      </Text>
      <View style={{ flex: 1, height: 1, backgroundColor: v.brandInk, opacity: 0.4 }} />
    </View>
  );
}

/** The full calendar: every event, by month, with chips and a search; months already over are folded until asked for or searched. */
function EveryEvent({ onPick }: { onPick: (picked: Picked) => void }) {
  const fieldColors = useFieldColors();
  const t = useT();
  const now = useNow();
  const theme = useTheme();
  const v = theme.v4;
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
    <View style={{ marginTop: space[4] }}>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space[2],
          minHeight: 48,
          borderRadius: 24,
          paddingHorizontal: space[4],
          backgroundColor: v.card,
        }}
      >
        <Icons.Search size={20} color={v.muted} />
        <TextInput
          {...fieldColors}
          value={query}
          onChangeText={setQuery}
          accessibilityLabel={t("calendar.search")}
          placeholder={t("calendar.search")}
          placeholderTextColor={v.muted}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          style={{ flex: 1, color: v.fg, ...type.body, paddingVertical: 0 }}
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
      <View style={{ marginTop: space[3], flexDirection: "row", alignItems: "center", gap: space[3], minHeight: 24 }}>
        {/* Only the count is announced as it changes, not the button beside it. */}
        <Text size="bodyMedium" style={{ color: v.muted }} accessibilityLiveRegion="polite">
          {filtered ? t("calendar.countOf", { shown, count: total }) : t("calendar.count", { count: total })}
        </Text>
        {filtered && (
          <Tap
            feel="row"
            borderless
            accessibilityRole="button"
            hitSlop={LINK_SLOP}
            onPress={() => {
              setQuery("");
              setGroups(new Set());
            }}
          >
            <Text size="bodyMedium" weight="medium" style={{ color: v.brandInk }}>
              {t("calendar.clear")}
            </Text>
          </Tap>
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
        <Panel style={{ marginTop: space[6], paddingHorizontal: space[5], paddingVertical: space[6] }}>
          <Text size="bodyLarge" style={{ color: v.muted, textAlign: "center" }}>
            {t("calendar.none")}
          </Text>
        </Panel>
      )}
      {visible.map(({ month, entries }) => {
        // The line for today sits before the month's first event still to come.
        const todayAt = month === thisMonth ? entries.findIndex((e) => e.when !== "past") : -2;
        return (
          <View key={month}>
            <Heading
              trailing={
                <Text size="bodyMedium" tabular style={{ color: v.muted }}>
                  {String(entries.length)}
                </Text>
              }
            >
              {monthName(month)}
            </Heading>
            <Group>
              {entries.flatMap((entry, i) => [
                ...(i === todayAt ? [<TodayLine key="today" />] : []),
                <EventRow key={entry.event.id} first={i === 0 && todayAt !== 0} entry={entry} onPick={onPick} />,
              ])}
              {todayAt === -1 && <TodayLine key="today" />}
            </Group>
          </View>
        );
      })}
    </View>
  );
}

/** Meanings that only say again what ITB's title says ("Masa Ujian Tengah Semester": "Midterm exam week."); the search still finds them. */
const RESTATED: ReadonlySet<StringKey> = new Set<StringKey>(["deadline.uts", "deadline.lectureStart"]);

/** One event: its date in a tile, ITB's title, and what it means when the app has something to say. */
function EventRow({ entry, first, onPick }: { entry: CalendarEntry; first: boolean; onPick: (picked: Picked) => void }) {
  const t = useT();
  const f = useFormat();
  const v = useTheme().v4;
  const { event, when } = entry;
  const meaning = entry.meaning && !RESTATED.has(entry.meaning.key) ? entry.meaning : null;
  const days =
    event.firstDay === event.lastDay ? f.weekdayShort(noon(event.firstDay)) : `${f.weekdayShort(noon(event.firstDay))}–${f.weekdayShort(noon(event.lastDay))}`;
  const warn = meaning?.warn && when !== "past";
  const dates = f.dayRange(event.firstDay, event.lastDay);
  const means = meaning ? t(meaning.key, meaning.vars) : null;
  const revised = entry.revised ? t("calendar.revised") : null;
  return (
    <GroupRow
      first={first}
      leading={<DateTile event={event} when={when} />}
      title={
        <Text size="bodyLarge" style={{ color: when === "past" ? v.muted : v.fg, lineHeight: 21 }}>
          {entry.title}
        </Text>
      }
      // Its dates only: what it means, and whether ITB changed it, are in its sheet.
      meta={factsLabel(dates, days)}
      metaTone={warn ? "amber" : meaning?.done && when !== "past" ? "ok" : "muted"}
      trailing={when === "now" ? <Pill tone="ok">{t("deadlines.now")}</Pill> : undefined}
      onPress={() => onPick({ event, title: entry.title, dates, about: factsLabel(means, revised) || null })}
      accessibilityLabel={factsLabel(entry.title, dates, days, when === "now" && t("deadlines.now"))}
      accessibilityHint={t("mobile.deadline.toCalendar")}
    />
  );
}

/** Where every date here comes from, to read for oneself, and how fresh it is: ITB's calendar as a row that opens it. */
function Source() {
  const t = useT();
  const f = useFormat();
  const v = useTheme().v4;
  const open = useOpenExternal();
  const calendar = useDataset("itb.calendar");
  const { url, year } = itbCalendar(useThisTerm(), calendar);
  if (!calendar) return null;
  return (
    <Group style={{ marginTop: space[6] }} testID="row.deadlines.source">
      <GroupRow
        first
        leading={<IconTile tone="plain" icon={(color) => <Icons.CalendarClock size={22} color={color} />} />}
        title={year ? t("deadlines.source", { years: `${year}/${year + 1}` }) : t("deadlines.sourcePlain")}
        meta={t("deadlines.checked", { when: f.fromNow(calendar.checkedAt) })}
        trailing={<Icons.ArrowUpRight size={20} color={v.muted} />}
        onPress={() => open(url)}
        accessibilityRole="link"
      />
    </Group>
  );
}

/** Why a date didn't go into (or out of) the phone's calendar: calendar access is off, or the phone refused the write. */
type CalendarProblem = "denied" | "failed" | null;

/**
 * The sheet a date opens: what it means, then the phone's calendar, or ITB's calendar to read. The calendar row is
 * the date's state there: not in it (add it), in it (take it out), or in it because Jadwal's "Kalender HP" keeps it.
 */
function AddToCalendar({ picked, onClose, onProblem }: { picked: Picked | null; onClose: () => void; onProblem: (problem: CalendarProblem) => void }) {
  const t = useT();
  const lang = useLang();
  const theme = useTheme();
  const open = useOpenExternal();
  const calendar = useDataset("itb.calendar");
  const { url, year } = itbCalendar(useThisTerm(), calendar);
  const where = usePlacement(picked ? [itbUid(picked.event.id)] : [], picked !== null);
  const add = async (pick: Picked) => {
    onProblem(null);
    try {
      // Only this date: nothing else in the calendar is touched (no span to tidy).
      const result = await addToPhoneCalendar([itbItem(pick.event, translate(lang, "ics.fromItb"))], new Set(), { from: 0, until: 0 });
      if (result.kind === "denied") return onProblem("denied");
      haptic.confirm();
      toast(t("mobile.calendar.added", { count: result.events }), "success");
    } catch {
      onProblem("failed");
    }
  };
  const remove = async (pick: Picked) => {
    onProblem(null);
    try {
      if ((await removeFromPhoneCalendar([itbUid(pick.event.id)])) === "denied") return onProblem("denied");
      toast(t("mobile.calendar.removed"));
    } catch {
      onProblem("failed");
    }
  };
  const inCalendar = <Icons.CalendarCheck size={20} color={theme.color.fg} />;
  return (
    <ActionSheet
      open={picked !== null}
      onClose={onClose}
      title={picked ? `${picked.title} · ${picked.dates}` : undefined}
      message={picked?.about}
      testID="sheet.deadline"
      choices={
        picked
          ? [
              where === "none"
                ? {
                    label: t("mobile.deadline.toCalendar"),
                    icon: <Icons.Smartphone size={20} color={theme.color.fg} />,
                    onPress: () => void add(picked),
                    testID: "action.addToCalendar",
                  }
                : where === "added"
                  ? {
                      label: t("mobile.calendar.in"),
                      hint: t("mobile.calendar.in.remove"),
                      icon: inCalendar,
                      onPress: () => void remove(picked),
                      testID: "action.removeFromCalendar",
                    }
                  : {
                      label: t("mobile.calendar.in"),
                      hint: t("mobile.calendar.in.kept"),
                      icon: inCalendar,
                      disabled: true,
                      onPress: () => undefined,
                      testID: "state.inCalendar",
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
