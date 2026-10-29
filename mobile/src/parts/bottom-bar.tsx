// A screen's last word, stuck to the bottom within a thumb's reach, however long the page above
// it scrolls: "Ke Beranda" under the first-run scan, "Selesai" under a report that went.
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { space, useTheme } from "../ui/theme";

export function BottomBar({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        flexDirection: "row",
        gap: space[2],
        backgroundColor: theme.color.canvas,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: theme.color.line,
        paddingHorizontal: space.page,
        paddingTop: space[3],
        paddingBottom: insets.bottom + space[3],
      }}
    >
      {children}
    </View>
  );
}
