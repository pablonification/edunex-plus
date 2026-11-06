// A screen's last word, stuck to the bottom within a thumb's reach, however long the page above
// it scrolls: "Ke Beranda" under the first-run scan, "Selesai" under a report that went.
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useBottomInset } from "../ui/insets";
import { space, useTheme } from "../ui/theme";

export function BottomBar({ children }: { children: ReactNode }) {
  const theme = useTheme();
  // Clear of the phone's navigation bar, which the screen runs under (edge to edge).
  const bottom = useBottomInset();
  return (
    <View
      style={{
        flexDirection: "row",
        gap: space[2],
        backgroundColor: theme.color.surfaceContainer,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.color.line,
        paddingHorizontal: space.page,
        paddingTop: space[3],
        paddingBottom: space[3] + bottom,
      }}
    >
      {children}
    </View>
  );
}
