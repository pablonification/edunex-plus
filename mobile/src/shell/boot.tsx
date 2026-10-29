// Start-up, as the desktop's renderer does it (src/app/main.tsx): the engine's saved data first,
// one snapshot into the desktop's own store (src/app/store.tsx), the first screen drawn from it,
// and only then "app.ready", which starts syncing. Nothing waits on the network. The splash
// screen stays until the first frame is there.
import * as SplashScreen from "expo-splash-screen";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import { type Bridge, createBridge } from "../../../src/app/bridge";
import { I18nProvider, systemClock, type UiClock } from "../../../src/app/i18n";
import { AppStore, StoreProvider, useSettings } from "../../../src/app/store";
import type { Event } from "../../../src/core/contract";
import { type Host, host } from "../host/host";
import { ThemeContext, themeFor } from "../ui/theme";

void SplashScreen.preventAutoHideAsync().catch(() => undefined);

interface Booted {
  host: Host;
  store: AppStore;
  bridge: Bridge;
  clock: UiClock | undefined;
}

let booted: Promise<Booted> | null = null;

async function boot(): Promise<Booted> {
  const current = await host();
  const bridge = createBridge(current.api);
  let store: AppStore | null = null;
  const early: Event[] = [];
  bridge.onEvent((event) => (store ? store.apply(event) : early.push(event)));
  const snapshot = await bridge.invoke("app.snapshot", {});
  store = new AppStore(snapshot);
  for (const event of early) store.apply(event);
  const offset = current.clockOffset();
  return { host: current, store, bridge, clock: offset ? systemClock(offset) : undefined };
}

/** The host of this run, for the few screens that hand it a page (sign-in, SIX's timetable). */
export let currentHost: Host | null = null;

export function Boot({ children }: { children: ReactNode }) {
  const [app, setApp] = useState<Booted | null>(null);
  const [failed, setFailed] = useState<unknown>(null);
  useEffect(() => {
    booted ??= boot();
    booted.then(
      (ready) => {
        currentHost = ready.host;
        setApp(ready);
      },
      (error: unknown) => {
        console.error("[boot] the engine didn't start:", error);
        setFailed(error);
        void SplashScreen.hideAsync();
      },
    );
  }, []);
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
      void SplashScreen.hideAsync();
      void bridge.invoke("app.ready", {}).catch(() => undefined);
    });
    return () => cancelAnimationFrame(frame);
  }, [bridge]);
  return null;
}
