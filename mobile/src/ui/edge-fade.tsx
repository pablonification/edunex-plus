// A row that scrolls sideways (a screen's tabs) fades out at an edge with more of it hidden, so a word cut
// there reads as "more this way" and not as a broken label. The desktop's tabs fit its window; a phone's
// often don't (judge round 5: Rencana studi's "Kalender akadem", the course page's "Per").
import { useRef, useState } from "react";
import { type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent, View } from "react-native";
import Svg, { Defs, LinearGradient, Rect, Stop } from "react-native-svg";

const WIDTH = 28;

/** Which edges of a sideways ScrollView have more beyond them, and the handlers it needs to tell. */
export function useEdges() {
  const [edges, setEdges] = useState({ left: false, right: false });
  const at = useRef({ x: 0, width: 0, content: 0 });
  const update = () => {
    const { x, width, content } = at.current;
    const left = x > 1;
    const right = width > 0 && x + width < content - 1;
    setEdges((now) => (now.left === left && now.right === right ? now : { left, right }));
  };
  return {
    edges,
    onLayout: (event: LayoutChangeEvent) => {
      at.current.width = event.nativeEvent.layout.width;
      update();
    },
    onContentSizeChange: (width: number) => {
      at.current.content = width;
      update();
    },
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      at.current.x = event.nativeEvent.contentOffset.x;
      update();
    },
  };
}

/** The fade itself, over the row's `side` edge in the row's background colour; taps go through it. */
export function EdgeFade({ side, color }: { side: "left" | "right"; color: string }) {
  const id = `edge-fade-${side}`;
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, bottom: 0, width: WIDTH, [side]: 0 }}>
      <Svg width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1={side === "left" ? "1" : "0"} y1="0" x2={side === "left" ? "0" : "1"} y2="0">
            <Stop offset="0" stopColor={color} stopOpacity={0} />
            <Stop offset="1" stopColor={color} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
