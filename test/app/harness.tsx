// Seam 2: the real window code (src/app) on a fake bridge. Behind the bridge
// runs the real engine against the pretend Edunex, so screens get real app
// models and events, exactly as they would through Electron's IPC.
import { act } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../../src/app/app";
import { type BridgeApi, createBridge } from "../../src/app/bridge";
import type { UiClock } from "../../src/app/i18n";
import { preloadAll } from "../../src/app/later";
import { AppStore } from "../../src/app/store";
import { skipAnimations } from "../../src/app/ui/motion/animate";
import { type ActionName, type ActionResult, Actions, type AppSnapshot, type Event } from "../../src/core/contract";
import { planOfflineFiles } from "../../src/core/course-materials";
import { isOfficialUrl, isWebLink } from "../../src/core/links";
import type { SourceId } from "../../src/core/models";
import { phoneCalendar } from "../../src/core/phone-calendar";
import { handInHandlers, type LocalFile } from "../../src/desktop/hand-in";
import { readFile } from "../../src/desktop/remote-files";
import { signInToBoth } from "../../src/desktop/signin-both";
import { createEngine, type Engine } from "../../src/engine/engine";
import { EngineError, isEngineError } from "../../src/engine/errors";
import { PRETEND_TOKEN } from "../pretend/edunex";
// The PDF viewer loads on first use; here it's loaded already, so opening one settles within a click.
import "../../src/app/ui/pdf-viewer";
import { MemoryStorage, MemoryVault } from "../pretend/memory";
import { PretendNtfy } from "../pretend/ntfy";
import { PRETEND_SIX_COOKIE } from "../pretend/six";
import { PretendWorld } from "../pretend/world";
import { assertTidyFacts } from "./tidy-facts";

// Popovers place themselves with floating-ui, which asks every ancestor whether it
// matches ":popover-open" or ":modal". jsdom's selector engine doesn't know those and
// rebuilds itself on each call, turning one open popover into seconds of work. No
// element here is ever in the top layer, so answer them at once.
if (typeof Element !== "undefined") {
  const matches = Element.prototype.matches;
  Element.prototype.matches = function (this: Element, selector: string) {
    return selector === ":popover-open" || selector === ":modal" ? false : matches.call(this, selector);
  };
}

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// JS animation finishes at once: a toast or a row that leaves is gone when the test looks, as
// Radix overlays already are (jsdom never runs their CSS animations).
skipAnimations(true);
// Radix positions tooltips with ResizeObserver, which jsdom lacks.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;
// Pictures read in from Edunex's storage show from memory through object URLs, which jsdom can't make.
let objectUrls = 0;
URL.createObjectURL = () => `blob:app://edunex-plus/${++objectUrls}`;
URL.revokeObjectURL = () => undefined;

// The writing box (ProseMirror) measures text to keep the cursor in view; jsdom measures nothing.
if (typeof Range !== "undefined" && !Range.prototype.getClientRects) {
  const none = { top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) };
  Range.prototype.getClientRects = () => Object.assign([], { item: () => null }) as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => none as DOMRect;
}

export interface Options {
  world?: PretendWorld;
  storage?: MemoryStorage;
  vault?: MemoryVault;
  /** Sign in to Edunex before the window opens. */
  signedIn?: boolean;
  /** Sign in to SIX before the window opens. */
  six?: boolean;
  /** Start the engine's own rhythm (default true). */
  start?: boolean;
  /** What the Student does in the sign-in window. */
  signInWindow?: "completes" | "closes";
  /**
   * What the app's own quiet try for the other system finds, right after the Student signs in to one:
   * Microsoft's session, so it connects by itself, or Microsoft asking for the Student, so it gives up
   * (the default, so each test connects what it means to).
   */
  microsoft?: "remembers" | "asks";
  vaultMode?: AppSnapshot["vault"];
  /** Run the packaged app's "new version available" check against the pretend GitHub. */
  checkForUpdates?: boolean;
  /** Let the first-run scan open by itself, as for a new Student (default: already seen, so it doesn't cover the screen under test). */
  firstScan?: boolean;
  /** The system the window runs on (default macOS). */
  platform?: AppSnapshot["platform"];
  /** Where the phone's messages go (default: a pretend ntfy of its own). */
  ntfy?: PretendNtfy;
}

export async function openApp(options: Options = {}) {
  const world = options.world ?? new PretendWorld();
  const storage = options.storage ?? new MemoryStorage();
  const vault = options.vault ?? new MemoryVault();
  const ntfy = options.ntfy ?? new PretendNtfy();
  const listeners = new Set<(event: unknown) => void>();
  const engine: Engine = createEngine({
    transport: world,
    clock: world.clock,
    storage,
    vault,
    version: "2.0.0-test",
    checkForUpdates: options.checkForUpdates,
    phone: { ntfy: ntfy.send, newTopic: ntfy.newTopic },
    random: () => 0.5,
    emit: (event: Event) => {
      for (const listener of listeners) listener(event);
    },
  });
  await engine.load();
  if (!options.firstScan) await engine.updateSettings({ firstScanDone: true });
  if (options.start !== false) engine.start();

  /** SIX is read at human pace (a page every two seconds): the fake clock runs until the work is done. */
  const meanwhile = async <T,>(work: Promise<T>): Promise<T> => {
    let done = false;
    const watched = work.finally(() => {
      done = true;
    });
    watched.catch(() => undefined);
    for (let second = 0; second < 600; second++) {
      await new Promise((resolve) => setImmediate(resolve));
      if (done) break;
      await world.clock.advance(1_000);
    }
    return watched;
  };
  const sessionFor = (source: SourceId) => (source === "six" ? { cookie: PRETEND_SIX_COOKIE } : { token: PRETEND_TOKEN });
  if (options.signedIn) await engine.signIn("edunex", sessionFor("edunex"));
  if (options.six) await meanwhile(engine.signIn("six", sessionFor("six")));

  const calls: { name: ActionName; input: unknown }[] = [];
  /** What the system file picker gives the next time it opens (the Student's choice); nothing = cancelled. */
  let nextPick: LocalFile[] = [];
  /** Calendar files the Student saved, in order. */
  const exported: string[] = [];
  /** PDFs the Student filled in and saved a copy of, in order (their content as text). */
  const savedCopies: { name: string; text: string }[] = [];
  let saveDialogCloses = false;
  /** What the Student put on the clipboard, in order. */
  const copied: string[] = [];
  /** Files downloaded so far: main opens the copy it downloaded before instead of downloading again. */
  const downloaded = new Set<string>();
  /** The system can't open links (no browser set, the OS refused). */
  let linksFail = false;
  const inFlight = new Set<Promise<unknown>>();
  const track = (work: Promise<unknown>) => {
    inFlight.add(work);
    void work.catch(() => undefined).finally(() => inFlight.delete(work));
  };
  // Main's real sign-in logic (one Microsoft sign-in for both systems), on pretend sign-in windows.
  const signIns = signInToBoth({
    engine: { snapshot: () => engine.snapshot(), signIn: (source, session) => meanwhile(engine.signIn(source, session)) },
    send: (event) => {
      for (const listener of listeners) listener(event);
    },
    windows: {
      open: async (source, { quiet, onStep }) => {
        const session = source === "edunex" ? PRETEND_TOKEN : PRETEND_SIX_COOKIE;
        if (quiet) return options.microsoft === "remembers" ? session : null;
        if (options.signInWindow === "closes") return null;
        // Microsoft hands back; the window hides while the website's session is read.
        onStep("finishing");
        return session;
      },
      stopQuiet: () => undefined,
      forget: async () => undefined,
    },
    background: track,
  });
  const handlers: { [N in ActionName]: (input: never) => Promise<unknown> } = {
    "app.snapshot": async () => ({ ...engine.snapshot(), platform: options.platform ?? "darwin", vault: options.vaultMode ?? "encrypted" }),
    "app.ready": async () => ({}),
    "auth.signIn": async ({ source }: { source: SourceId }) => {
      if (source === "itb") throw new EngineError("Rejected", "itb has no sign-in");
      return { signedIn: await signIns.signIn(source) };
    },
    "auth.signOut": async ({ source }: { source?: SourceId }) => {
      await engine.signOut(source);
      return {};
    },
    "auth.signInDone": async () => ({}),
    "sync.refresh": async ({ source }: { source?: SourceId }) => {
      await meanwhile(engine.refresh(source));
      return {};
    },
    "settings.update": async (patch: never) => engine.updateSettings(patch),
    // Main's rules: the app's own links open only official pages; a lecturer's link, any web page.
    "shell.openExternal": async ({ url }: { url: string }) => {
      if (!isOfficialUrl(url)) throw new EngineError("Rejected", "Only official pages open from the app");
      if (linksFail) throw new EngineError("Failed", "The system couldn't open it");
      return {};
    },
    "shell.openLink": async ({ url }: { url: string }) => {
      if (!isWebLink(url)) throw new EngineError("Rejected", "Only web pages open from a lecturer's link");
      if (linksFail) throw new EngineError("Failed", "The system couldn't open it");
      return {};
    },
    // Main's real reader, on the pretend storage.
    "files.read": async ({ url, as }: { url: string; as: "image" | "pdf" }) => readFile({ fetch: (address, init) => world.fetch(address, init) }, url, as),
    "files.download": async ({ url, name }: { url: string; name: string }) => {
      const existing = downloaded.has(url);
      downloaded.add(url);
      return { path: `/Downloads/${name}`, existing };
    },
    // The save dialog: the Student keeps the name offered, or closes it once (`closeSaveDialog`). Tests read `savedCopies`.
    "files.saveCopy": async ({ name, bytes }: { name: string; bytes: Uint8Array }) => {
      if (saveDialogCloses) {
        saveDialogCloses = false;
        return { file: null };
      }
      savedCopies.push({ name, text: new TextDecoder().decode(bytes) });
      return { file: name };
    },
    "course.saveOffline": async ({ code, pick }: { code: string; pick: boolean }) => {
      const value = <T,>(name: string) => engine.snapshot().datasets.find((d) => d.name === name)?.value as T | undefined;
      const course = value<{ code: string; name: string; edunex: { courseId: number } }[]>("edunex.courses")?.find((c) => c.code === code);
      if (!course) throw new EngineError("Rejected", `${code} isn't one of this term's courses`);
      const plan = planOfflineFiles(
        { code, name: course.name, mainCourseId: course.edunex.courseId },
        value<Record<string, never>>("edunex.outline")?.[code],
        value<Record<string, never[]>>("edunex.materials")?.[code] ?? [],
        engine.snapshot().settings.lang,
      );
      return { folder: `${pick ? "/Picked" : "/Documents/Edunex Plus"}/${plan.folder}`, saved: plan.files.length, kept: 0, failed: 0 };
    },
    "local.set": async ({ name, value }: { name: string; value: unknown }) => {
      await engine.setLocal(name, value);
      return {};
    },
    "alerts.markRead": async () => {
      await engine.markAlertsRead();
      return {};
    },
    "alerts.test": async () => ({ shown: true }),
    "app.openRelease": async () => ({}),
    // Main's handlers, on the pretend ntfy; the clipboard is `copied`.
    "phone.link": async () => engine.phone.link(),
    "phone.connect": () => engine.phone.connect(),
    "phone.test": () => engine.phone.test(),
    "phone.copy": async () => {
      const link = engine.phone.link();
      if (link.connected) copied.push(link.topic);
      return {};
    },
    "phone.disconnect": () => engine.phone.disconnect(),
    // The calendar file main would write through the save dialog; tests read it from `exported`.
    "schedule.export": async (options: Parameters<typeof phoneCalendar>[3]) => {
      const calendar = phoneCalendar(
        (name) => engine.snapshot().datasets.find((d) => d.name === name)?.value as never,
        engine.snapshot().settings.lang,
        world.clock.now(),
        options,
      );
      exported.push(calendar.text);
      return { file: "Edunex Plus.ics", events: calendar.events };
    },
    "schedule.reveal": async () => ({}),
    // Handing in runs main's real handlers; only the system file picker is pretend.
    ...handInHandlers(engine, async () => {
      const files = nextPick;
      nextPick = [];
      return files;
    }),
  };
  // The preload's surface, answering the way main's bridge does (input checked against the contract).
  const api: BridgeApi = {
    invoke(name, input) {
      const action = name as ActionName;
      calls.push({ name: action, input });
      const work = (async (): Promise<ActionResult<unknown>> => {
        const parsed = Actions[action].input.safeParse(input ?? {});
        if (!parsed.success) return { ok: false, error: { kind: "Rejected", message: `Bad input for ${action}` } };
        try {
          return { ok: true, value: await handlers[action](parsed.data as never) };
        } catch (error) {
          if (isEngineError(error)) return { ok: false, error: { kind: error.kind, message: error.message } };
          throw error;
        }
      })();
      track(work);
      return work;
    },
    onEvent(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  // Start-up exactly as src/app/main.tsx does it.
  const bridge = createBridge(api);
  let current: AppStore | null = null;
  const early: Event[] = [];
  bridge.onEvent((event) => (current ? current.apply(event) : early.push(event)));
  const store = new AppStore(await bridge.invoke("app.snapshot", {}));
  current = store;
  for (const event of early) store.apply(event);

  // The screens that load after the first one are in already, so every step draws its screen at once, as after the idle preload.
  await preloadAll();
  const container = document.body.appendChild(document.createElement("div"));
  const root = createRoot(container);
  // The window's clock reads the fake one; screens re-read it on `tick()`, as the real one does each minute.
  const minute = new Set<() => void>();
  const clock: UiClock = {
    now: () => world.clock.now(),
    subscribe: (listener) => {
      minute.add(listener);
      return () => minute.delete(listener);
    },
  };
  await act(async () => root.render(<App store={store} bridge={bridge} clock={clock} />));
  // Every screen, after every step a test takes: no empty fact, no dangling "·".
  assertTidyFacts();

  /** Lets every request the window made finish, and the screen catch up. */
  const settle = async () => {
    for (let round = 0; round < 50; round++) {
      await new Promise((resolve) => setImmediate(resolve));
      if (inFlight.size === 0) return;
      await Promise.allSettled([...inFlight]);
    }
  };
  /**
   * After a click or a key: also what the window does on its next tick. A menu
   * or dialog that closes hands focus back a tick later (Radix), and focus on a
   * tab switches to it: on a slow machine that hand-back could land after the
   * test's next step and undo it.
   */
  const settleStep = async () => {
    await settle();
    await new Promise((resolve) => setTimeout(resolve, 0));
    await settle();
  };

  const find = <T extends Element>(selector: string, name: string | RegExp): T | undefined =>
    [...document.body.querySelectorAll<T>(selector)].find((el) => {
      const label = (el.getAttribute("aria-label") ?? el.textContent ?? "").trim();
      return typeof name === "string" ? label === name : name.test(label);
    });

  const screen = {
    world,
    engine,
    store,
    storage,
    vault,
    calls,
    exported,
    savedCopies,
    ntfy,
    copied,
    text: () => document.body.textContent ?? "",
    /** A button (or radio, or switch) by its accessible name. */
    button(name: string | RegExp): HTMLButtonElement {
      const found = find<HTMLButtonElement>("button, [role=radio], [role=switch]", name);
      if (!found) throw new Error(`No button named ${String(name)} in: ${screen.text().slice(0, 400)}`);
      return found;
    },
    has: (name: string | RegExp) => Boolean(find("button, [role=radio], [role=switch]", name)),
    /** What the top bar's data-status panel says about a source ("Terhubung", "Sesi berakhir"…), read the way the Student reads it. */
    async sourceState(source: "Edunex" | "SIX" | "Kalender ITB" | "ITB calendar"): Promise<string> {
      await screen.click(/^(Status data|Data status):/);
      const line = [...document.querySelectorAll("[role=dialog] li p")].find((p) => p.textContent?.startsWith(`${source} ·`));
      const state = line?.textContent?.slice(source.length + 3).trim() ?? "";
      await screen.key("Escape");
      return state;
    },
    async click(target: string | RegExp | HTMLElement): Promise<void> {
      const element = target instanceof HTMLElement ? target : screen.button(target);
      await act(async () => {
        element.click();
        await settleStep();
      });
      assertTidyFacts();
    },
    async key(key: string): Promise<void> {
      await act(async () => {
        (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
        await settleStep();
      });
      assertTidyFacts();
    },
    /** The next save dialog is closed without saving. */
    closeSaveDialog(): void {
      saveDialogCloses = true;
    },
    /** From now on the system fails to open links in the browser. */
    failLinks(): void {
      linksFail = true;
    },
    /** The files the Student will choose the next time the system file picker opens. */
    willPick(files: { name: string; content?: string; size?: number; type?: string; unreadable?: boolean }[]): void {
      nextPick = files.map((file) => {
        const bytes = new TextEncoder().encode(file.content ?? `%PDF ${file.name}`);
        return {
          name: file.name,
          size: file.size ?? bytes.byteLength,
          type: file.type ?? "",
          read: async () => {
            if (file.unreadable) throw new Error("ENOENT");
            return bytes;
          },
        };
      });
    },
    /** The writing box named `label` (it loads on its own, shortly after its screen), once it's there. */
    async editor(label: string | RegExp = /^(Jawabanmu|Your answer)$/): Promise<HTMLElement> {
      for (let round = 0; round < 200; round++) {
        const found = find<HTMLElement>("[role=textbox][contenteditable]", label);
        if (found) return found;
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 5));
        });
      }
      throw new Error(`No writing box named ${String(label)}`);
    },
    /**
     * Writes in a writing box the way a Student pastes into it: everything in it
     * is replaced by `html` (plain text pastes as itself).
     */
    async write(html: string, label?: string | RegExp): Promise<void> {
      const box = await screen.editor(label);
      await act(async () => {
        box.focus();
        box.dispatchEvent(new KeyboardEvent("keydown", { key: "a", ctrlKey: true, bubbles: true, cancelable: true }));
        const paste = new window.Event("paste", { bubbles: true, cancelable: true });
        const text = new DOMParser().parseFromString(html, "text/html").body.textContent ?? "";
        Object.defineProperty(paste, "clipboardData", {
          value: {
            types: ["text/html", "text/plain"],
            files: [],
            getData: (type: string) => (type === "text/html" ? html : type === "text/plain" ? text : ""),
          },
        });
        box.dispatchEvent(paste);
        await settle();
      });
    },
    /** Lets engine time pass (its rhythm, back-off) and the screen catch up. */
    async wait(ms = 5_000): Promise<void> {
      await act(async () => {
        await world.clock.advance(ms);
        await settle();
      });
      assertTidyFacts();
    },
    /** The window's minute tick: screens re-read the time (after `wait`, say). */
    async tick(): Promise<void> {
      await act(async () => {
        for (const listener of minute) listener();
        await settle();
      });
      assertTidyFacts();
    },
    /** Runs engine work (a refresh, a sign-out) as if it came from elsewhere. */
    async engineDoes(work: () => Promise<unknown>): Promise<void> {
      await act(async () => {
        await meanwhile(work());
        await settle();
      });
      assertTidyFacts();
    },
    /** An engine event arriving at the window (for what the engine itself never sends). */
    async apply(event: Event): Promise<void> {
      await act(async () => store.apply(event));
      assertTidyFacts();
    },
    close(): void {
      act(() => root.unmount());
      container.remove();
      document.body.replaceChildren();
    },
  };
  return screen;
}
