// What a fold shows when it opens (a Task's change under its step, a report's technical details): it arrives, on the
// app's one arrival (ui/moves.tsx, `moves.arrive`: a medium fade, rising 8 dp on the default spatial spring), and
// folds away at once. Not `Appear`: its leaving fades in place while what's below moves up under it, which reads as
// two things in one spot when the part sits in the middle of a list. Opened only by the Student's tap, so always on
// the screen in front. With Remove animations it's simply there.
import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";
import Animated from "react-native-reanimated";
import { useReduceMotion } from "../ui/motion";
import { moves } from "../ui/moves";

/** Mount it with what the fold shows: `{open && <Unfold>…</Unfold>}`. Never inside a FlashList cell. */
export function Unfold({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const still = useReduceMotion();
  return (
    <Animated.View entering={still ? undefined : moves.arrive} style={style}>
      {children}
    </Animated.View>
  );
}
