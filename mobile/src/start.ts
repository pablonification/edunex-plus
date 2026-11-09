// The app's very first module (../index.ts imports it before anything else): when JS started, the time the "[perf]
// first-data" and "[sync]" lines count from, and Android's splash held until Beranda's first frame (shell/boot.tsx
// hides it). With Metro's inline requires (metro.config.js) a module runs when it's first used, not when the bundle
// starts, so both have to be here to happen first.
import * as SplashScreen from "expo-splash-screen";

export const JS_START = Date.now();

void SplashScreen.preventAutoHideAsync().catch(() => undefined);
