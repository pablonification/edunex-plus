// A thin bar under a v4 figure (round 2): how far along, in one colour on the page's grey, with an optional second
// stretch after it in a lighter tone ("passed", then "this semester"). Plain on purpose: the figure above says the
// number, the bar only its share. A screen reader hears `label`.
import { View } from "react-native";
import { useTheme } from "./theme";

const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

export function Meter({
  value,
  then = 0,
  color,
  thenColor,
  label,
  height = 6,
  track,
}: {
  /** The share filled, 0–1. */
  value: number;
  /** A second share right after it, 0–1 (drawn up to what's left). */
  then?: number;
  color?: string;
  thenColor?: string;
  label: string;
  height?: number;
  /** The empty part's colour, when it must read on its own (v4's `track`, 3:1 on a card); else the page's grey. */
  track?: string;
}) {
  const v = useTheme().v4;
  const first = clamp(value);
  const second = Math.min(clamp(then), 1 - first);
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(first * 100) }}
      style={{ height, borderRadius: height / 2, backgroundColor: track ?? v.page, flexDirection: "row", overflow: "hidden" }}
    >
      <View style={{ width: `${first * 100}%`, backgroundColor: color ?? v.brand }} />
      {/* On a strong track, M3's gap (the card's colour) where the fill ends, so the two never run together. */}
      {track && first > 0 && first < 1 && second === 0 && <View style={{ width: 3, backgroundColor: v.card }} />}
      {second > 0 && <View style={{ width: `${second * 100}%`, backgroundColor: thenColor ?? v.brandTint }} />}
    </View>
  );
}
