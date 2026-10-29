// The app's start: Expo Router's, the background sync (src/host/background.ts) and the home-screen
// widget's drawing (src/widget/draw.ts), which Android runs on its own while the app is closed (a
// sync due, a widget added, resized or due for its update). Both are registered here, at the very
// start, so they're there when Android woke the app without a screen, and the crypto the engine
// needs comes before them.
import "./src/host/polyfills";
import "./src/host/background";
import "expo-router/entry";
import { registerWidgetTaskHandler } from "react-native-android-widget";
import { widgetTask } from "./src/widget/draw";

registerWidgetTaskHandler(widgetTask);
