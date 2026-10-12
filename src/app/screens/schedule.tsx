// Jadwal (#77): the week as a real timetable (the default) and the month as
// what's unusual in it. SIX's classes with their rooms, exams, lectures that
// may not run in an exam week, classes moved or clashing, meetings only
// Edunex announced, Presence by handing in a Task, deadlines and ITB's
// calendar. Each block opens its details in place; the week and view the
// Student chose stay while the app is open. Without SIX, what Edunex knows.
// The phone calendar export lives here too.
import { useCallback, useMemo, useState } from "react";
import { wibDay } from "../../core/course-meetings";
import { dayStart, monthGrid, shiftDay, termWeek, weekStart } from "../../core/schedule";
import { useFormat, useLang, useNow, useT } from "../i18n";
import { useScheduleInput } from "../schedule-data";
import { useSignIn } from "../shell/source-status";
import { type AppStore, useStatus, useStore } from "../store";
import { Button, IconButton, Segmented } from "../ui/controls";
import { cx } from "../ui/cx";
import { Skeleton } from "../ui/display";
import { Icons } from "../ui/icons";
import { Meta, Page, PageHeader } from "../ui/layout";
import { Tooltip } from "../ui/overlays";
import { ScheduleWorldProvider } from "./schedule/details";
import { ExportButton } from "./schedule/export";
import { MonthView } from "./schedule/month";
import { WeekView } from "./schedule/week";

export { ExportButton } from "./schedule/export";

export const ready = true;

/** The count shown next to this screen in the sidebar, if any. */
export function useBadge(): { value: number; tone: "neutral" | "warning" } | null {
  return null;
}

type View = "week" | "month";

/** Where the Student is in Jadwal: the view, the week's Monday and the month ("2026-10"); null = the current one. */
interface Place {
  view: View;
  week: string | null;
  month: string | null;
}

/** Jadwal's place, kept for as long as the app is open (going to a course and back keeps it). */
const places = new WeakMap<AppStore, Place>();

function usePlace(): [Place, (patch: Partial<Place>) => void] {
  const store = useStore();
  const [place, setPlace] = useState<Place>(() => places.get(store) ?? { view: "week", week: null, month: null });
  const update = useCallback(
    (patch: Partial<Place>) =>
      setPlace((current) => {
        const next = { ...current, ...patch };
        places.set(store, next);
        return next;
      }),
    [store],
  );
  return [place, update];
}

/** Months from "2026-10" to "2027-01": 3. */
const monthsBetween = (from: string, to: string) => {
  const [a, b] = [from, to].map((m) => m.split("-").map(Number));
  return (b[0] - a[0]) * 12 + (b[1] - a[1]);
};

export function ScheduleScreen() {
  const t = useT();
  const f = useFormat();
  const lang = useLang();
  const now = useNow();
  const input = useScheduleInput();
  const six = useStatus("six");
  const [place, setPlace] = usePlace();
  const today = wibDay(now);
  const thisWeek = weekStart(today);
  const thisMonth = today.slice(0, 7);
  const monday = place.week ?? thisWeek;
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => shiftDay(monday, i)), [monday]);
  const month = useMemo(() => monthGrid(now, monthsBetween(thisMonth, place.month ?? thisMonth)), [now, thisMonth, place.month]);
  const week = place.view === "week";
  const current = week ? monday === thisWeek : month.month === thisMonth;

  const step = (by: number) =>
    week ? setPlace({ week: shiftDay(monday, by * 7) }) : setPlace({ month: monthGrid(now, monthsBetween(thisMonth, month.month) + by).month });
  const showWeek = (day: string) => setPlace({ view: "week", week: weekStart(day) });
  const n = input ? termWeek(input.events, monday) : null;
  const range = f.dayRange(days[0]!, days[6]!);
  const description = week
    ? n
      ? t("schedule.weekOf", { n, range })
      : range
    : new Intl.DateTimeFormat(lang === "id" ? "id-ID" : "en-GB", { month: "long", year: "numeric" }).format(dayStart(`${month.month}-15`));
  const waiting = !input || (!input.six && (six.state === "connecting" || six.state === "live"));
  const visible = week ? days : month.weeks.flat().filter((day) => day.startsWith(month.month));
  const unpublished = input?.six && !visible.some((day) => input.months.includes(day.slice(0, 7)));

  return (
    <Page width="wide">
      <PageHeader
        className="mb-5"
        title={t("nav.schedule")}
        description={<span className="tabular-nums">{description}</span>}
        actions={
          <>
            <Segmented
              label={t("schedule.view")}
              value={place.view}
              onChange={(view) => setPlace({ view })}
              options={[
                { value: "week", label: t("schedule.view.week") },
                { value: "month", label: t("schedule.view.month") },
              ]}
            />
            <div className="flex items-center">
              <Tooltip content={t(week ? "schedule.prevWeek" : "schedule.prevMonth")}>
                <IconButton label={t(week ? "schedule.prevWeek" : "schedule.prevMonth")} onClick={() => step(-1)}>
                  <Icons.ChevronLeft className="size-4" />
                </IconButton>
              </Tooltip>
              {/* On the current week it's there but does nothing: never disabled, so it doesn't look broken and focus stays on it after the press that brought the Student back. */}
              <Button
                variant="ghost"
                aria-disabled={current || undefined}
                onClick={() => !current && setPlace(week ? { week: null } : { month: null })}
                className={cx("px-2.5 text-fg", current && "cursor-default hover:bg-transparent active:scale-100")}
              >
                {t(week ? "schedule.thisWeek" : "schedule.thisMonth")}
              </Button>
              <Tooltip content={t(week ? "schedule.nextWeek" : "schedule.nextMonth")}>
                <IconButton label={t(week ? "schedule.nextWeek" : "schedule.nextMonth")} onClick={() => step(1)}>
                  <Icons.ChevronRight className="size-4" />
                </IconButton>
              </Tooltip>
            </div>
            <ExportButton />
          </>
        }
      />

      {waiting ? (
        <GridSkeleton />
      ) : (
        <ScheduleWorldProvider>
          {!input.six && <NeedsSix />}
          {unpublished && (
            <p className="mb-3 flex items-center gap-2 rounded-lg bg-sunken px-3.5 py-2 text-small text-muted">
              <Icons.Info className="size-3.5 shrink-0" />
              {t("schedule.notCovered")}
            </p>
          )}
          {week ? <WeekView days={days} input={input} /> : <MonthView month={month} input={input} onShowWeek={showWeek} />}
        </ScheduleWorldProvider>
      )}
    </Page>
  );
}

/** Without SIX: one slim line saying what SIX adds, with the way in. */
function NeedsSix() {
  const t = useT();
  const six = useStatus("six");
  const { signIn, busy } = useSignIn();
  return (
    <div className="mb-3 flex items-center gap-3 rounded-lg border border-edge bg-sunken py-1.5 pr-1.5 pl-3.5 text-small">
      <Icons.Lock className="size-3.5 shrink-0 text-muted" />
      <Meta className="flex-1">
        <span className="font-semibold">{t("schedule.needsSix")}</span>
        <span className="text-muted">{t("schedule.needsSix.hint")}</span>
      </Meta>
      {six.state === "signed-out" && (
        <Button size="sm" busy={busy} onClick={() => void signIn("six")}>
          {t("schedule.signInSix")}
        </Button>
      )}
    </div>
  );
}

/** While SIX's timetable is on its way: the shape of a week. */
function GridSkeleton() {
  return (
    <div aria-busy="true" className="mt-2 grid grid-cols-[48px_repeat(5,minmax(0,1fr))_36px_36px] gap-x-px">
      <span />
      {Array.from({ length: 7 }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: placeholder columns have no identity and never move
        <div key={i} className="space-y-2 border-l border-line px-1.5 pt-1">
          <Skeleton className="h-3 w-8" />
          <Skeleton className="h-6 w-6 rounded-full" />
          {i < 5 && i % 2 === 1 && <Skeleton className="mt-6 h-20 w-full" />}
          {i < 5 && i % 2 === 0 && <Skeleton className="mt-24 h-16 w-full" />}
        </div>
      ))}
    </div>
  );
}
