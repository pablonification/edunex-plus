// What's happening now or next, the same on Beranda and a course page (src/app/ui/now-card.tsx): a
// time block on the left, what it is with its facts, the one thing to do, and zones under it split
// by hairlines (the Presence window, what comes after). Raised while it matters now. On a phone the
// action goes under the words, full width, within a thumb's reach.
import type { ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { Card } from "../ui/display";
import { Text, useTextWidth } from "../ui/text";
import { space, useTheme } from "../ui/theme";

export function NowCard({
  raised,
  time,
  eyebrow,
  title,
  meta,
  note,
  action,
  children,
  testID,
}: {
  raised: boolean;
  time?: { start: string; end: string } | null;
  eyebrow: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  note?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
  testID?: string;
}) {
  const theme = useTheme();
  const timeColumn = useTextWidth(60);
  return (
    <Card variant={raised ? "raised" : "plain"} testID={testID}>
      <View style={{ paddingHorizontal: space[4], paddingVertical: space[4], gap: space[3] }}>
        <View style={{ flexDirection: "row", gap: space[4] }}>
          {time && (
            <View
              style={{
                minWidth: timeColumn,
                alignItems: "flex-end",
                borderRightWidth: StyleSheet.hairlineWidth,
                borderRightColor: theme.color.line,
                paddingRight: space[3],
              }}
            >
              <Text size="title" weight="semibold" tabular>
                {time.start}
              </Text>
              <Text size="small" tone="muted" tabular>
                {time.end}
              </Text>
            </View>
          )}
          <View style={{ flex: 1, minWidth: 0 }}>
            {eyebrow}
            <View style={{ marginTop: 2 }}>{title}</View>
            {meta && <View style={{ marginTop: space[1] }}>{meta}</View>}
            {note}
          </View>
        </View>
        {action && <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2] }}>{action}</View>}
      </View>
      {children}
    </Card>
  );
}

/** A zone under a NowCard's head: a hairline above, a quiet background. */
export function NowZone({ style, children }: { style?: ViewStyle; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View
      style={[
        {
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: theme.color.line,
          backgroundColor: theme.color.sunken,
          paddingHorizontal: space[4],
          paddingVertical: space[3],
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** One quiet line, under the card or instead of it: an icon, the facts, at most one small action. */
export function NowLine({ icon, action, children }: { icon: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: space[3], rowGap: space[1], minHeight: 32 }}>
      <View>{icon}</View>
      <View style={{ flex: 1, minWidth: 200 }}>{children}</View>
      {action}
    </View>
  );
}
