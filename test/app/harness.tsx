// Seam 2: the real window code (src/app) on a fake bridge. Behind the bridge
// runs the real engine against the pretend EduNex, so screens get real app
// models and events, exactly as they would through Electron's IPC.
import { act } from "react";
import { createRoot } from "react-dom/client";
import { App } from "../../src/app/app";
import { type BridgeApi, createBridge } from "../../src/app/bridge";
import type { UiClock } from "../../src/app/i18n";
import { AppStore } from "../../src/app/store";
import { type ActionName, type ActionResult, Actions, type AppSnapshot, type Event } from "../../src/core/contract";
import { createEngine, type Engine } from "../../src/engine/engine";
import { isEngineError } from "../../src/engine/errors";
import { PRETEND_TOKEN } from "../pretend/edunex";
import { MemoryStorage, MemoryVault } from "../pretend/memory";
import { PretendWorld } from "../pretend/world";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// Radix positions tooltips with ResizeObserver, which jsdom lacks.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver;

export interface Options {
  world?: PretendWorld;
  storage?: MemoryStorage;
  vault?: MemoryVault;
  /** Sign in to EduNex before the window opens. */
  signedIn?: boolean;
  /** Start the engine's own rhythm (default true). */
  start?: boolean;
  /** What the Student does in the sign-in window. */
  signInWindow?: "completes" | "closes";
  vaultMode?: AppSnapshot["vault"];
}

export async function openApp(options: Options = {}) {
  const world = options.world ?? new PretendWorld();
  const storage = options.storage ?? new MemoryStorage();
  const vault = options.vault ?? new MemoryVault();
  const listeners = new Set<(event: unknown) => void>();
  const engine: Engine = createEngine({
    transport: world,
    clock: world.clock,
    storage,
    vault,
    version: "2.0.0-test",
    random: () => 0.5,
    emit: (event: Event) => {
      for (const listener of listeners) listener(event);
    },
  });
  await engine.load();
  if (options.start !== false) engine.start();
  if (options.signedIn) await engine.signIn("edunex", { token: PRETEND_TOKEN });

  const calls: { name: ActionName; input: unknown }[] = [];
  const inFlight = new Set<Promise<unknown>>();
  const handlers: { [N in ActionName]: (input: never) => Promise<unknown> } = {
    "app.snapshot": async () => ({ ...engine.snapshot(), platform: "darwin", vault: options.vaultMode ?? "encrypted" }),
    "app.ready": async () => ({}),
    "auth.signIn": async ({ source }: { source: "edunex" }) => {
      if (options.signInWindow === "closes") return { signedIn: false };
      await engine.signIn(source, { token: PRETEND_TOKEN });
      return { signedIn: true };
    },
    "auth.signOut": async ({ source }: { source?: "edunex" }) => {
      await engine.signOut(source);
      return {};
    },
    "sync.refresh": async ({ source }: { source?: "edunex" }) => {
      await engine.refresh(source);
      return {};
    },
    "settings.update": async (patch: never) => engine.updateSettings(patch),
    "shell.openExternal": async () => ({}),
    "files.download": async ({ name }: { name: string }) => ({ path: `/Downloads/${name}` }),
    "local.set": async ({ name, value }: { name: string; value: unknown }) => {
      await engine.setLocal(name, value);
      return {};
    },
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
      inFlight.add(work);
      void work.finally(() => inFlight.delete(work));
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

  const container = document.body.appendChild(document.createElement("div"));
  const root = createRoot(container);
  const clock: UiClock = { now: () => world.clock.now(), subscribe: () => () => undefined };
  await act(async () => root.render(<App store={store} bridge={bridge} clock={clock} />));

  /** Lets every request the window made finish, and the screen catch up. */
  const settle = async () => {
    for (let round = 0; round < 50; round++) {
      await new Promise((resolve) => setImmediate(resolve));
      if (inFlight.size === 0) return;
      await Promise.allSettled([...inFlight]);
    }
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
    text: () => document.body.textContent ?? "",
    /** A button (or radio, or switch) by its accessible name. */
    button(name: string | RegExp): HTMLButtonElement {
      const found = find<HTMLButtonElement>("button, [role=radio], [role=switch]", name);
      if (!found) throw new Error(`No button named ${String(name)} in: ${screen.text().slice(0, 400)}`);
      return found;
    },
    has: (name: string | RegExp) => Boolean(find("button, [role=radio], [role=switch]", name)),
    async click(target: string | RegExp | HTMLElement): Promise<void> {
      const element = target instanceof HTMLElement ? target : screen.button(target);
      await act(async () => {
        element.click();
        await settle();
      });
    },
    async key(key: string): Promise<void> {
      await act(async () => {
        (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
        await settle();
      });
    },
    /** Lets engine time pass (its rhythm, back-off) and the screen catch up. */
    async wait(ms = 5_000): Promise<void> {
      await act(async () => {
        await world.clock.advance(ms);
        await settle();
      });
    },
    /** Runs engine work (a refresh, a sign-out) as if it came from elsewhere. */
    async engineDoes(work: () => Promise<unknown>): Promise<void> {
      await act(async () => {
        await work();
        await settle();
      });
    },
    /** An engine event arriving at the window (for what the engine itself never sends). */
    async apply(event: Event): Promise<void> {
      await act(async () => store.apply(event));
    },
    close(): void {
      act(() => root.unmount());
      container.remove();
      document.body.replaceChildren();
    },
  };
  return screen;
}
