// A group's heading on Materi and Ujian: plain when the group is always shown, one target when it folds ("Sebelumnya",
// "Sudah lewat"): its name, how many it holds, and a chevron that turns as it opens (still with Remove animations).
import { View } from "react-native";
import Animated, { useAnimatedStyle, useDerivedValue, withTiming } from "react-native-reanimated";
import { BHeading, useB } from "../../ui/b";
import { Icons } from "../../ui/icons";
import { factsLabel } from "../../ui/layout";
import { useReduceMotion } from "../../ui/motion";
import { Tap } from "../../ui/moves";
import { Text } from "../../ui/text";
import { motion, space } from "../../ui/theme";

export function FoldHeading({
  title,
  count,
  countLabel,
  first,
  fold,
  onFold,
  testID,
}: {
  title: string;
  count: number;
  /** The count as TalkBack says it ("12 materi"). */
  countLabel: string;
  /** The page's first line: less room over it. */
  first: boolean;
  /** null: the group doesn't fold. */
  fold: "open" | "closed" | null;
  onFold: () => void;
  testID: string;
}) {
  const b = useB();
  const top = first ? space[2] : space[6];
  if (!fold) return <BHeading style={{ marginTop: top, marginBottom: 0 }}>{title}</BHeading>;
  return (
    <Tap
      feel="row"
      onPress={onFold}
      testID={testID}
      accessibilityLabel={factsLabel(title, countLabel)}
      accessibilityState={{ expanded: fold === "open" }}
      style={{ marginTop: top, minHeight: 48, justifyContent: "center" }}
    >
      <BHeading
        style={{ marginBottom: 0 }}
        trailing={
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[2] }}>
            <Text size="bodyMedium" tabular style={{ color: b.muted }}>
              {count}
            </Text>
            <Chevron open={fold === "open"} color={b.muted} />
          </View>
        }
      >
        {title}
      </BHeading>
    </Tap>
  );
}

/** Down when folded, up when open, turning on the UI thread. */
function Chevron({ open, color }: { open: boolean; color: string }) {
  const still = useReduceMotion();
  const turn = useDerivedValue(() => withTiming(open ? 1 : 0, { duration: still ? 0 : motion.duration.short }), [open, still]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 180}deg` }] }));
  return (
    <Animated.View style={style}>
      <Icons.ChevronDown size={20} color={color} />
    </Animated.View>
  );
}
