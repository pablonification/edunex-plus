// The desktop's meters (src/app/ui/meter.tsx) on the phone, in status colors only: the absences a
// course's target allows ("Jatah absen"), as the Student spends them, and how much time a window has
// left, amber in its last 15 minutes.
import { View, type ViewStyle } from "react-native";
import { Text } from "../ui/text";
import { useTheme } from "../ui/theme";

export type BarTone = "neutral" | "warning" | "danger";

/** From this many segments the gaps go: one fill, split where the used part ends. */
const CONTINUOUS = 12;
const WIDTH = { sm: 104, md: 200 } as const;
const GAP = 2;

/**
 * One segment per absence the target allows, filled as they're used, ringed while still left. Full,
 * it turns amber; misses past the limit sit after a short limit line, red. `estimate`: before SIX has
 * a count, hatched (here: dashed rings). Always beside its words, never alone.
 */
export function AbsenceBar({
  allowed,
  used,
  over = 0,
  tone,
  estimate = false,
  size = "sm",
  label,
  style,
}: {
  allowed: number;
  used: number;
  over?: number;
  tone: BarTone;
  estimate?: boolean;
  size?: "sm" | "md";
  label: string;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const c = theme.color;
  if (allowed <= 0 && over <= 0) return null;
  const filled = estimate ? 0 : Math.min(used, allowed);
  const fill = tone === "neutral" ? c.muted : c.meterWarning;
  const height = size === "sm" ? 8 : 11;
  const own = allowed > 0 ? (WIDTH[size] - GAP * (allowed - 1)) / allowed : WIDTH[size] / 4;
  const segment = over > 0 ? Math.max(6, Math.min(own, (WIDTH[size] / 2 - GAP * (over - 1)) / over)) : own;
  const left: ViewStyle = { borderWidth: 1.5, borderColor: c.pipRing, ...(estimate ? { borderStyle: "dashed" } : {}) };
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={label} style={[{ flexDirection: "row", alignItems: "center", gap: GAP }, style]}>
      {allowed > 0 &&
        (allowed < CONTINUOUS ? (
          <View style={{ flexDirection: "row", gap: GAP, width: WIDTH[size] }}>
            {Array.from({ length: allowed }, (_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: segments are positions, nothing else tells them apart
              <View key={i} style={[{ flex: 1, height, borderRadius: 2 }, i < filled ? { backgroundColor: fill } : left]} />
            ))}
          </View>
        ) : (
          <View style={[{ width: WIDTH[size], height, borderRadius: 2, overflow: "hidden", flexDirection: "row" }, left]}>
            {filled > 0 && <View style={{ width: `${(filled / allowed) * 100}%`, height: "100%", backgroundColor: fill }} />}
          </View>
        ))}
      {over > 0 && (
        <>
          <View style={{ marginHorizontal: 2, width: 2, height: height + 6, borderRadius: 1, backgroundColor: c.fg }} />
          {Array.from({ length: over }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: segments are positions, nothing else tells them apart
            <View key={i} style={{ width: segment, height, borderRadius: 2, backgroundColor: c.dangerFg }} />
          ))}
        </>
      )}
    </View>
  );
}

/** Time left in a window, shrinking as it runs out; amber in the last 15 minutes. */
export function CountdownBar({
  opensAt,
  closesAt,
  now,
  label,
  showLabel = true,
  style,
}: {
  opensAt: number;
  closesAt: number;
  now: number;
  label: string;
  showLabel?: boolean;
  style?: ViewStyle;
}) {
  const theme = useTheme();
  const left = Math.max(0, Math.min(1, (closesAt - now) / Math.max(1, closesAt - opensAt)));
  const soon = closesAt - now < 15 * 60_000;
  return (
    <View style={[{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 12, rowGap: 4 }, style]}>
      <View
        accessibilityRole="progressbar"
        accessibilityLabel={label}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(left * 100) }}
        style={{ flex: 1, minWidth: 64, height: 6, borderRadius: 3, overflow: "hidden", backgroundColor: theme.color.meterTrack }}
      >
        <View style={{ width: `${left * 100}%`, height: "100%", borderRadius: 3, backgroundColor: soon ? theme.color.meterWarning : theme.color.accent }} />
      </View>
      {showLabel && (
        <Text size="small" weight="semibold" tabular tone={soon ? "warning" : "muted"}>
          {label}
        </Text>
      )}
    </View>
  );
}
