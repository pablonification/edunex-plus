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
import { gradesHidden } from "../../../src/core/hide-grades";
import { EDUNEX_WEB, SIX_WEB } from "../../../src/core/links";
import { type Lang, UpdateNotice } from "../../../src/core/models";
import type { FetchFile } from "../../../src/desktop/remote-files";
import { type SignInWindows, signInToBoth } from "../../../src/desktop/signin-both";
import type { PlannedAlert } from "../../../src/engine/alerts/detector";
import { AppLog } from "../../../src/engine/app-log";
import { type Clock, systemClock } from "../../../src/engine/clock";
import { createEngine, type Engine, type StartLater } from "../../../src/engine/engine";
import type { Transport } from "../../../src/engine/http/transport";
import type { Storage, Vault } from "../../../src/engine/store/storage";
import { clearOrigin, clearWebData, cookiesFor, setCookie } from "../../modules/web-cookies";
import { perfDoing, perfSync } from "../perf";
import { phoneSignInWindows } from "../shell/sign-in";
import { phoneApkFiles } from "./apk-files";
import { apkUpdater } from "./apk-update";
import { checkInOpener, pageOpener } from "./check-in";
import { phoneFileHandlers } from "./files";
import { answer, type HostUi, phoneHandlers } from "./handlers";
import { phoneNotifier, prepareChannels } from "./notifier";
import { type PhoneReminders, phoneReminders } from "./reminders";
import { phoneReportHandlers } from "./report";
import { quietResignIn } from "./resignin";
import { sessionLog } from "./session-log";
import { setSettling } from "./settling";
import { PhoneStorage } from "./storage";
import { phoneTaskHandlers } from "./tasks";
import { phoneTransport } from "./transport";
import { PhoneVault } from "./vault";
import { APP_VERSION, DEMO, R3_GUARD, SHAPES } from "./version";

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
  /**
   * Starts the feeds once; later calls do nothing. `inFront`: the screens just drew (app.ready), so what the start can
   * leave for later waits a few seconds and goes a slice at a time (START_LATER); a background sync's start does it all.
   */
  start(inFront?: boolean): void;
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

/**
 * The demo's vault: its made-up sessions never touch the keystore. They're kept in the demo's own files, so a demo
 * resumed (EDUNEX_DEMO_RESUME=1) is still signed in to its pretend Edunex and SIX, as the real app is after a restart.
 */
function demoVault(storage: Storage): Vault {
  const key = (name: string) => `demo-vault/${name.replace(/[^a-z0-9._-]/gi, "_")}`;
  return {
    get: (name) => storage.read(key(name)),
    set: (name, value) => storage.write(key(name), value),
    delete: (name) => storage.remove(key(name)),
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
  return { ...demo, ...(resume ? { prepare: undefined } : {}), storage, vault: demoVault(storage) };
}

let current: Promise<Host> | null = null;

/** The one host of this app run, made on first use. */
export function host(): Promise<Host> {
  current ??= makeHost();
  return current;
}

async function makeHost(): Promise<Host> {
  const began = Date.now();
  const world = DEMO ? await demoWorld() : await realWorld();
  const made = Date.now();
  // Where the start's time goes, for the "[startup] host load" line: the disk's and the keystore's last answer.
  const waits = { disk: 0, diskDoneAt: 0, keystore: 0, keystoreDoneAt: 0 };
  const timedStorage: Storage = {
    read: (key) =>
      timed(world.storage.read(key), () => {
        waits.disk++;
        waits.diskDoneAt = Date.now();
      }),
    write: (key, text) => world.storage.write(key, text),
    remove: (key) => world.storage.remove(key),
    list: (prefix) => world.storage.list(prefix),
  };
  const timedVault: Vault = {
    get: (name) =>
      timed(world.vault.get(name), () => {
        waits.keystore++;
        waits.keystoreDoneAt = Date.now();
      }),
    set: (name, value) => world.vault.set(name, value),
    delete: (name) => world.vault.delete(name),
  };
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
  // Hidden wins until the settings are known: a grade never goes out in a notification by being early.
  let hideGrades = true;
  const notifier = phoneNotifier(
    () => lang,
    () => hideGrades,
  );
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
  // A QA build says on Android's log whether each session is live, ended or none (./session-log.ts).
  const sessions = R3_GUARD ? sessionLog() : null;
  // A session that ended while Microsoft's is still alive: signed in again out of sight, the screens never told
  // (./resignin.ts). Nothing is tried until the sign-ins below are ready.
  let both: ReturnType<typeof signInToBoth> | null = null;
  const resign = quietResignIn({
    now: () => Date.now(),
    inFront: () => both !== null && AppState.currentState === "active",
    status: (source) => (both ? engine.snapshot().statuses.find((status) => status.source === source) : undefined),
    retry: (source) => both?.retry(source) ?? Promise.resolve(false),
    show: (status) => send({ type: "status", status }),
    later: (ms, fn) => {
      const timer = setTimeout(fn, ms);
      return () => clearTimeout(timer);
    },
    log: (line) => {
      console.info(line);
      log.add("info", "resignin", line.replace(/^\[resignin\] /, ""));
    },
  });
  const engine = createEngine({
    // The demo says on Android's log what its sync reads (../perf.ts perfSync, W2's numbers); the real app doesn't. Both
    // name the site that just answered, for a stall right after (its page being read).
    transport: answered(DEMO ? traced(world.transport) : world.transport),
    clock: world.clock,
    storage: timedStorage,
    vault: timedVault,
    version: APP_VERSION,
    // A frame's turn for the screens in the middle of long work (SIX's 300 KB catalog pages): they share this thread.
    yieldToScreens: () => new Promise((resolve) => setTimeout(resolve, 0)),
    emit: (event: Event) => {
      if (DEMO) traceEvent(event);
      // A stall right after the screens hear of a dataset is likely their redraw for it: its name labels the stall.
      if (event.type === "dataset") perfDoing(`→ ${event.dataset.name}`);
      if (event.type === "status") {
        sessions?.saw(event.status);
        // The screens hear of it from ./resignin.ts: held back while a quiet try may bring the session back.
        resign.saw(event.status);
        return;
      }
      if (event.type === "settings" && event.settings.lang !== lang) {
        lang = event.settings.lang;
        void prepareChannels(lang);
      }
      if (event.type === "settings") {
        hideGrades = gradesHidden(event.settings);
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
    // A release is for this phone only once it carries its file: an APK on Android, an .ipa on an iPhone (the desktop's
    // installers are no use here).
    releaseAsset: Platform.OS === "ios" ? /\.ipa$/i : /\.apk$/i,
    os: () => (Platform.OS === "ios" ? `iOS ${Platform.Version}` : `Android ${Platform.Version}`),
    // Opened many times a day: each start shows what's saved and reads only what's due (W2 in PROGRESS.md).
    startDueOnly: true,
    // A pull to refresh reads what's on Beranda, not SIX's records and Edunex's materials again within the hour.
    quickRefresh: true,
    // What this build saved loads without its schemas checked again: checking them all was most of the start's wait.
    shapes: SHAPES,
  });
  const loading = Date.now();
  // Nothing saved yet: the app's first run on this phone, in the phone's own language (the desktop starts in English).
  // Asked beside the engine's own reads, not before them: one trip less to the disk ahead of the first frame.
  const [saved] = await Promise.all([world.storage.read("state.json"), engine.load()]);
  const firstRun = saved === null;
  const loadEnded = Date.now();
  sessions?.begin(engine.snapshot().statuses);
  if (firstRun && !DEMO) await engine.updateSettings({ lang: getLocales()[0]?.languageCode === "id" ? "id" : "en" });
  lang = engine.snapshot().settings.lang;
  hideGrades = gradesHidden(engine.snapshot().settings);
  void prepareChannels(lang);
  const loaded = Date.now();
  // The demo's sign-in and first sync run after the first frame, as the real app reads after a sign-in: Beranda draws
  // at once and fills in (./settling.ts). The lab reads where the time goes from these lines.
  const after = (at: number) => (at ? `+${at - loading}` : "none");
  console.info(
    `[startup] host load ${loaded - began} (world ${made - began}, engine.load ${loadEnded - loading}: ${waits.disk} files, last ${after(waits.diskDoneAt)}; ${waits.keystore} keystore, last ${after(waits.keystoreDoneAt)})`,
  );
  if (world.prepare) {
    setSettling(true);
    const settled = world.prepare(engine).then(
      () => {
        console.info(`[startup] settled ${Date.now() - loaded}`);
        setSettling(false);
      },
      (error: unknown) => {
        console.error("[startup] the demo's first sync failed:", error);
        setSettling(false);
      },
    );
    // The first-run demo signs nobody in: it has settled once its language is saved, a moment from now. Waited out
    // (100 ms at most, a fresh demo start only), so its first frame is the welcome's stage, not an empty Beranda that
    // "settling" drew for a moment before it.
    await Promise.race([settled, new Promise((done) => setTimeout(done, FIRST_RUN_SETTLE_MS))]);
  }

  // One Microsoft sign-in covers both systems, exactly as on the desktop.
  both = signInToBoth({ engine, send, windows: world.signInWindows, log });
  const signIns = both;
  // A session that ended while the app was closed: tried now, and whenever the app comes back to the front.
  resign.wake();
  AppState.addEventListener("change", (state) => {
    if (state === "active") resign.wake();
  });

  let started = false;
  const start = (inFront = false) => {
    if (started) return;
    started = true;
    engine.start(inFront ? startLater : undefined);
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
  // The demo's SIX page is pretend: opening it for a class counts as the Student pressing Tandai Hadir there, so SIX's
  // next read no longer shows the button (what Beranda's card then says, W10).
  const pretendSix = (world as { world?: { six?: { closeCheckIn(id: string): void } } }).world?.six;
  if (DEMO && pretendSix) {
    const open = ui.openCheckIn;
    ui.openCheckIn = async (meetingId) => {
      await open(meetingId);
      pretendSix.closeCheckIn(meetingId);
    };
  }
  ui.openPage = pageOpener();
  // Android's release builds download and install a newer release themselves, when the Student asks (./apk-update.ts).
  const updater =
    Platform.OS === "android" && !DEMO && !__DEV__
      ? apkUpdater({
          notice: () => {
            const found = engine.snapshot().datasets.find((dataset) => dataset.name === "app.update");
            return found ? UpdateNotice.parse(found.value) : null;
          },
          send: (update) => send({ type: "update", update }),
          log: log.for("update"),
          files: phoneApkFiles(),
        })
      : null;
  const handlers = {
    ...phoneHandlers({
      engine,
      signIn: (source) => signIns.signIn(source),
      stopQuietSignIn: () => signIns.stopQuiet(),
      ui: { openCheckIn: (meetingId) => ui.openCheckIn(meetingId), openPage: (url) => ui.openPage(url) },
      log,
      demo: DEMO,
      updater,
      ready: () => start(true),
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
          for (const cookie of await cookiesFor(`${SIX_WEB}/`)) await setCookie(`${SIX_WEB}/`, `${cookie.name}=; Max-Age=0; Path=/; Secure`);
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
  // The screens start from the engine's snapshot, with a session being brought back as they'd see it.
  const snapshot = handlers["app.snapshot"];
  if (snapshot)
    handlers["app.snapshot"] = async (input) => {
      const now = await snapshot(input);
      return { ...now, statuses: resign.shown(now.statuses) };
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
/** The most a fresh demo's start waits to learn that it signs nobody in (the first-run demo), before the first frame. */
const FIRST_RUN_SETTLE_MS = 100;

/**
 * How long after app.ready each part of the engine's start that can wait does (ms): the feeds go at once (the network is
 * the long wait), the rest once the screens' first seconds are over (the hidden tabs' first draws), each in a moment the
 * JS thread is idle and apart from the widget's first drawing (./widget.ts, 8 s). Run with the screens drawing, the
 * alerts' plan, its booking with Android and the restamp were part of a mid-range phone's 164–170 ms stall right after
 * the start ("[perf] js-block … app.ready").
 */
const START_LATER: Record<Parameters<StartLater>[0], number> = { alerts: 4_000, restamp: 15_000, updates: 30_000 };

/** The engine's start's later slices, each named for a stall right after ("engine: alerts"). */
const startLater: StartLater = (what, run) => {
  setTimeout(
    () =>
      whenIdle(() => {
        perfDoing(`engine: ${what}`);
        run();
      }),
    START_LATER[what],
  );
};

/** `run` once the JS thread is idle (at most 2 s away), or at once where there's no idle callback. */
function whenIdle(run: () => void): void {
  const g = globalThis as { requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number };
  if (g.requestIdleCallback) g.requestIdleCallback(run, { timeout: 2_000 });
  else run();
}

/** The sites by name, never by address: Android's log has no addresses of the real app's. */
function siteOf(url: string): string {
  const host = url.replace(/^https?:\/\//, "").replace(/[/:?].*$/, "");
  if (host.includes("six.")) return "six";
  if (host.includes("edunex")) return "edunex";
  if (host.endsWith("itb.ac.id")) return "itb";
  if (host.endsWith("github.com")) return "github";
  return "a site";
}

/** Each answer names its site as what the JS thread does next (../perf.ts): reading its page is the stall after it. */
function answered(transport: Transport): Transport {
  return {
    async request(request) {
      const response = await transport.request(request);
      perfDoing(`${siteOf(request.url)}'s answer`);
      return response;
    },
  };
}

/** `promise`, with `done` called as it settles. */
function timed<T>(promise: Promise<T>, done: () => void): Promise<T> {
  return promise.finally(done);
}

/** Every request through `transport`, timed, as "[sync]" lines (demo builds). */
function traced(transport: Transport): Transport {
  return {
    async request(request) {
      const at = Date.now();
      const where = request.url.replace(/^https?:\/\//, "").replace(/\?.*$/, "");
      try {
        const response = await transport.request(request);
        perfSync(`${request.method} ${where} ${response.status} ${Date.now() - at}ms`);
        return response;
      } catch (error) {
        perfSync(`${request.method} ${where} failed ${Date.now() - at}ms`);
        throw error;
      }
    },
  };
}

/** What the engine tells the screens that a sync is about: a changed dataset, a source's state. */
function traceEvent(event: Event): void {
  if (event.type === "dataset") perfSync(`dataset ${event.dataset.name}`);
  else if (event.type === "status") perfSync(`status ${event.status.source} ${event.status.state}`);
}
