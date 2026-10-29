// The app's frame: the engine and the desktop's store (../src/shell/boot), the theme, and a stack
// over the bottom tabs for everything a tab opens (a Task, a course, Settings).
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "../src/host/background";
import { Boot } from "../src/shell/boot";
import { SignInHost } from "../src/shell/sign-in";
import { useTheme } from "../src/ui/theme";
import { Toasts } from "../src/ui/toasts";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Boot>
          <Frame />
        </Boot>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Frame() {
  const theme = useTheme();
  return (
    <>
      <StatusBar style={theme.scheme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.color.canvas }, animation: "slide_from_right" }} />
      <Toasts />
      <SignInHost />
    </>
  );
}
