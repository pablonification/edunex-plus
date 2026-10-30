// A screen's tabs on the phone (src/app/ui/tabs.tsx's TabBar): the names in a row that scrolls
// sideways when they don't fit, the picked one underlined and kept in sight. Each tab is
// `tab.<prefix>.<value>` for the flows.
import { type ComponentRef, useEffect, useRef } from "react";
import { type LayoutRectangle, Pressable, ScrollView, View } from "react-native";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";

export interface TabItem<T extends string> {
  value: T;
  label: string;
}

export function TabBar<T extends string>({
  value,
  tabs,
  onChange,
  label,
  prefix,
}: {
  value: T;
  tabs: readonly TabItem<T>[];
  onChange: (value: T) => void;
  label: string;
  /** testIDs: `tab.<prefix>.<value>`. */
  prefix: string;
}) {
  const theme = useTheme();
  const frame = useRef<ComponentRef<typeof ScrollView>>(null);
  const places = useRef(new Map<string, LayoutRectangle>());
  const width = useRef(0);
  const at = useRef(0);
  // The picked tab stays in sight, as the bar is drawn (Back to a later tab) and on each pick: the bar moves only as
  // far as it must, with the page's margin to spare, so a tab that already fits never cuts off the first one.
  const show = (tab: string) => {
    const place = places.current.get(tab);
    if (!place || !width.current) return;
    const start = place.x - space.page;
    const end = place.x + place.width + space.page - width.current;
    const x = start < at.current ? start : end > at.current ? end : null;
    if (x !== null) frame.current?.scrollTo({ x: Math.max(0, x), animated: true });
  };
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a new pick moves the frame
  useEffect(() => show(value), [value]);
  return (
    <View style={{ borderBottomWidth: 1, borderBottomColor: theme.color.line, backgroundColor: theme.color.canvas }}>
      <ScrollView
        ref={frame}
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="tablist"
        accessibilityLabel={label}
        onLayout={(event) => {
          width.current = event.nativeEvent.layout.width;
        }}
        onScroll={(event) => {
          at.current = event.nativeEvent.contentOffset.x;
        }}
        scrollEventThrottle={32}
        contentContainerStyle={{ paddingHorizontal: space.page, gap: space[5] }}
        testID={`tabs.${prefix}`}
      >
        {tabs.map((tab) => {
          const on = tab.value === value;
          return (
            <Pressable
              key={tab.value}
              testID={`tab.${prefix}.${tab.value}`}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => onChange(tab.value)}
              onLayout={(event) => {
                places.current.set(tab.value, event.nativeEvent.layout);
                if (on) show(tab.value);
              }}
              style={{ height: 46, justifyContent: "center", borderBottomWidth: 2, borderBottomColor: on ? theme.color.fg : "transparent" }}
            >
              <Text size="body" weight={on ? "semibold" : "medium"} tone={on ? "fg" : "muted"} numberOfLines={1}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
