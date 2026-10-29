// The app's one chart (src/app/ui/chart.tsx) on the phone, for Nilai's IP per semester and the
// planner's IPK path: a value axis with hairline gridlines, a line series and a dot series,
// estimates dashed and hollow, a labelled dashed reference line (the target), a label at the
// line's end, drawn at the card's real width. The desktop's hover tooltip is a tap here: each
// column is a target that shows its figures, and carries them as its accessible name, the way
// the desktop's table for screen readers does ("Smt 7 (Perkiraan) · IPK 3,29 · IP semester 3,50").
import { useState } from "react";
import { Pressable, View } from "react-native";
import Svg, { Circle, G, Line, Path, Text as SvgText } from "react-native-svg";
import { factsLabel } from "../../ui/layout";
import { Text } from "../../ui/text";
import { radius, space, useTheme } from "../../ui/theme";

export interface ChartSeries {
  name: string;
  /** "line": joined points (the IPK). "dots": points alone (each semester's IP). */
  kind: "line" | "dots";
  /** One value per column; null leaves a gap. */
  values: (number | null)[];
  /** The theme's color for it. */
  color: string;
}

export interface LineChartProps {
  /** What the chart shows, for a screen reader. */
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
  /** The word for an estimate ("Perkiraan"). */
  estimateWord?: string;
  format: (value: number) => string;
  height?: number;
}

const PAD = { top: 12, right: 8, bottom: 26, left: 34 };
const FONT = 11;
/** About how wide a character of 11-pt text is, to leave room for the labels at the end. */
const CHAR = 6.4;

/** The last index whose value isn't null (Hermes has no findLastIndex everywhere). */
function lastValue(values: readonly (number | null)[]): number {
  for (let i = values.length - 1; i >= 0; i--) if (values[i] !== null && values[i] !== undefined) return i;
  return -1;
}

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
  height = 176,
}: LineChartProps) {
  const theme = useTheme();
  const c = theme.color;
  const [width, setWidth] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);

  const n = columns.length;
  const textWidth = (text: string) => text.length * CHAR + 12;
  // On a phone the end labels take at most a third of the width; the target's label shortens to its figure when it must.
  const endRoom = Math.min(width / 3, Math.max(endLabel ? textWidth(endLabel) : 0, reference ? textWidth(reference.label) : 0));
  const plotW = Math.max(0, width - PAD.left - PAD.right - endRoom);
  const plotH = height - PAD.top - PAD.bottom;
  const step = n > 1 ? plotW / (n - 1) : 0;
  const x = (i: number) => PAD.left + (n > 1 ? i * step : plotW / 2);
  const y = (v: number) => PAD.top + ((max - Math.min(max, Math.max(min, v))) / (max - min)) * plotH;
  const estimate = (i: number) => estimateFrom !== undefined && i >= estimateFrom;
  const line = series.find((s) => s.kind === "line");
  const lastIndex = line ? lastValue(line.values) : -1;
  const widest = Math.max(...columns.map((col) => col.length)) * CHAR + 6;
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
  const column = (i: number) => `${columns[i]}${estimate(i) && estimateWord ? ` (${estimateWord})` : ""}`;
  /** A column's figures, as the desktop's table row says them. */
  const facts = (i: number) =>
    factsLabel(column(i), ...series.map((s) => (s.values[i] === null || s.values[i] === undefined ? null : `${s.name} ${format(s.values[i]!)}`)));
  const hit = Math.max(step, 28);

  return (
    <View accessibilityLabel={label} onLayout={(event) => setWidth(Math.round(event.nativeEvent.layout.width))} style={{ width: "100%" }}>
      <View style={{ height }}>
        {width > 0 && (
          <Svg width={width} height={height} accessible={false} importantForAccessibility="no-hide-descendants">
            {gridlines.map((g) => (
              <G key={g}>
                <Line x1={PAD.left} x2={PAD.left + plotW} y1={y(g)} y2={y(g)} stroke={c.line} strokeWidth={1} />
                <SvgText x={PAD.left - 6} y={y(g) + 3.5} textAnchor="end" fontSize={FONT} fill={c.faint}>
                  {format(g)}
                </SvgText>
              </G>
            ))}
            {columns.map((col, i) => (
              <SvgText
                // biome-ignore lint/suspicious/noArrayIndexKey: a column is its place on the axis; labels can repeat
                key={col + i}
                x={x(i)}
                y={height - 8}
                textAnchor="middle"
                fontSize={FONT}
                fill={estimate(i) ? c.muted : c.faint}
                fontWeight={picked === i ? "600" : "400"}
              >
                {ticks[i]}
              </SvgText>
            ))}
            {picked !== null && <Line x1={x(picked)} x2={x(picked)} y1={PAD.top} y2={PAD.top + plotH} stroke={c.edge} strokeWidth={1} />}
            {reference && (
              <G>
                <Line x1={PAD.left} x2={PAD.left + plotW} y1={refY} y2={refY} stroke={c.muted} strokeWidth={1.25} strokeDasharray="5 4" />
                <SvgText x={PAD.left + plotW + 8} y={refLabelY + 3.5} fontSize={FONT} fontWeight="600" fill={c.muted}>
                  {reference.label}
                </SvgText>
              </G>
            )}
            {series.map((s) =>
              s.kind === "line" ? (
                <G key={s.name} fill="none" stroke={s.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <Path d={path(s.values, 0, Math.min(n - 1, split - 1))} />
                  {split < n && <Path d={path(s.values, Math.max(0, split - 1), n - 1)} strokeDasharray="5 4" />}
                </G>
              ) : null,
            )}
            {series.map((s) => (
              <G key={`${s.name}-dots`}>
                {s.values.map((v, i) =>
                  v === null ? null : (
                    <Circle
                      // biome-ignore lint/suspicious/noArrayIndexKey: a point is its column's place on the axis
                      key={i}
                      cx={x(i)}
                      cy={y(v)}
                      r={s.kind === "line" ? (i === lastIndex || picked === i ? 4 : 3) : picked === i ? 4.5 : 4}
                      fill={estimate(i) ? c.surface : s.color}
                      stroke={estimate(i) ? s.color : c.surface}
                      strokeWidth={estimate(i) ? 1.75 : 2}
                    />
                  ),
                )}
              </G>
            ))}
            {line && endLabel && lastIndex >= 0 && (
              <SvgText x={x(lastIndex) + 8} y={y(line.values[lastIndex]!) + 4} fontSize={12} fontWeight="600" fill={c.fg}>
                {endLabel}
              </SvgText>
            )}
          </Svg>
        )}
        {/* A column each, wider than its marks: tap for its figures; a screen reader reads them as the desktop's table. */}
        {width > 0 &&
          columns.map((col, i) => (
            <Pressable
              // biome-ignore lint/suspicious/noArrayIndexKey: a column is its place on the axis; labels can repeat
              key={`hit-${col}-${i}`}
              accessibilityRole="button"
              accessibilityLabel={facts(i)}
              accessibilityState={{ selected: picked === i }}
              onPress={() => setPicked(picked === i ? null : i)}
              style={{ position: "absolute", left: x(i) - hit / 2, top: PAD.top - 6, width: hit, height: plotH + 12 }}
            />
          ))}
        {picked !== null && width > 0 && (
          <View
            pointerEvents="none"
            style={{
              position: "absolute",
              top: 0,
              left: Math.min(Math.max(x(picked) - 70, 0), width - 140),
              width: 140,
              borderRadius: radius.lg,
              backgroundColor: c.raised,
              borderColor: c.edge,
              borderWidth: 1,
              paddingHorizontal: space[2.5],
              paddingVertical: space[2],
              elevation: 4,
            }}
          >
            <Text size="caption" weight="semibold">
              {columns[picked]}
              {estimate(picked) && estimateWord ? (
                <Text size="caption" tone="muted">
                  {`  ${estimateWord}`}
                </Text>
              ) : null}
            </Text>
            {series.map((s) =>
              s.values[picked] === null || s.values[picked] === undefined ? null : (
                <View key={s.name} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: space[2], marginTop: 2 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Key series={s} />
                    <Text size="caption" tone="muted">
                      {s.name}
                    </Text>
                  </View>
                  <Text size="caption" weight="semibold" tabular>
                    {format(s.values[picked]!)}
                  </Text>
                </View>
              ),
            )}
          </View>
        )}
      </View>
    </View>
  );
}

/** The mark that names a series in a legend or the tap's card: a short line, or a dot. */
export function Key({ series, dashed }: { series: Pick<ChartSeries, "kind" | "color">; dashed?: boolean }) {
  if (series.kind === "dots") return <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: series.color }} />;
  return (
    <Svg width={14} height={8}>
      <Line x1={1} x2={13} y1={4} y2={4} stroke={series.color} strokeWidth={2} strokeLinecap="round" strokeDasharray={dashed ? "3 3" : undefined} />
    </Svg>
  );
}

/** The chart's legend: each series' mark and name, then what a hollow mark means. */
export function ChartLegend({ series, estimate }: { series: Pick<ChartSeries, "kind" | "color" | "name">[]; estimate?: string }) {
  const theme = useTheme();
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space[4], rowGap: space[1], marginTop: space[1] }}>
      {series.map((s) => (
        <View key={s.name} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Key series={s} />
          <Text size="caption" tone="muted">
            {s.name}
          </Text>
        </View>
      ))}
      {estimate && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: theme.color.muted }} />
          <Text size="caption" tone="muted">
            {estimate}
          </Text>
        </View>
      )}
    </View>
  );
}
