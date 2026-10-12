// A compact line chart, the one chart spec of the app (Nilai's IP per
// semester, the planner's IPK path): a value axis with a clean range and
// hairline gridlines, a line series and a dot series, estimates drawn dashed
// and hollow, a labelled dashed reference line (a target), a direct label at
// the line's end, a hover/focus tooltip per column, and a table for screen
// readers. Drawn at the container's real width, so text never scales.
import { useLayoutEffect, useRef, useState } from "react";
import { cx } from "./cx";

export interface ChartSeries {
  name: string;
  /** "line": joined points (the IPK). "dots": points alone (each semester's IP). */
  kind: "line" | "dots";
  /** One value per column; null leaves a gap. */
  values: (number | null)[];
  color: string;
}

export interface LineChartProps {
  /** What the chart shows, for screen readers and the table's caption. */
  label: string;
  /** The x axis: one label per column ("Smt 1"). */
  columns: string[];
  /** Shorter column labels ("1") for when the full ones don't fit. */
  shortColumns?: string[];
  series: ChartSeries[];
  /** Columns from this index on are estimates: dashed lines, hollow dots. */
  estimateFrom?: number;
  min: number;
  max: number;
  /** Values with a hairline (and a tick label). */
  gridlines: number[];
  /** A dashed reference line with its label ("Target 3,50"). */
  reference?: { value: number; label: string };
  /** The text after the line's last point ("3,30 saat lulus"). */
  endLabel?: string;
  /** The word for an estimate in the tooltip ("Perkiraan"). */
  estimateWord?: string;
  format: (value: number) => string;
  height?: number;
  className?: string;
}

const PAD = { top: 12, right: 12, bottom: 26, left: 34 };

export function LineChart({
  label,
  columns,
  shortColumns,
  series,
  estimateFrom,
  min,
  max,
  gridlines,
  reference,
  endLabel,
  estimateWord,
  format,
  height = 168,
  className,
}: LineChartProps) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<number | null>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    setWidth(el.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const n = columns.length;
  const textWidth = (text: string) => text.length * 6.6 + 14;
  const endRoom = Math.min(140, Math.max(endLabel ? textWidth(endLabel) : 0, reference ? textWidth(reference.label) : 0));
  const plotW = Math.max(0, width - PAD.left - PAD.right - endRoom);
  const plotH = height - PAD.top - PAD.bottom;
  const step = n > 1 ? plotW / (n - 1) : 0;
  const x = (i: number) => PAD.left + (n > 1 ? i * step : plotW / 2);
  const y = (v: number) => PAD.top + ((max - Math.min(max, Math.max(min, v))) / (max - min)) * plotH;
  const estimate = (i: number) => estimateFrom !== undefined && i >= estimateFrom;
  const line = series.find((s) => s.kind === "line");
  const lastIndex = line ? line.values.findLastIndex((v) => v !== null) : -1;
  const widest = Math.max(...columns.map((c) => c.length)) * 6.6 + 8;
  const ticks = shortColumns && n > 1 && step < widest ? shortColumns : columns;
  // The reference's label sits past the plot's end, moved clear of the end label when they'd touch.
  const endY = line && lastIndex >= 0 ? y(line.values[lastIndex]!) : null;
  const refY = reference ? y(reference.value) : 0;
  const refLabelY = endLabel && endY !== null && Math.abs(endY - refY) < 15 ? (refY <= endY ? endY - 15 : endY + 15) : refY;

  const path = (values: (number | null)[], from: number, to: number) => {
    let d = "";
    let open = false;
    for (let i = from; i <= to; i++) {
      const v = values[i];
      if (v === null || v === undefined) {
        open = false;
        continue;
      }
      d += `${open ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
      open = true;
    }
    return d.trim();
  };
  const split = estimateFrom === undefined ? n : Math.max(0, estimateFrom);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: mouse hover only clears the tooltip; the same numbers are in the table for screen readers
    <div ref={box} className={cx("relative w-full", className)} onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} aria-hidden className="block overflow-visible">
          {gridlines.map((g) => (
            <g key={g}>
              <line x1={PAD.left} x2={PAD.left + plotW} y1={y(g)} y2={y(g)} stroke="var(--line)" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(g)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--faint)" className="tabular-nums">
                {format(g)}
              </text>
            </g>
          ))}
          {columns.map((c, i) => (
            <text
              // biome-ignore lint/suspicious/noArrayIndexKey: a column is its place on the axis; labels can repeat
              key={c + i}
              x={x(i)}
              y={height - 8}
              textAnchor="middle"
              fontSize={11}
              fill={estimate(i) ? "var(--muted)" : "var(--faint)"}
              fontWeight={hover === i ? 600 : 400}
            >
              {ticks[i]}
            </text>
          ))}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--edge)" strokeWidth={1} />}
          {reference && (
            <g>
              <line
                x1={PAD.left}
                x2={PAD.left + plotW}
                y1={y(reference.value)}
                y2={y(reference.value)}
                stroke="var(--muted)"
                strokeWidth={1.25}
                strokeDasharray="5 4"
              />
              <text x={PAD.left + plotW + 10} y={refLabelY} dy="0.32em" fontSize={11} fontWeight={600} fill="var(--muted)">
                {reference.label}
              </text>
            </g>
          )}
          {series.map((s) =>
            s.kind === "line" ? (
              <g key={s.name} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d={path(s.values, 0, Math.min(n - 1, split - 1))} />
                {split < n && <path d={path(s.values, Math.max(0, split - 1), n - 1)} strokeDasharray="5 4" />}
              </g>
            ) : null,
          )}
          {series.map((s) => (
            <g key={`${s.name}-dots`}>
              {s.values.map((v, i) =>
                v === null ? null : (
                  <circle
                    // biome-ignore lint/suspicious/noArrayIndexKey: a point is its column's place on the axis
                    key={i}
                    cx={x(i)}
                    cy={y(v)}
                    r={s.kind === "line" ? (i === lastIndex || hover === i ? 4 : 3) : hover === i ? 4.5 : 4}
                    fill={estimate(i) ? "var(--surface)" : s.color}
                    stroke={estimate(i) ? s.color : "var(--surface)"}
                    strokeWidth={estimate(i) ? 1.75 : 2}
                  />
                ),
              )}
            </g>
          ))}
          {line && endLabel && lastIndex >= 0 && (
            <text x={x(lastIndex) + 10} y={y(line.values[lastIndex]!)} dy="0.32em" fontSize={12} fontWeight={600} fill="var(--fg)">
              {endLabel}
            </text>
          )}
          {/* Hit areas: a column each, wider than the marks. */}
          {columns.map((c, i) => (
            // biome-ignore lint/a11y/noStaticElementInteractions: the hover area is for the mouse; the same numbers are in the table for screen readers
            <rect
              // biome-ignore lint/suspicious/noArrayIndexKey: a column is its place on the axis; labels can repeat
              key={`hit-${c}-${i}`}
              x={x(i) - Math.max(step, 24) / 2}
              y={PAD.top - 6}
              width={Math.max(step, 24)}
              height={plotH + 12}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
            />
          ))}
        </svg>
      )}
      {hover !== null && width > 0 && (
        <div
          className="pointer-events-none absolute z-10 min-w-[120px] -translate-x-1/2 rounded-lg bg-raised px-2.5 py-2 text-caption shadow-pop ring-1 ring-black/5 dark:ring-white/10"
          style={{ left: Math.min(Math.max(x(hover), 70), width - 70), top: 0 }}
        >
          <div className="font-semibold text-fg">
            {columns[hover]}
            {estimate(hover) && estimateWord && <span className="font-normal text-muted"> · {estimateWord}</span>}
          </div>
          {series.map((s) =>
            s.values[hover] === null || s.values[hover] === undefined ? null : (
              <div key={s.name} className="mt-0.5 flex items-center justify-between gap-3 text-muted">
                <span className="flex items-center gap-1.5">
                  <Key series={s} />
                  {s.name}
                </span>
                <span className="font-semibold text-fg tabular-nums">{format(s.values[hover]!)}</span>
              </div>
            ),
          )}
        </div>
      )}
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th scope="col" />
            {series.map((s) => (
              <th key={s.name} scope="col">
                {s.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {columns.map((c, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a row is its column's place on the axis; labels can repeat
            <tr key={c + i}>
              <th scope="row">
                {c}
                {estimate(i) && estimateWord ? ` (${estimateWord})` : ""}
              </th>
              {series.map((s) => (
                <td key={s.name}>{s.values[i] === null || s.values[i] === undefined ? "—" : format(s.values[i]!)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** The mark that names a series in a legend or tooltip: a short line, or a dot. */
export function Key({ series, dashed }: { series: Pick<ChartSeries, "kind" | "color">; dashed?: boolean }) {
  if (series.kind === "dots") return <span aria-hidden className="inline-block size-2 rounded-full" style={{ background: series.color }} />;
  return (
    <svg aria-hidden width={14} height={8} className="inline-block">
      <line x1={1} x2={13} y1={4} y2={4} stroke={series.color} strokeWidth={2} strokeLinecap="round" strokeDasharray={dashed ? "3 3" : undefined} />
    </svg>
  );
}

/** The chart's legend: each series' mark and name, then what dashed means. */
export function ChartLegend({
  series,
  estimate,
  reference,
}: {
  series: Pick<ChartSeries, "kind" | "color" | "name">[];
  estimate?: string;
  reference?: string;
}) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-muted">
      {series.map((s) => (
        <li key={s.name} className="inline-flex items-center gap-1.5">
          <Key series={s} />
          {s.name}
        </li>
      ))}
      {reference && (
        <li className="inline-flex items-center gap-1.5">
          <Key series={{ kind: "line", color: "var(--muted)" }} dashed />
          {reference}
        </li>
      )}
      {estimate && (
        <li className="inline-flex items-center gap-1.5">
          <span aria-hidden className="inline-block size-2 rounded-full border-[1.5px] border-muted" />
          {estimate}
        </li>
      )}
    </ul>
  );
}
