// The app's frame: the engine and the desktop's store (../src/shell/boot), the theme, and a stack
// over the bottom tabs for everything a tab opens (a Task, a course, Settings). The crypto polyfill and
// the background sync come first, from ../index.ts.
import { NavigationBar } from "expo-navigation-bar";
import { Stack, useNavigationContainerRef } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { useDataset, useStatus } from "../../src/app/store";
import { useWidgetUpdates } from "../src/host/widget";
import { CourseColorPickerHost } from "../src/parts/course-color-picker";
import { perfNavigating, perfShown, watchJsThread } from "../src/perf";
import { FirstScanWatch } from "../src/screens/first-scan/watch";
import { ReportAskCard } from "../src/screens/report/ask";
import { Boot } from "../src/shell/boot";
import { NotificationTaps } from "../src/shell/notification-taps";
import { SignInHost } from "../src/shell/sign-in";
import { Welcome } from "../src/shell/welcome";
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

/** Saved data keeps the app up even while a session is being checked or has ended (the desktop's nobodyIn). */
function useNobodyIn(): boolean {
  const edunex = useStatus("edunex");
  const six = useStatus("six");
  const account = useDataset("edunex.account");
  const student = useDataset("six.student");
  return edunex.state === "signed-out" && !account && six.state === "signed-out" && !student;
}

/** The `[perf]` lines (../src/perf.ts): the JS thread watched, each navigation timed to its screen drawn. */
function usePerfWatch(): void {
  const navigation = useNavigationContainerRef() as unknown as {
    addListener(event: "__unsafe_action__" | "state", listener: () => void): () => void;
    getCurrentRoute(): { name: string } | undefined;
  };
  useEffect(() => {
    watchJsThread();
    const dispatched = navigation.addListener("__unsafe_action__", () => perfNavigating());
    const shown = navigation.addListener("state", () => perfShown(navigation.getCurrentRoute()?.name ?? "?"));
    return () => {
      dispatched();
      shown();
    };
  }, [navigation]);
}

function Frame() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const nobody = useNobodyIn();
  useWidgetUpdates();
  usePerfWatch();
  // On first run the welcome stays until the Student moves on, so SIX can be connected right after Edunex.
  const [welcoming, setWelcoming] = useState(nobody);
  if (nobody && !welcoming) setWelcoming(true);
  return (
    <>
      <StatusBar style={welcoming || theme.scheme === "dark" ? "light" : "dark"} />
      {/* Three-button navigation's buttons: light on the welcome's dark stage and the dark theme, else dark. */}
      <NavigationBar style={welcoming || theme.scheme === "dark" ? "dark" : "light"} />
      {/* A screen over the tabs ends above the phone's navigation bar: nothing to tap sits under its buttons (the tabs
          end at their own bar). */}
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: theme.color.canvas, paddingBottom: insets.bottom },
          animation: "slide_from_right",
        }}
      >
        <Stack.Screen name="(tabs)" options={{ contentStyle: { backgroundColor: theme.color.canvas } }} />
      </Stack>
      {welcoming && <Welcome onDone={() => setWelcoming(false)} />}
      {!welcoming && <FirstScanWatch />}
      <ReportAskCard />
      <Toasts />
      <CourseColorPickerHost />
      <SignInHost />
      <NotificationTaps />
    </>
  );
}
