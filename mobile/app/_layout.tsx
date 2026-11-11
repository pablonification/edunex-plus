// The app's frame: the engine and the desktop's store (../src/shell/boot), the theme, and a native
// stack over the bottom tabs for everything a tab opens (a Task, a course, a module, Settings), with
// Android's own screen transition and Back (the predictive gesture too). The crypto polyfill and the
// background sync come first, from ../index.ts.
import { NavigationBar } from "expo-navigation-bar";
import { Stack, useNavigationContainerRef } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { type ReactNode, useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useWidgetUpdates } from "../src/host/widget";
import { CourseColorPickerHost } from "../src/parts/course-color-picker";
import { perfNavigating, perfShown, watchJsThread } from "../src/perf";
import { ReportAskCard } from "../src/screens/report/ask";
import { Boot } from "../src/shell/boot";
import { useFirstFrameShown } from "../src/shell/first-frame";
import { GuideHost } from "../src/shell/guide/host";
import { useNobodyIn } from "../src/shell/nobody";
import { NotificationTaps } from "../src/shell/notification-taps";
import { SignInHost } from "../src/shell/sign-in";
import { Welcome } from "../src/shell/welcome";
import { DeferredScreens } from "../src/ui/deferred";
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
  useWidgetUpdates();
  usePerfWatch();
  return (
    <>
      <StatusBar style={theme.scheme === "dark" ? "light" : "dark"} />
      {/* Three-button navigation's buttons: light on the dark theme, else dark. The style names the buttons, as the
          status bar's does ("dark": dark buttons for a light bar; expo-navigation-bar's native side and its own "auto"
          read it so, whatever its type's comment says). */}
      <NavigationBar style={theme.scheme === "dark" ? "light" : "dark"} />
      {/* Edge to edge: a screen over the tabs runs under the phone's navigation bar, and its page keeps its last row
          clear of it (ui/insets.ts). "default" is Android's own open and close (the system's slide and fade), drawn
          natively. The screens take new data and the minute's tick as transitions (src/ui/deferred.tsx). */}
      <DeferredScreens>
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.color.surface },
            animation: "default",
          }}
        >
          <Stack.Screen name="(tabs)" />
        </Stack>
      </DeferredScreens>
      {/* Until a system is in: then it fades, and Beranda fills in under it (the first read's summary is a card there). */}
      <WelcomeWhileNobody />
      <AfterFirstFrame>
        <ReportAskCard />
        <Toasts />
        <CourseColorPickerHost />
        <SignInHost />
        <GuideHost />
      </AfterFirstFrame>
      <NotificationTaps />
    </>
  );
}

/**
 * What's over the screens only now and then (a report's question, a snackbar, a sheet, a sign-in's page), from a moment
 * after the first frame: nothing of it is there to see at a cold start, and the snackbar's frame measured itself and
 * drew again before the splash could go. What one of them was asked to show meanwhile shows then.
 */
function AfterFirstFrame({ children }: { children: ReactNode }) {
  return useFirstFrameShown() ? children : null;
}

/** The welcome while nobody is signed in: apart, so a source's state changing doesn't draw the whole frame again. */
function WelcomeWhileNobody() {
  return useNobodyIn() ? <Welcome /> : null;
}
