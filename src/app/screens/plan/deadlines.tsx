// Rencana studi tab — ITB's academic calendar (#80), two ways. "For you":
// this term's and the next term's deadlines and what each means for the
// Student, grouped by how soon (running, this week, this month, this
// semester, next semester folded), a marker for today, near countdowns in
// bold, each with one short line for this Student (KRS sent, UKT paid, SKS
// against the progress check); past ones folded away. "Full calendar": every
// event ITB lists, by month, ITB's own title first, with chips and a search,
// so a dense calendar stays readable. The view picked stays while the app is
// open; ITB's calendar is named and linked, with when it was last checked.
// Works without SIX.
import { Fragment, useRef, useState } from "react";
import { CALENDAR_GROUPS, type CalendarEntry, type CalendarGroup, DEADLINE_KINDS, type Deadline, fullCalendar } from "../../../core/academic";
import { itbCalendar } from "../../../core/links";
import type { AcademicCalendar } from "../../../core/models";
import type { StringKey } from "../../../core/strings";
import { useDeadlines, useThisTerm } from "../../deadlines";
import { useOpenExternal } from "../../hooks";
import { useFormat, useLang, useNow, useT } from "../../i18n";
import { useDataset } from "../../store";
import { Button, Segmented } from "../../ui/controls";
import { cx } from "../../ui/cx";
import { EmptyState } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { List, Meta } from "../../ui/layout";
import { WebLink } from "../../ui/rich-text";
import { useViewChoice } from "../../view-choice";
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

export function Tab(_: { onCalendar?: () => void }) {
  const t = useT();
  const calendar = useDataset("itb.calendar");
  const [view, setView] = useViewChoice<"mine" | "all">("deadlines.view", "mine");
  if (!calendar) return <EmptyState icon={<Icons.CalendarClock className="size-5" />} title={t("deadlines.empty")} />;
  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="text-small text-muted">{t(view === "mine" ? "deadlines.intro" : "calendar.intro")}</p>
          <Source calendar={calendar} />
        </div>
        <Segmented
          label={t("deadlines.view")}
          value={view}
          onChange={setView}
          options={[
            { value: "mine", label: t("deadlines.view.mine") },
            { value: "all", label: t("deadlines.view.all") },
          ]}
        />
      </div>
      {view === "mine" ? <ForYou /> : <EveryEvent />}
    </div>
  );
}

/** "Dari Kalender Pendidikan ITB 2026/2027 · diperiksa 2 jam yang lalu": where every date here comes from, to read for oneself, and how fresh it is. */
function Source({ calendar }: { calendar: AcademicCalendar }) {
  const t = useT();
  const f = useFormat();
  const open = useOpenExternal();
  const { url, year } = itbCalendar(useThisTerm(), calendar);
  return (
    <p className="mt-0.5 text-caption text-muted">
      <Meta>
        <span>
          {t("deadlines.from")}{" "}
          <WebLink href={url} onOpen={open}>
            {year ? t("deadlines.source", { years: `${year}/${year + 1}` }) : t("deadlines.sourcePlain")}
          </WebLink>
        </span>
        {t("deadlines.checked", { when: f.fromNow(calendar.checkedAt) })}
      </Meta>
    </p>
  );
}

function ForYou() {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const term = useThisTerm();
  const termYears = useTermYears();
  const { upcoming, past } = useDeadlines();
  const [nextOpen, setNextOpen] = useState(false);
  const grouped = new Map<Group, Deadline[]>();
  const termEnd = Math.max(0, ...[...upcoming, ...past].filter((d) => d.event.term === term).map((d) => d.event.end));
  for (const d of upcoming) {
    const g = groupOf(d, now, term, termEnd);
    grouped.set(g, [...(grouped.get(g) ?? []), d]);
  }
  return (
    // The lists' width decides their columns (DEADLINE_COLUMNS), not the window's.
    <div className="@container">
      <div className="space-y-6">
        {GROUPS.map((group) => {
          const items = grouped.get(group);
          if (!items?.length) return null;
          const collapsed = group === "next" && !nextOpen;
          // "Semester depan" names its term once, when its events share one, instead of on every row.
          const terms = new Set(items.flatMap((d) => (d.event.term ? [d.event.term] : [])));
          const named = group === "next" && terms.size === 1 ? [...terms][0] : null;
          return (
            <Fragment key={group}>
              {group !== "now" && group === GROUPS.find((g) => g !== "now" && grouped.get(g)?.length) && (
                <p className="flex items-center gap-2 text-caption font-semibold text-accent-fg">
                  <span className="size-2 rounded-full bg-accent" />
                  {t("deadlines.todayAt", { date: `${f.weekdayShort(now)}, ${f.dayMonth(now)}` })}
                  <span className="h-px flex-1 bg-accent/40" />
                </p>
              )}
              <section aria-labelledby={`deadlines-${group}`}>
                <h3 id={`deadlines-${group}`} className="mb-2 flex items-center gap-2 text-small font-semibold">
                  {group === "next" ? (
                    <button
                      type="button"
                      aria-expanded={!collapsed}
                      onClick={() => setNextOpen(!nextOpen)}
                      className="focus-ring -mx-1 inline-flex items-center gap-1.5 rounded-md px-1 hover:text-fg"
                    >
                      <Icons.ChevronRight className={cx("size-3.5 text-faint transition-transform duration-150", !collapsed && "rotate-90")} />
                      {named ? (
                        <Meta>
                          {t(`deadlines.group.${group}`)}
                          <span className="font-medium text-muted">{termYears(named)}</span>
                        </Meta>
                      ) : (
                        t(`deadlines.group.${group}`)
                      )}
                    </button>
                  ) : (
                    t(`deadlines.group.${group}`)
                  )}
                  <span className="font-medium text-faint tabular-nums">{items.length}</span>
                </h3>
                {!collapsed && (
                  <List className={DEADLINE_COLUMNS}>
                    {items.map((deadline) => (
                      <DeadlineRow key={deadline.event.id} deadline={deadline} showTerm={deadline.event.term !== term && deadline.event.term !== named} />
                    ))}
                  </List>
                )}
              </section>
            </Fragment>
          );
        })}
      </div>
      {past.length > 0 && (
        <details className="group mt-8">
          <summary className="focus-ring inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md text-small font-medium text-muted hover:text-fg [&::-webkit-details-marker]:hidden">
            <Icons.ChevronRight className="size-3.5 transition-transform duration-150 group-open:rotate-90" />
            {t("deadlines.past")}
            <span className="text-faint tabular-nums">{past.length}</span>
          </summary>
          <List className={cx("mt-3", DEADLINE_COLUMNS)}>
            {past.map((deadline) => (
              <DeadlineRow key={deadline.event.id} deadline={deadline} showTerm={deadline.event.term !== term} />
            ))}
          </List>
        </details>
      )}
    </div>
  );
}

/**
 * A list of deadlines shares its columns (each row a subgrid), so the dates stay on one line ("30 Nov – 11 Des")
 * and the titles still line up: the date column keeps its usual 112px (128px with the row's padding) and grows, for
 * every row, to a range that needs more. In a narrow list (zoomed in far) a row stacks its date, what it is and
 * "dalam 3 hari" in one column, so the title keeps the list's width instead of being squeezed to nothing.
 */
const DEADLINE_COLUMNS = "grid grid-cols-[minmax(128px,auto)_minmax(0,1fr)_auto] gap-x-4 @max-md:grid-cols-1";

/** `showTerm`: the event's term, only where it isn't the one the Student is reading about (this term, or the group's). */
function DeadlineRow({ deadline, showTerm }: { deadline: Deadline; showTerm: boolean }) {
  const t = useT();
  const lang = useLang();
  const f = useFormat();
  const termYears = useTermYears();
  const { event, meaning, variant, when } = deadline;
  const at = (iso: string) => Date.parse(`${iso}T12:00:00+07:00`);
  const first = at(event.firstDay);
  const last = at(event.lastDay);
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
  return (
    <li className="col-span-full grid grid-cols-subgrid">
      <div className={cx("col-span-full grid grid-cols-subgrid items-start px-4 py-3 @max-md:gap-y-1", when === "past" && "text-muted")}>
        <span className="text-body font-semibold whitespace-nowrap tabular-nums">
          {dates}
          <span className="block text-caption font-normal text-faint">{days}</span>
        </span>
        <span className="min-w-0">
          <span className="block text-body font-medium" title={event.title}>
            <Meta>
              {t(`deadline.kind.${event.kind}` as StringKey)}
              {variant ? <span className="font-normal text-muted">{t(`deadline.variant.${variant}`)}</span> : null}
              {showTerm && event.term ? <span className="font-normal text-faint">{termYears(event.term)}</span> : null}
            </Meta>
          </span>
          {meaning && (
            <span
              className={cx(
                "mt-0.5 flex items-start gap-1.5 text-small",
                warn ? "font-medium text-warning-fg" : meaning.done ? "text-success-fg" : "text-muted",
              )}
            >
              {meaning.done && <Icons.Check className="mt-[3px] size-3 shrink-0" weight="bold" />}
              {warn && <Icons.AlertTriangle className="mt-[3px] size-3 shrink-0" weight="bold" />}
              {t(meaning.key, meaning.vars)}
            </span>
          )}
        </span>
        <span
          className={cx(
            "pt-0.5 text-right text-small whitespace-nowrap @max-md:pt-0 @max-md:text-left",
            when === "now" ? "font-semibold text-success-fg" : near ? "font-semibold text-warning-fg" : "text-faint",
          )}
        >
          {when === "now" ? t("deadlines.now") : new Intl.RelativeTimeFormat(lang, { numeric: "auto" }).format(offset, "day")}
        </span>
      </div>
    </li>
  );
}

/** "Oktober 2026" from "2026-10". */
function useMonthName(): (month: string) => string {
  const lang = useLang();
  const format = new Intl.DateTimeFormat(lang === "id" ? "id-ID" : "en-GB", { month: "long", year: "numeric", timeZone: "Asia/Jakarta" });
  return (month) => format.format(Date.parse(`${month}-15T12:00:00+07:00`));
}

/** The full calendar: every event, by month, with chips and a search; months already over are folded until asked for or searched. */
function EveryEvent() {
  const t = useT();
  const f = useFormat();
  const now = useNow();
  const monthName = useMonthName();
  const calendar = useDataset("itb.calendar");
  const krs = useDataset("six.krs");
  const bills = useDataset("six.bills");
  const progress = useDataset("six.progress");
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<ReadonlySet<CalendarGroup>>(new Set());
  const [earlier, setEarlier] = useState(false);
  const search = useRef<HTMLInputElement>(null);
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
    <div>
      {/* The box shows the focus ring: the input itself is borderless inside it. */}
      <label className="flex h-9 items-center gap-2 rounded-lg bg-fill px-3 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-focus">
        <Icons.Search className="size-4 text-faint" />
        <input
          ref={search}
          value={query}
          aria-label={t("calendar.search")}
          placeholder={t("calendar.search")}
          onChange={(event) => setQuery(event.target.value)}
          className="h-full flex-1 bg-transparent text-body outline-none placeholder:text-faint"
        />
      </label>
      <fieldset className="mt-3">
        <legend className="sr-only">{t("calendar.chips")}</legend>
        <div className="flex flex-wrap gap-1.5">
          {CALENDAR_GROUPS.filter((g) => counts[g] > 0).map((group) => {
            const on = groups.has(group);
            return (
              <button
                key={group}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(group)}
                className={cx(
                  "focus-ring inline-flex h-7 items-center gap-1.5 rounded-full border px-3 text-small transition-colors duration-150",
                  on ? "border-fg/60 bg-selected font-semibold text-fg" : "border-edge text-muted hover:bg-hover hover:text-fg",
                )}
              >
                {on && <Icons.Check className="size-3" weight="bold" />}
                {t(`calendar.group.${group}`)}
                <span className="font-normal text-faint tabular-nums">{counts[group]}</span>
              </button>
            );
          })}
        </div>
      </fieldset>
      <p className="mt-3 flex items-center gap-3 text-caption text-muted">
        {/* Only the count is announced as it changes, not the button beside it. */}
        <span role="status">{filtered ? t("calendar.countOf", { shown, count: total }) : t("calendar.count", { count: total })}</span>
        {filtered && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setGroups(new Set());
              // The button goes with the filters: focus goes back to the search, where the next one starts.
              search.current?.focus();
            }}
            className="focus-ring rounded font-medium text-accent-fg hover:underline"
          >
            {t("calendar.clear")}
          </button>
        )}
      </p>
      {before.length > 0 && (
        // Stays where it is, so focus does too, and folds them again.
        <Button
          variant="ghost"
          size="sm"
          className="mt-3 -ml-2.5"
          aria-expanded={earlier}
          onClick={() => setEarlier(!earlier)}
          icon={earlier ? <Icons.ChevronDown className="size-3.5" /> : <Icons.ChevronRight className="size-3.5" />}
        >
          {t(earlier ? "calendar.earlierHide" : "calendar.earlier", { count: before.length })}
        </Button>
      )}
      {shown === 0 && <p className="mt-6 rounded-xl bg-sunken px-4 py-6 text-center text-small text-muted">{t("calendar.none")}</p>}
      <div className="mt-4 space-y-5">
        {visible.map(({ month, entries }) => {
          // The line for today sits before the month's first event still to come.
          const todayAt = month === thisMonth ? entries.findIndex((e) => e.when !== "past") : -2;
          return (
            <section key={month} aria-labelledby={`month-${month}`}>
              <h3 id={`month-${month}`} className="sticky top-0 z-10 -mx-1 mb-1.5 flex items-baseline gap-2 bg-canvas px-1 py-1 text-small font-semibold">
                {monthName(month)}
                <span className="font-medium text-faint tabular-nums">{entries.length}</span>
              </h3>
              <List>
                {entries.map((entry, i) => (
                  <Fragment key={entry.event.id}>
                    {i === todayAt && <TodayLine label={t("deadlines.todayAt", { date: `${f.weekdayShort(now)}, ${f.dayMonth(now)}` })} />}
                    <EventRow entry={entry} />
                  </Fragment>
                ))}
                {todayAt === -1 && <TodayLine label={t("deadlines.todayAt", { date: `${f.weekdayShort(now)}, ${f.dayMonth(now)}` })} />}
              </List>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function TodayLine({ label }: { label: string }) {
  return (
    <li aria-label={label} className="flex items-center gap-2 px-4 py-1.5 text-caption font-semibold text-accent-fg">
      <span className="size-2 rounded-full bg-accent" />
      {label}
      <span className="h-px flex-1 bg-accent/40" />
    </li>
  );
}

/** Meanings that only say again what ITB's title says ("Masa Ujian Tengah Semester": "Midterm exam week."); the search still finds them. */
const RESTATED: ReadonlySet<StringKey> = new Set<StringKey>(["deadline.uts", "deadline.lectureStart"]);

/** One event, compact (one line unless the app has something to say about it): its days, ITB's title, and what it means. */
function EventRow({ entry }: { entry: CalendarEntry }) {
  const t = useT();
  const f = useFormat();
  const { event, when } = entry;
  const meaning = entry.meaning && !RESTATED.has(entry.meaning.key) ? entry.meaning : null;
  const noon = (day: string) => Date.parse(`${day}T12:00:00+07:00`);
  const days =
    event.firstDay === event.lastDay ? f.weekdayShort(noon(event.firstDay)) : `${f.weekdayShort(noon(event.firstDay))}–${f.weekdayShort(noon(event.lastDay))}`;
  const warn = meaning?.warn && when !== "past";
  return (
    <li className={cx("grid grid-cols-[164px_minmax(0,1fr)] items-baseline gap-4 px-4 py-2", when === "past" && "text-muted")}>
      <span className="text-small font-semibold whitespace-nowrap tabular-nums">
        {f.dayRange(event.firstDay, event.lastDay)}
        <span className="ml-1.5 font-normal text-faint">{days}</span>
      </span>
      <span className="min-w-0">
        <span className="block text-body">
          {entry.title}
          {when === "now" && <span className="ml-2 text-small font-semibold text-success-fg">{t("deadlines.now")}</span>}
        </span>
        {(meaning || entry.revised) && (
          <Meta className={cx("mt-0.5 text-small", warn ? "font-medium text-warning-fg" : meaning?.done && when !== "past" ? "text-success-fg" : "text-muted")}>
            {meaning ? t(meaning.key, meaning.vars) : null}
            {entry.revised ? <span className="text-faint">{t("calendar.revised")}</span> : null}
          </Meta>
        )}
      </span>
    </li>
  );
}
