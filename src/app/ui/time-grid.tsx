// A week as a time grid: a column per day under a time axis, so a block's
// height is its length and things that share time sit side by side. Days
// with nothing on them shrink, so busy days get the room; today and special
// periods (an exam week, a holiday) are tinted; a band over the columns
// names a period ("Masa UTS · 12–16 Okt"); a lane under the day headers
// holds what isn't a place to be (deadlines); a red line marks now. Screens
// put their own blocks in with GridBlock.
import { type CSSProperties, createContext, type ReactNode, useContext } from "react";
import { cx } from "./cx";

/** Minutes after midnight. */
export interface Hours {
  from: number;
  to: number;
}

export interface GridDay {
  key: string;
  /** The day's name for screen readers ("Kamis, 8 Oktober"). */
  label: string;
  head: ReactNode;
  /** wide: shares the free width; narrow: an empty weekday; slim: an empty weekend day. */
  size: "wide" | "narrow" | "slim";
  /** today, or a period without regular lectures (exam week, holiday). */
  tone?: "today" | "off" | null;
  /** Things that aren't a place to be: deadlines, hand-in windows. */
  lane?: ReactNode;
  /** GridBlocks. */
  children?: ReactNode;
  /** Said at the top of an empty day. */
  note?: ReactNode;
  /** Minutes after midnight now, on today's column only. */
  now?: number | null;
}

export interface GridBand {
  /** First and last day (indexes into `days`, inclusive). */
  from: number;
  to: number;
  label: ReactNode;
  key: string;
}

const AXIS = 48;
const SIZE = { wide: "minmax(0,1fr)", narrow: "56px", slim: "36px" } as const;

const GridContext = createContext<{ hours: Hours; hourHeight: number }>({ hours: { from: 420, to: 1080 }, hourHeight: 44 });

/** Minutes → pixels from the top of the day. */
const useY = () => {
  const { hours, hourHeight } = useContext(GridContext);
  return (minute: number) => ((Math.min(Math.max(minute, hours.from), hours.to) - hours.from) * hourHeight) / 60;
};

export function TimeGrid({
  days,
  hours,
  bands = [],
  laneLabel,
  hourLabel,
  hourHeight = 44,
  className,
}: {
  days: readonly GridDay[];
  hours: Hours;
  bands?: readonly GridBand[];
  laneLabel?: ReactNode;
  /** "08:00" for a minute of the day. */
  hourLabel: (minute: number) => string;
  hourHeight?: number;
  className?: string;
}) {
  const columns = `${AXIS}px ${days.map((day) => SIZE[day.size]).join(" ")}`;
  const lane = days.some((day) => day.lane);
  const height = ((hours.to - hours.from) * hourHeight) / 60;
  const rows = lane ? `auto auto ${height}px` : `auto ${height}px`;
  const marks: number[] = [];
  for (let minute = hours.from; minute <= hours.to; minute += 60) marks.push(minute);
  // Bands that share days go on separate lines.
  const lines: GridBand[][] = [];
  for (const band of [...bands].sort((a, b) => a.from - b.from)) {
    const line = lines.find((l) => l.every((other) => other.to < band.from || other.from > band.to));
    if (line) line.push(band);
    else lines.push([band]);
  }
  const subgrid: CSSProperties = { display: "grid", gridTemplateRows: "subgrid", gridRow: "1 / -1" };

  return (
    <GridContext.Provider value={{ hours, hourHeight }}>
      <div className={className}>
        {lines.length > 0 && (
          <div className="mb-1.5 grid gap-y-1" style={{ gridTemplateColumns: columns }}>
            {lines.flatMap((line, row) =>
              line.map((band) => (
                <div
                  key={band.key}
                  className="flex h-6 min-w-0 items-center gap-1.5 rounded-md bg-(--source-itb-bg) px-2 text-caption font-semibold text-(--source-itb-fg)"
                  style={{ gridColumn: `${band.from + 2} / ${band.to + 3}`, gridRow: row + 1 }}
                >
                  {band.label}
                </div>
              )),
            )}
          </div>
        )}
        <div className="grid" style={{ gridTemplateColumns: columns, gridTemplateRows: rows }}>
          <div aria-hidden style={{ ...subgrid, gridColumn: 1 }}>
            <div />
            {lane && <div className="self-center pr-2 text-right text-micro font-medium text-faint">{laneLabel}</div>}
            <div className="relative">
              {marks.map((minute) => (
                <span
                  key={minute}
                  className="absolute right-2 -translate-y-1/2 text-micro text-faint tabular-nums first:translate-y-0"
                  style={{ top: ((minute - hours.from) * hourHeight) / 60 }}
                >
                  {minute < hours.to && hourLabel(minute)}
                </span>
              ))}
            </div>
          </div>
          {days.map((day, i) => (
            <section
              key={day.key}
              aria-label={day.label}
              className={cx(
                "min-w-0 border-l border-line",
                day.tone === "today" ? "bg-info-bg/45" : day.tone === "off" ? "bg-(--source-itb-bg)/40" : null,
                i === days.length - 1 && "border-r",
              )}
              style={{ ...subgrid, gridColumn: i + 2 }}
            >
              <div className="min-w-0 border-b border-line px-1.5 pt-1 pb-2">{day.head}</div>
              {lane && <div className="min-w-0 space-y-1 border-b border-line p-1">{day.lane}</div>}
              <div
                className="relative min-w-0"
                style={{ backgroundImage: "linear-gradient(to bottom, var(--line) 1px, transparent 1px)", backgroundSize: `100% ${hourHeight}px` }}
              >
                {day.note && <div className="px-1 pt-2 text-center text-caption text-faint">{day.note}</div>}
                {day.children}
                {day.now != null && day.now >= hours.from && day.now <= hours.to && <NowLine minute={day.now} />}
              </div>
            </section>
          ))}
        </div>
      </div>
    </GridContext.Provider>
  );
}

function NowLine({ minute }: { minute: number }) {
  const y = useY();
  return (
    // Behind the blocks: it marks the time without running through a class's text (the class going on shows it itself).
    <div aria-hidden className="pointer-events-none absolute inset-x-0 z-5" style={{ top: y(minute) }}>
      <div className="h-0.5 -translate-y-1/2 bg-danger-fg" />
      <div className="absolute top-0 -left-1 size-2 -translate-y-1/2 rounded-full bg-danger-fg" />
    </div>
  );
}

/**
 * A block in a day, placed by its time: `start` and `end` in minutes after
 * midnight, `column` of `columns` when it shares time with others.
 */
export function GridBlock({
  start,
  end,
  column = 0,
  columns = 1,
  minHeight = 22,
  className,
  children,
}: {
  start: number;
  end: number;
  column?: number;
  columns?: number;
  minHeight?: number;
  className?: string;
  children: ReactNode;
}) {
  const y = useY();
  const top = y(start);
  const height = Math.max(minHeight, y(end) - top);
  const width = 100 / columns;
  return (
    <div className={cx("absolute z-10 px-[3px] pt-px", className)} style={{ top, height, left: `${column * width}%`, width: `${width}%` }}>
      {children}
    </div>
  );
}

/**
 * A part of the day's time drawn over the blocks, unclickable (the shared
 * minutes of a clash): from column `from` through `to` of `columns`.
 */
export function GridMark({
  start,
  end,
  from = 0,
  to,
  columns = 1,
  className,
}: {
  start: number;
  end: number;
  from?: number;
  to?: number;
  columns?: number;
  className?: string;
}) {
  const y = useY();
  const top = y(start);
  const width = 100 / columns;
  return (
    <div
      aria-hidden
      className={cx("pointer-events-none absolute z-15", className)}
      style={{
        top,
        height: Math.max(4, y(end) - top),
        left: `calc(${from * width}% + 2px)`,
        width: `calc(${((to ?? columns - 1) - from + 1) * width}% - 4px)`,
      }}
    />
  );
}
