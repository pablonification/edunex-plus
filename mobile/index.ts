// The app's start: Expo Router's, the background sync (src/host/background.ts) and the home-screen
// widget's drawing (src/widget/draw.ts), which Android runs on its own while the app is closed (a
// sync due, a widget added, resized or due for its update). Both are registered here, at the very
// start, so they're there when Android woke the app without a screen, and the crypto the engine
// needs comes before them. When it opens with a window, the saved data starts loading at once.
import "./src/start";
import "./src/host/polyfills";
import "./src/host/background";
import "expo-router/entry";
import type { ReactNode } from "react";
import { AppRegistry } from "react-native";
import { registerWidgetTaskHandler } from "react-native-android-widget";
import { startBoot } from "./src/shell/boot";
import { widgetTask } from "./src/widget/draw";

registerWidgetTaskHandler(widgetTask);

// Android opens the app's window (React Native's runApplication; never a background sync's or a widget's start, which
// have none): Beranda's saved data starts loading now, its disk reads overlapping Expo Router's own start, rather than
// once Expo Router has drawn its first frame (src/shell/boot.tsx). The wrapper itself adds nothing around the app.
AppRegistry.setWrapperComponentProvider(() => {
  void startBoot();
  return Unwrapped;
});

function Unwrapped({ children }: { children?: ReactNode }) {
  return children;
}
