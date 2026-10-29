// The toasts the desktop's hooks raise (../swaps/overlays.ts), at the bottom of the screen above
// the tabs: what happened, with Undo where there is one.
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { dismissToast, useToasts } from "../swaps/overlays";
import { Text } from "./text";
import { radius, space, useTheme } from "./theme";

export function Toasts() {
  const toasts = useToasts();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  if (!toasts.length) return null;
  return (
    <View pointerEvents="box-none" style={{ position: "absolute", left: space[3], right: space[3], bottom: insets.bottom + 72, gap: space[2] }}>
      {toasts.map((item) => (
        <View
          key={item.id}
          accessibilityLiveRegion="polite"
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: space[3],
            borderRadius: radius.lg,
            paddingHorizontal: space[4],
            paddingVertical: space[3],
            backgroundColor: item.tone === "danger" ? theme.color.dangerFg : theme.scheme === "dark" ? "#ececef" : "#1d1d1f",
            elevation: 6,
          }}
        >
          <Text
            size="small"
            weight="medium"
            style={{ flex: 1, color: item.tone === "danger" ? theme.color.canvas : theme.scheme === "dark" ? "#1d1d1f" : "#ffffff" }}
          >
            {item.text}
          </Text>
          {item.action && (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                item.action?.onClick();
                dismissToast(item.id);
              }}
              hitSlop={10}
            >
              <Text size="small" weight="semibold" style={{ color: theme.scheme === "dark" ? "#2862d6" : "#7aa2ff" }}>
                {item.action.label}
              </Text>
            </Pressable>
          )}
        </View>
      ))}
    </View>
  );
}
