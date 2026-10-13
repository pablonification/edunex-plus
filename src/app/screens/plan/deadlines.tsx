// Rencana studi tab — ITB's academic deadlines and what each means for the
// Student (#80): this term's and the next term's dates from ITB's calendar,
// grouped by how soon (running, this week, this month, this semester, next
// semester folded), a marker for today, near countdowns in bold, each with
// one short line for this Student (KRS sent, UKT paid, SKS against the
// progress check); past ones folded away. Works without SIX.
import { type CSSProperties, Fragment, useState } from "react";
import { academicDeadlines, type Deadline } from "../../../core/academic";
import type { StringKey } from "../../../core/strings";
import { useFormat, useLang, useNow, useT } from "../../i18n";
import { useDataset } from "../../store";
import { cx } from "../../ui/cx";
import { EmptyState } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { List, Meta } from "../../ui/layout";
import { useThisTerm } from "./bills";
import { useTermYears } from "./projection";

export const ready = true;

function useDeadlines() {
  const calendar = useDataset("itb.calendar");
  const krs = useDataset("six.krs");
  const bills = useDataset("six.bills");
  const progress = useDataset("six.progress");
  const term = useThisTerm();
  const now = useNow();
  return { calendar, ...academicDeadlines({ calendar, term, now, krs, bills, progress }) };
}

/** The questionnaire running now: SIX hides grades until it's filled. (KRS and UKT count in their own tabs.) */
export function useBadge(): { value: number; tone: "neutral" | "warning" } | null {
  const { upcoming } = useDeadlines();
  const value = upcoming.filter((d) => d.when === "now" && d.event.kind === "questionnaire").length;
  return value > 0 ? { value, tone: "warning" } : null;
}

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
  const f = useFormat();
  const now = useNow();
  const term = useThisTerm();
  const { calendar, upcoming, past } = useDeadlines();
  const [nextOpen, setNextOpen] = useState(false);
  if (!calendar) return <EmptyState icon={<Icons.CalendarClock className="size-5" />} title={t("deadlines.empty")} />;
  const grouped = new Map<Group, Deadline[]>();
  const termEnd = Math.max(0, ...[...upcoming, ...past].filter((d) => d.event.term === term).map((d) => d.event.end));
  for (const d of upcoming) {
    const g = groupOf(d, now, term, termEnd);
    grouped.set(g, [...(grouped.get(g) ?? []), d]);
  }
  let index = 0;
  return (
    <div className="max-w-[820px]">
      <p className="mb-5 text-small text-muted">{t("deadlines.intro")}</p>
      <div className="space-y-6">
        {GROUPS.map((group) => {
          const items = grouped.get(group);
          if (!items?.length) return null;
          const collapsed = group === "next" && !nextOpen;
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
                      {t(`deadlines.group.${group}`)}
                    </button>
                  ) : (
                    t(`deadlines.group.${group}`)
                  )}
                  <span className="font-medium text-faint tabular-nums">{items.length}</span>
                </h3>
                {!collapsed && (
                  <List>
                    {items.map((deadline) => (
                      <DeadlineRow key={deadline.event.id} deadline={deadline} index={index++} />
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
          <List className="mt-3">
            {past.map((deadline) => (
              <DeadlineRow key={deadline.event.id} deadline={deadline} />
            ))}
          </List>
        </details>
      )}
    </div>
  );
}

function DeadlineRow({ deadline, index }: { deadline: Deadline; index?: number }) {
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
    <li
      className={cx(index !== undefined && index < 10 && "motion-safe:stagger")}
      style={index !== undefined ? ({ "--i": index } as CSSProperties) : undefined}
    >
      <div className={cx("grid grid-cols-[112px_minmax(0,1fr)_auto] items-start gap-4 px-4 py-3", when === "past" && "text-muted")}>
        <span className="text-body font-semibold tabular-nums">
          {dates}
          <span className="block text-caption font-normal text-faint">{days}</span>
        </span>
        <span className="min-w-0">
          <span className="block text-body font-medium" title={event.title}>
            <Meta>
              {t(`deadline.kind.${event.kind}` as StringKey)}
              {variant ? <span className="font-normal text-muted">{t(`deadline.variant.${variant}`)}</span> : null}
              {event.term ? <span className="font-normal text-faint">{termYears(event.term)}</span> : null}
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
              {warn && <Icons.AlertTriangle className="mt-[3px] size-3 shrink-0" />}
              {t(meaning.key, meaning.vars)}
            </span>
          )}
        </span>
        <span
          className={cx(
            "pt-0.5 text-right text-small whitespace-nowrap",
            when === "now" ? "font-semibold text-success-fg" : near ? "font-semibold text-warning-fg" : "text-faint",
          )}
        >
          {when === "now" ? t("deadlines.now") : new Intl.RelativeTimeFormat(lang, { numeric: "auto" }).format(offset, "day")}
        </span>
      </div>
    </li>
  );
}
