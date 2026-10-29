// The engine on the phone: the desktop's own engine (src/engine), created once in the app's JS
// thread with the phone's network, disk, keychain and notifications plugged in, and the bridge
// the desktop's screens talk through (src/app/bridge.ts), answered right here.
// A demo build (EXPO_PUBLIC_DEMO=1) runs it on the pretend Edunex and SIX instead (../demo).
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { BridgeApi } from "../../../src/app/bridge";
import type { Event } from "../../../src/core/contract";
import type { Lang } from "../../../src/core/models";
import { type SignInWindows, signInToBoth } from "../../../src/desktop/signin-both";
import { AppLog } from "../../../src/engine/app-log";
import { type Clock, systemClock } from "../../../src/engine/clock";
import { createEngine, type Engine } from "../../../src/engine/engine";
import type { Transport } from "../../../src/engine/http/transport";
import type { Storage, Vault } from "../../../src/engine/store/storage";
import { phoneSignInWindows } from "../shell/sign-in";
import { answer, type HostUi, phoneHandlers } from "./handlers";
import { phoneNotifier, prepareChannels } from "./notifier";
import { PhoneStorage } from "./storage";
import { phoneTransport } from "./transport";
import { PhoneVault } from "./vault";
import { APP_VERSION, DEMO } from "./version";

export interface Host {
  engine: Engine;
  /** What src/app/bridge.ts's createBridge wraps, as the desktop's preload would give it. */
  api: BridgeApi;
  /** The screens fill this in: sign-in pages and SIX's timetable. */
  ui: HostUi;
  /** How far the demo's clock is ahead of real time (ms); 0 in the real app. */
  clockOffset(): number;
  /** Whether the engine's feeds are running (the screens started it, or a background sync). */
  running(): boolean;
  /** Starts the feeds once; later calls do nothing. */
  start(): void;
  stop(): void;
}

interface World {
  transport: Transport;
  clock: Clock;
  storage: Storage;
  vault: Vault;
  /** The demo signs in and syncs by itself before the screens draw. */
  prepare?(engine: Engine): Promise<void>;
  /** Where sign-ins happen: ITB's pages in web views, or the demo's made-up sign-in. */
  signInWindows: SignInWindows;
  clockOffset(): number;
}

/** A vault that forgets on quit, for the demo: its made-up sessions never touch the keystore. */
function memoryVault(): Vault {
  const values = new Map<string, string>();
  return {
    get: async (name) => values.get(name) ?? null,
    set: async (name, value) => void values.set(name, value),
    delete: async (name) => void values.delete(name),
  };
}

async function realWorld(): Promise<World> {
  return {
    transport: phoneTransport,
    clock: systemClock,
    storage: new PhoneStorage(),
    vault: new PhoneVault(),
    clockOffset: () => 0,
    signInWindows: phoneSignInWindows,
  };
}

async function demoWorld(): Promise<World> {
  // Only a demo build has ../demo in it (metro.config.js leaves it out of the real app).
  const { createDemoWorld } = require("../demo/world") as typeof import("../demo/world");
  const storage = new PhoneStorage("demo");
  storage.clear();
  return { ...(await createDemoWorld()), storage, vault: memoryVault() };
}

let current: Promise<Host> | null = null;

/** The one host of this app run, made on first use. */
export function host(): Promise<Host> {
  current ??= makeHost();
  return current;
}

async function makeHost(): Promise<Host> {
  const world = DEMO ? await demoWorld() : await realWorld();
  const log = new AppLog(() => world.clock.now());
  const listeners = new Set<(event: unknown) => void>();
  let lang: Lang = "id";
  const notifier = phoneNotifier(() => lang);
  const ui: HostUi = { openCheckIn: async () => undefined };
  const send = (event: Event) => {
    for (const listener of listeners) listener(event);
  };
  const engine = createEngine({
    transport: world.transport,
    clock: world.clock,
    storage: world.storage,
    vault: world.vault,
    version: APP_VERSION,
    emit: (event: Event) => {
      if (event.type === "settings" && event.settings.lang !== lang) {
        lang = event.settings.lang;
        void prepareChannels(lang);
      }
      send(event);
    },
    // The demo's made-up alerts stay in the app, as on the desktop.
    alert: (notice) => void (DEMO ? undefined : notifier.show(notice)),
    log,
    os: () => `Android ${Platform.Version}`,
  });
  await engine.load();
  lang = engine.snapshot().settings.lang;
  void prepareChannels(lang);
  if (world.prepare) await world.prepare(engine);

  // One Microsoft sign-in covers both systems, exactly as on the desktop.
  const both = signInToBoth({ engine, send, windows: world.signInWindows, log });

  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    engine.start();
  };
  const stop = () => {
    if (!started) return;
    started = false;
    engine.stop();
  };
  const handlers = phoneHandlers({
    engine,
    signIn: (source) => both.signIn(source),
    stopQuietSignIn: () => both.stopQuiet(),
    ui: { openCheckIn: (meetingId) => ui.openCheckIn(meetingId) },
    log,
    demo: DEMO,
    ready: () => start(),
    forgetEverything: async () => {
      if (world.storage instanceof PhoneStorage) world.storage.clear();
      await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);
      await Notifications.dismissAllNotificationsAsync().catch(() => undefined);
    },
    notificationsAllowed: async () => (await Notifications.getPermissionsAsync()).granted,
    showTestNotification: () =>
      notifier.show({
        id: "test",
        kind: "newTask",
        title: { key: "alert.test" },
        body: { key: "alert.test.body" },
        target: { screen: "tasks" },
      }),
  });
  const api: BridgeApi = {
    invoke: (name, input) => answer(handlers, log, name, input),
    onEvent(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    clockOffset: world.clockOffset(),
  };
  return { engine, api, ui, clockOffset: world.clockOffset, running: () => started, start, stop };
}
