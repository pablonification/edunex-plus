// A list on a course's page: its rows flat on the white page, a hairline between them (each row draws its own), the
// same in light and dark. Never a card around a list. The rows keep their own side padding (`inset` dp: the shared
// rows' `ROW_SIDE`), so the list steps out by that much and their words line up with the page's edge.
import type { ReactNode } from "react";
import { type StyleProp, View, type ViewStyle } from "react-native";
import { ROW_SIDE } from "../../ui/row-end";

export function FlatRows({
  children,
  inset = ROW_SIDE,
  style,
  testID,
}: {
  children: ReactNode;
  inset?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <View testID={testID} style={[{ marginHorizontal: -inset }, style]}>
      {children}
    </View>
  );
}
