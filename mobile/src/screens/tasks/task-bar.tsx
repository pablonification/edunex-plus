// A Task's top bar (round 3, the real phone): the Task's name is the screen's one title, in the bar from the start (no
// big title on the page under an empty bar), on up to two lines in a medium size, a tap showing the rest of a longer
// one. Under it, small, the way up: the course by a short name and the module's number, opening the module. The bar's
// surface, Back and their behaviour are TopBar's (../../ui/top-bar.tsx); only the title block is the Task's own.
// TopBar could take this as `subtitle` + `lines`: say so to the lead rather than change the shared part here.
import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icons } from "../../ui/icons";
import { Tap } from "../../ui/moves";
import { slopY } from "../../ui/sizes";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { BAR_HEIGHT, BarBack, BarSurface } from "../../ui/top-bar";

export function TaskBar({
  title,
  crumb,
  crumbLabel,
  onCrumb,
}: {
  title: string;
  /** "Proposal Tugas Akhir · Modul 5": the course, short, and the module's number. */
  crumb: string;
  /** The same, said in full (the course's code and name, the module's name). */
  crumbLabel: string;
  onCrumb: () => void;
}) {
  const theme = useTheme();
  const v = theme.v4;
  const insets = useSafeAreaInsets();
  // A name past two lines ends in "…"; a tap shows it whole (TalkBack hears it whole anyway).
  const [whole, setWhole] = useState(false);
  return (
    <BarSurface v4>
      <View style={[styles.bar, { marginTop: insets.top }]}>
        {/* The app's one Back (a glass circle on iOS 26), as every other pushed screen's. */}
        <BarBack />
        <View style={{ flex: 1, minWidth: 0, marginLeft: space[1], paddingRight: space[3], paddingVertical: space[2] }}>
          {/* 48 dp to tap with its slop (the course's link under it keeps its own). */}
          <Tap feel="row" onPress={() => setWhole((was) => !was)} accessible={false} hitSlop={slopY(12)}>
            <Text
              face="display"
              weight="bold"
              numberOfLines={whole ? undefined : 2}
              accessibilityRole="header"
              style={{ fontSize: 18, lineHeight: 24, letterSpacing: -0.2, color: v.fg }}
              testID="task.title"
            >
              {title}
            </Text>
          </Tap>
          <Tap
            feel="row"
            borderless
            accessibilityRole="link"
            accessibilityLabel={crumbLabel}
            onPress={onCrumb}
            hitSlop={slopY(16)}
            style={styles.crumb}
            testID="action.course"
          >
            <Text size="bodySmall" numberOfLines={1} tabular style={{ flexShrink: 1, color: v.fg2 }}>
              {crumb}
            </Text>
            <Icons.ChevronRight size={14} color={v.muted} />
          </Tap>
        </View>
      </View>
    </BarSurface>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", paddingHorizontal: space[1], minHeight: BAR_HEIGHT },
  crumb: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", maxWidth: "100%", gap: 2, marginTop: 2 },
});
