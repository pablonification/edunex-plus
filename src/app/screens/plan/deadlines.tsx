// Rencana studi tab — ITB's academic deadlines and what each means for the
// Student (#80): this term's and the next term's dates from ITB's calendar,
// the next ones first, each with one short line for this Student (KRS sent,
// UKT paid, SKS against the progress check); past ones folded away.
import { academicDeadlines, type Deadline } from "../../../core/academic";
import type { StringKey } from "../../../core/strings";
import { useFormat, useLang, useNow, useT } from "../../i18n";
import { useDataset } from "../../store";
import { cx } from "../../ui/cx";
import { Card, EmptyState, SourceTag } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { useThisTerm } from "./bills";

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

export function Tab() {
  const t = useT();
  const { calendar, upcoming, past } = useDeadlines();
  if (!calendar) return <EmptyState icon={<Icons.CalendarClock className="size-5" />} title={t("deadlines.empty")} />;
  return (
    <div>
      <p className="mb-4 flex items-center gap-2 text-small text-muted">
        <SourceTag source="itb" />
        {t("deadlines.intro")}
      </p>
      <Card className="overflow-hidden">
        <ol className="divide-y divide-line">
          {upcoming.map((deadline) => (
            <Row key={deadline.event.id} deadline={deadline} />
          ))}
        </ol>
      </Card>
      {past.length > 0 && (
        <details className="group mt-5">
          <summary className="focus-ring inline-flex cursor-pointer list-none items-center gap-1.5 rounded-md text-small font-medium text-muted hover:text-fg [&::-webkit-details-marker]:hidden">
            <Icons.ChevronRight className="size-3.5 transition-transform duration-150 group-open:rotate-90" />
            {t("deadlines.past")}
            <span className="text-faint tabular-nums">{past.length}</span>
          </summary>
          <Card className="mt-3 overflow-hidden">
            <ol className="divide-y divide-line">
              {past.map((deadline) => (
                <Row key={deadline.event.id} deadline={deadline} />
              ))}
            </ol>
          </Card>
        </details>
      )}
    </div>
  );
}

function Row({ deadline }: { deadline: Deadline }) {
  const t = useT();
  const lang = useLang();
  const f = useFormat();
  const { event, meaning, variant, when } = deadline;
  const day = (iso: string) => f.dayMonth(Date.parse(`${iso}T12:00:00+07:00`));
  const first = Date.parse(`${event.firstDay}T12:00:00+07:00`);
  const dates = event.firstDay === event.lastDay ? day(event.firstDay) : `${day(event.firstDay)} – ${day(event.lastDay)}`;
  return (
    <li className={cx("grid grid-cols-[150px_minmax(0,1fr)_auto] items-start gap-4 px-4 py-3.5", when === "past" && "text-muted")}>
      <span className="text-body font-semibold tabular-nums">
        {dates}
        <span className="block text-caption font-normal text-faint">{f.weekdayShort(first)}</span>
      </span>
      <span className="min-w-0">
        <span className="block text-body font-medium" title={event.title}>
          {t(`deadline.kind.${event.kind}` as StringKey)}
          {variant && <span className="font-normal text-muted"> · {t(`deadline.variant.${variant}`)}</span>}
          {event.term && <span className="font-normal text-faint"> · {f.term(event.term)}</span>}
        </span>
        {meaning && (
          <span
            className={cx(
              "mt-0.5 flex items-start gap-1.5 text-small",
              meaning.warn && when !== "past" ? "font-medium text-warning-fg" : meaning.done ? "text-success-fg" : "text-muted",
            )}
          >
            {meaning.done && <Icons.Check className="mt-[3px] size-3 shrink-0" strokeWidth={2.5} />}
            {meaning.warn && when !== "past" && <Icons.AlertTriangle className="mt-[3px] size-3 shrink-0" />}
            {t(meaning.key, meaning.vars)}
          </span>
        )}
      </span>
      <span className={cx("text-right text-caption whitespace-nowrap", when === "now" ? "font-semibold text-success-fg" : "text-faint")}>
        {when === "now" ? t("deadlines.now") : new Intl.RelativeTimeFormat(lang, { numeric: "auto" }).format(f.dayOffset(event.start), "day")}
      </span>
    </li>
  );
}
