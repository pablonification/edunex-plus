// Round 4 placeholder (mobile/qa/r4-decisions.md): the real screen replaces this file.
import { View } from "react-native";
import { TopBar } from "../src/ui/top-bar";

export default function Screen() {
  return (
    <View testID="screen.materials" style={{ flex: 1 }}>
      <TopBar />
    </View>
  );
}
