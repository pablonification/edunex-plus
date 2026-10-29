// The app's start: Expo Router's, and the home-screen widget's drawing (src/widget/draw.ts), which
// Android runs on its own while the app is closed (a widget added, resized or due for its update).
// Registered here, at the very start, so it's there when the widget alone woke the app.
import "expo-router/entry";
import { registerWidgetTaskHandler } from "react-native-android-widget";
import { widgetTask } from "./src/widget/draw";

registerWidgetTaskHandler(widgetTask);
