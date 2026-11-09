// Start-up, as the desktop's renderer does it (src/app/main.tsx): the engine's saved data first,
// one snapshot into the desktop's own store (src/app/store.tsx), the first screen drawn from it,
// and only then "app.ready", which starts syncing. Nothing waits on the network. The splash
// screen (held from the JS start, ../start.ts) stays until the first frame is there.
import * as SplashScreen from "expo-splash-screen";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { type Bridge, createBridge } from "../../../src/app/bridge";
import { I18nProvider, type UiClock } from "../../../src/app/i18n";
import { AppStore, StoreProvider, useSettings } from "../../../src/app/store";
import type { Event } from "../../../src/core/contract";
import { scheduleBackgroundSync } from "../host/background";
import { type Host, host } from "../host/host";
import { perfDoing } from "../perf";
import { JS_START } from "../start";
import { ThemeContext, themeFor } from "../ui/theme";
import { demoClock } from "./demo-clock";
import { markFirstFrameShown } from "./first-frame";

interface Booted {
  host: Host;
  store: AppStore;
  bridge: Bridge;
  clock: UiClock | undefined;
}

let booted: Promise<Booted> | null = null;
/** When each step of the start was reached, from the JS start, for the "[startup] steps" line. */
const steps = { asked: 0, host: 0, store: 0 };
const since = () => Date.now() - JS_START;
/** The load, once it's done: a Boot that first draws after that draws the app at once. */
let done: Booted | null = null;

/** The host of this run, for the few screens that hand it a page (sign-in, SIX's timetable). */
export let currentHost: Host | null = null;

/**
 * Starts loading the saved data, once: from ../../index.ts the moment Android opens the app's window, before Expo
 * Router has drawn anything (the disk's reads then overlap its start, instead of waiting for Boot's first frame), or
 * when Boot first draws.
 */
export function startBoot(): Promise<Booted> {
  if (!booted) {
    steps.asked = since();
    booted = boot().then((ready) => {
      currentHost = ready.host;
      done = ready;
      return ready;
    });
    // Boot hears of a failure when it draws; until then it isn't an unhandled one.
    booted.catch(() => undefined);
  }
  return booted;
}

async function boot(): Promise<Booted> {
  const current = await host();
  steps.host = since();
  const bridge = createBridge(current.api);
  let store: AppStore | null = null;
  const early: Event[] = [];
  bridge.onEvent((event) => (store ? store.apply(event) : early.push(event)));
  const snapshot = await bridge.invoke("app.snapshot", {});
  store = new AppStore(snapshot);
  for (const event of early) store.apply(event);
  steps.store = since();
  // A build with the demo's world runs on its clock; a real one on the phone's (no offset, the app's own clock).
  return { host: current, store, bridge, clock: current.clockOffset() ? demoClock(current.clockOffset) : undefined };
}

export function Boot({ children }: { children: ReactNode }) {
  const [app, setApp] = useState<Booted | null>(done);
  const [failed, setFailed] = useState<unknown>(null);
  useEffect(() => {
    if (app) return;
    startBoot().then(setApp, (error: unknown) => {
      console.error("[boot] the engine didn't start:", error);
      setFailed(error);
      void SplashScreen.hideAsync();
    });
  }, [app]);
  if (failed) throw failed;
  if (!app) return null;
  return (
    <StoreProvider store={app.store} bridge={app.bridge}>
      <Appearance clock={app.clock}>{children}</Appearance>
      <Ready bridge={app.bridge} />
    </StoreProvider>
  );
}

/** Language and theme from the Student's settings, the phone's dark mode when they said "system". */
function Appearance({ clock, children }: { clock: UiClock | undefined; children: ReactNode }) {
  const settings = useSettings();
  const system = useColorScheme();
  const theme = useMemo(() => themeFor(settings.theme, system), [settings.theme, system]);
  return (
    <I18nProvider lang={settings.lang} clock={clock}>
      <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
    </I18nProvider>
  );
}

/** After the first frame: the splash goes and syncing starts. */
function Ready({ bridge }: { bridge: Bridge }) {
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      // The moment the Student sees the app (the splash goes): what a cold start is timed to, from the system log.
      console.info("[startup] shown");
      // Where the start's time went, from the JS start: the load asked for, the engine loaded, the store made, drawn.
      console.info(`[startup] steps load asked +${steps.asked}, host +${steps.host}, store +${steps.store}, shown +${since()}`);
      void SplashScreen.hideAsync();
      // What waited for the first frame (the tabs' badges, Beranda's lower parts) draws from the next task on.
      markFirstFrameShown();
      // The engine's start: a stall right after is its first steps (the feeds, the reminders), not a screen's.
      perfDoing("app.ready");
      void bridge.invoke("app.ready", {}).catch(() => undefined);
      void scheduleBackgroundSync().catch(() => undefined);
    });
    return () => cancelAnimationFrame(frame);
  }, [bridge]);
  return null;
}
