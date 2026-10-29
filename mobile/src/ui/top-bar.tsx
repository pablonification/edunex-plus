// The bar over a screen a tab opened (a Task, a course, Settings): Back on the left, saying where
// it goes, as the desktop's back button does; the screen's own actions on the right. The tabs'
// own pages use `TabBar`: the app's name, search and the bell, within reach of a thumb's stretch.
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useT } from "../../../src/app/i18n";
import { useNav } from "../nav";
import { IconButton } from "./controls";
import { Icons } from "./icons";
import { Text } from "./text";
import { space, useTheme } from "./theme";

export function TopBar({ title, actions, onBack }: { title?: string; actions?: ReactNode; onBack?: () => void }) {
  const t = useT();
  const nav = useNav();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top, backgroundColor: theme.color.canvas, borderBottomColor: theme.color.line }]}>
      <IconButton label={t("action.back")} onPress={onBack ?? nav.back} testID="action.back">
        <Icons.ChevronLeft size={22} />
      </IconButton>
      <Text size="body" weight="semibold" numberOfLines={1} style={{ flex: 1 }}>
        {title ?? ""}
      </Text>
      {actions && <View style={{ flexDirection: "row", alignItems: "center" }}>{actions}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", alignItems: "center", gap: space[1], paddingHorizontal: space[1], minHeight: 56, borderBottomWidth: StyleSheet.hairlineWidth },
});
