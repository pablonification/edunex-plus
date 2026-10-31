// The engine on the phone: the desktop's own engine (src/engine), created once in the app's JS
// thread with the phone's network, disk, keychain and notifications plugged in, and the bridge
// the desktop's screens talk through (src/app/bridge.ts), answered right here.
// A demo build (EXPO_PUBLIC_DEMO=1) runs it on the pretend Edunex and SIX instead (../demo).

import { Directory, Paths } from "expo-file-system";
import { getLocales } from "expo-localization";
import * as Notifications from "expo-notifications";
import { AppState, Platform } from "react-native";
import type { BridgeApi } from "../../../src/app/bridge";
import type { Event } from "../../../src/core/contract";
import { EDUNEX_WEB, SIX_WEB } from "../../../src/core/links";
import type { Lang } from "../../../src/core/models";
import type { FetchFile } from "../../../src/desktop/remote-files";
import { type SignInWindows, signInToBoth } from "../../../src/desktop/signin-both";
import type { PlannedAlert } from "../../../src/engine/alerts/detector";
import { AppLog } from "../../../src/engine/app-log";
import { type Clock, systemClock } from "../../../src/engine/clock";
import { createEngine, type Engine } from "../../../src/engine/engine";
import type { Transport } from "../../../src/engine/http/transport";
import type { Storage, Vault } from "../../../src/engine/store/storage";
import { clearOrigin, clearWebData, cookiesFor, setCookie } from "../../modules/web-cookies";
import { perfDoing } from "../perf";
import { phoneSignInWindows } from "../shell/sign-in";
import { checkInOpener, pageOpener } from "./check-in";
import { phoneFileHandlers } from "./files";
import { answer, type HostUi, phoneHandlers } from "./handlers";
import { phoneNotifier, prepareChannels } from "./notifier";
import { type PhoneReminders, phoneReminders } from "./reminders";
import { phoneReportHandlers } from "./report";
import { PhoneStorage } from "./storage";
import { phoneTaskHandlers } from "./tasks";
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
  /** Timed alerts booked with Android ahead, and the live ones checked against them (./reminders.ts). */
  reminders: PhoneReminders;
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
  /** Edunex's file storage: the network, or the demo's pretend storage. */
  fetchFile?: FetchFile;
  clockOffset(): number;
  /** The demo's alerts go to Android as the real app's do (EDUNEX_DEMO_NOTIFY=1), to see a reminder come with the app closed. */
  notify?: boolean;
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
  const demo = await createDemoWorld();
  // A fresh demo each start, unless it's asked to resume where it was (and has something to resume).
  const resume = demo.resume && (await storage.read("state.json")) !== null;
  if (!resume) storage.clear();
  return { ...demo, ...(resume ? { prepare: undefined } : {}), storage, vault: memoryVault() };
}

let current: Promise<Host> | null = null;

/** The one host of this app run, made on first use. */
export function host(): Promise<Host> {
  current ??= makeHost();
  return current;
}

async function makeHost(): Promise<Host> {
  const world = DEMO ? await demoWorld() : await realWorld();
  const toAndroid = !DEMO || world.notify === true;
  const log = new AppLog(() => world.clock.now());
  // Each step of the engine names what the JS thread was doing, should it stall ("[perf] js-block", ../perf.ts).
  const add = log.add.bind(log);
  log.add = (level, area, message) => {
    add(level, area, message);
    perfDoing(area);
  };
  const listeners = new Set<(event: unknown) => void>();
  let lang: Lang = "id";
  const notifier = phoneNotifier(() => lang);
  const reminders = phoneReminders({
    storage: world.storage,
    clock: world.clock,
    lang: () => lang,
    show: (notice) => notifier.show(notice),
    log: log.for("reminders"),
  });
  /** The settings timed alerts depend on: a change books them again at once, not at the next 5-minute check. */
  let alertSettings = "";
  const ui: HostUi = { openCheckIn: async () => undefined, openPage: async () => undefined };
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
      if (event.type === "settings") {
        const { mutedAlerts, deadlineReminders, classSoonAlerts } = event.settings;
        const next = JSON.stringify([lang, mutedAlerts, deadlineReminders, classSoonAlerts]);
        if (alertSettings && next !== alertSettings) queueMicrotask(() => engine.planAlerts());
        alertSettings = next;
      }
      send(event);
    },
    // The demo's made-up alerts stay in the app, as on the desktop, unless it's asked to show how they arrive.
    alert: (notice) => void (toAndroid ? reminders.deliver(notice) : undefined),
    // What's planned is booked with Android, to arrive with the app closed (./reminders.ts).
    ...(toAndroid ? { upcoming: (planned: readonly PlannedAlert[]) => reminders.upcoming(planned) } : {}),
    // A closed app reads no SIX for Tandai Hadir: a reminder at the start of every class SIX counts instead.
    checkInReminders: true,
    log,
    // Release builds ask GitHub once a day whether a newer version is out (Settings says so, D5); never the demo.
    checkForUpdates: !DEMO && !__DEV__,
    // A release is for the phone only once it carries an APK: the desktop's installers are no use here.
    releaseAsset: /\.apk$/i,
    os: () => `Android ${Platform.Version}`,
    // Opened many times a day: each start shows what's saved and reads only what's due (W2 in PROGRESS.md).
    startDueOnly: true,
  });
  // Nothing saved yet: the app's first run on this phone, in the phone's own language (the desktop starts in English).
  const firstRun = (await world.storage.read("state.json")) === null;
  await engine.load();
  if (firstRun && !DEMO) await engine.updateSettings({ lang: getLocales()[0]?.languageCode === "id" ? "id" : "en" });
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
  // Back in the app (from Android's settings, say, notifications maybe just turned on): what's planned is booked again.
  if (!DEMO)
    AppState.addEventListener("change", (state) => {
      if (state === "active" && started) engine.planAlerts();
    });
  // "Tandai Hadir" and every other page of Edunex's or SIX's: in a page of the app, signed in (./check-in.ts).
  ui.openCheckIn = checkInOpener();
  ui.openPage = pageOpener();
  const handlers = {
    ...phoneHandlers({
      engine,
      signIn: (source) => both.signIn(source),
      stopQuietSignIn: () => both.stopQuiet(),
      ui: { openCheckIn: (meetingId) => ui.openCheckIn(meetingId), openPage: (url) => ui.openPage(url) },
      log,
      demo: DEMO,
      ready: () => start(),
      forgetEverything: async () => {
        if (world.storage instanceof PhoneStorage) world.storage.clear();
        // Edunex's files the app downloaded, and everything ITB's and SIX's pages kept.
        const downloads = new Directory(Paths.document, "downloads");
        if (downloads.exists) downloads.delete();
        await clearWebData().catch(() => undefined);
        await Notifications.cancelAllScheduledNotificationsAsync().catch(() => undefined);
        reminders.forget();
        await Notifications.dismissAllNotificationsAsync().catch(() => undefined);
      },
      forgetSource: async (source) => {
        if (source === "edunex") {
          // Edunex's files go with the account they came from (the desktop's file cache and downloads).
          const downloads = new Directory(Paths.document, "downloads");
          if (downloads.exists) downloads.delete();
          // And Edunex's sign-in its website kept in the app's pages.
          clearOrigin(EDUNEX_WEB);
        } else {
          // SIX's session, as Tandai Hadir's page holds it: each of SIX's cookies, expired.
          for (const cookie of cookiesFor(`${SIX_WEB}/`)) await setCookie(`${SIX_WEB}/`, `${cookie.name}=; Max-Age=0; Path=/; Secure`);
        }
      },
      notificationsAllowed: async () => (await Notifications.getPermissionsAsync()).granted,
      // "Coba notifikasi" is the Student asking for one: Android asks for the permission here when it never has (it
      // does at the welcome's "Buka Edunex Plus", which a phone set up before that never saw).
      showTestNotification: async () => {
        const permission = await Notifications.getPermissionsAsync();
        if (!permission.granted && permission.canAskAgain) await Notifications.requestPermissionsAsync();
        return notifier.show({
          id: "test",
          kind: "newTask",
          title: { key: "alert.test" },
          body: { key: "alert.test.body" },
          target: { screen: "tasks" },
        });
      },
    }),
    // Handing in a Task (./tasks.ts) and Edunex's files (./files.ts), the desktop's hand-in.ts and files handlers.
    ...phoneTaskHandlers(engine),
    ...phoneFileHandlers({ engine, fetchFile: world.fetchFile }),
    // "Laporkan masalah" (./report.ts): the engine builds and scrubs it; nothing leaves until the Student says.
    ...phoneReportHandlers({ engine, log, demo: DEMO }),
  };
  const api: BridgeApi = {
    invoke: (name, input) => answer(handlers, log, name, input),
    onEvent(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    clockOffset: world.clockOffset(),
  };
  return { engine, api, ui, reminders, clockOffset: world.clockOffset, running: () => started, start, stop };
}
