// The window's memory: the snapshot it started with, kept current by engine
// events. Screens read it through hooks that subscribe to one dataset or one
// source each, so an update redraws only what uses it.
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo } from "react";
import type { AppSnapshot, DatasetPayload, Event, SignInStep } from "../core/contract";
import type { DatasetName, DatasetValue, Settings, SourceId, SourceStatus, UpdateInstall } from "../core/models";
import type { Route } from "../core/route";
import type { Bridge } from "./bridge";
import { useExternal } from "./external";

type Command = Extract<Event, { type: "command" }>["command"];
type SignInSource = Extract<Event, { type: "signIn" }>["source"];

export class AppStore {
  private readonly datasets = new Map<string, DatasetPayload>();
  private readonly statuses = new Map<SourceId, SourceStatus>();
  private settings: Settings;
  private update: UpdateInstall;
  private readonly listeners = new Map<string, Set<() => void>>();
  private readonly commandListeners = new Set<(command: Command) => void>();
  private readonly navigateListeners = new Set<(route: Route) => void>();
  private readonly signInSteps = new Map<SignInSource, SignInStep>();
  private readonly joinedListeners = new Set<(source: SignInSource) => void>();
  readonly version: string;
  readonly platform: AppSnapshot["platform"];
  readonly vault: AppSnapshot["vault"];
  /** Problem reports can go to the maintainer's relay with one click: this copy has its address. */
  readonly relay: boolean;
  /** Its changes reach the screens as transitions (./external.ts): the phone's screens read it through `deferredStore`. */
  deferred = false;

  constructor(snapshot: AppSnapshot) {
    for (const dataset of snapshot.datasets) this.datasets.set(dataset.name, dataset);
    for (const status of snapshot.statuses) this.statuses.set(status.source, status);
    this.settings = snapshot.settings;
    this.update = snapshot.update;
    this.version = snapshot.version;
    this.platform = snapshot.platform;
    this.vault = snapshot.vault;
    this.relay = snapshot.relay ?? false;
  }

  apply(event: Event): void {
    switch (event.type) {
      case "dataset": {
        const current = this.datasets.get(event.dataset.name);
        if (current?.hash === event.dataset.hash) return;
        this.datasets.set(event.dataset.name, event.dataset);
        this.notify(`dataset:${event.dataset.name}`);
        return;
      }
      case "dataset.removed":
        if (!this.datasets.delete(event.name)) return;
        this.notify(`dataset:${event.name}`);
        return;
      case "status":
        this.statuses.set(event.status.source, event.status);
        this.notify(`status:${event.status.source}`);
        return;
      case "settings":
        this.settings = event.settings;
        this.notify("settings");
        return;
      case "command":
        for (const listener of this.commandListeners) listener(event.command);
        return;
      case "navigate":
        for (const listener of this.navigateListeners) listener(event.route);
        return;
      case "signIn":
        if (event.step) this.signInSteps.set(event.source, event.step);
        else if (!this.signInSteps.delete(event.source)) return;
        this.notify(`signIn:${event.source}`);
        return;
      case "signIn.joined":
        for (const listener of this.joinedListeners) listener(event.source);
        return;
      case "update":
        this.update = event.update;
        this.notify("update");
    }
  }

  subscribe(topic: string, listener: () => void): () => void {
    let set = this.listeners.get(topic);
    if (!set) this.listeners.set(topic, (set = new Set()));
    set.add(listener);
    return () => set.delete(listener);
  }

  onCommand(listener: (command: Command) => void): () => void {
    this.commandListeners.add(listener);
    return () => this.commandListeners.delete(listener);
  }

  onNavigate(listener: (route: Route) => void): () => void {
    this.navigateListeners.add(listener);
    return () => this.navigateListeners.delete(listener);
  }

  onJoined(listener: (source: SignInSource) => void): () => void {
    this.joinedListeners.add(listener);
    return () => this.joinedListeners.delete(listener);
  }

  /** Where a sign-in stands past the Student's part, if it is past it. */
  signInStep(source: SignInSource): SignInStep | null {
    return this.signInSteps.get(source) ?? null;
  }

  dataset<N extends DatasetName>(name: N): DatasetPayload | undefined {
    return this.datasets.get(name);
  }

  status(source: SourceId): SourceStatus {
    let status = this.statuses.get(source);
    // Same object every time, so React sees no change until an event replaces it.
    if (!status) this.statuses.set(source, (status = { source, state: "signed-out", updatedAt: null, detail: null }));
    return status;
  }

  currentSettings(): Settings {
    return this.settings;
  }

  updateInstall(): UpdateInstall {
    return this.update;
  }

  private notify(topic: string): void {
    for (const listener of this.listeners.get(topic) ?? []) listener();
  }
}

interface AppContext {
  store: AppStore;
  bridge: Bridge;
}

const Context = createContext<AppContext | null>(null);

/**
 * The same value while the store and bridge stay the same: a provider drawn again for another reason (the phone's tab
 * gaining or losing focus) doesn't draw everything under it again.
 */
export function StoreProvider({ store, bridge, children }: AppContext & { children: ReactNode }) {
  const value = useMemo(() => ({ store, bridge }), [store, bridge]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

function useApp(): AppContext {
  const context = useContext(Context);
  if (!context) throw new Error("StoreProvider is missing");
  return context;
}

export function useStore(): AppStore {
  return useApp().store;
}

export function useBridge(): Bridge {
  return useApp().bridge;
}

export function useDataset<N extends DatasetName>(name: N): DatasetValue<N> | undefined {
  return useDatasetPayload(name)?.value as DatasetValue<N> | undefined;
}

export function useDatasetPayload(name: DatasetName): DatasetPayload | undefined {
  const store = useStore();
  return useTopic(store, `dataset:${name}`, () => store.dataset(name));
}

export function useStatus(source: SourceId): SourceStatus {
  const store = useStore();
  return useTopic(store, `status:${source}`, () => store.status(source));
}

export function useSettings(): Settings {
  const store = useStore();
  return useTopic(store, "settings", () => store.currentSettings());
}

/** Whether this copy can update itself, and how far an update got. */
export function useUpdateInstall(): UpdateInstall {
  const store = useStore();
  return useTopic(store, "update", () => store.updateInstall());
}

/** Where a sign-in stands once the Student's part is over: finishing out of sight, slow; null otherwise. */
export function useSignInStep(source: SignInSource): SignInStep | null {
  const store = useStore();
  return useTopic(store, `signIn:${source}`, () => store.signInStep(source));
}

/** One topic of `store`, again whenever it changes: at once, or as a transition for a deferred store. */
function useTopic<T>(store: AppStore, topic: string, read: () => T): T {
  const subscribe = useCallback((listener: () => void) => store.subscribe(topic, listener), [store, topic]);
  return useExternal(store.deferred, topic, subscribe, read);
}

/**
 * `store` as a screen reads it when what it draws can wait a moment for new data: the same data and the same commands,
 * each change handed over as a transition (./external.ts). The phone's screens read the store this way.
 */
export function deferredStore(store: AppStore): AppStore {
  const view = Object.create(store) as AppStore;
  view.deferred = true;
  return view;
}

/** Runs `handler` when a system connected by itself on the Student's sign-in to the other. */
export function useJoined(handler: (source: SignInSource) => void): void {
  const store = useStore();
  useEffect(() => store.onJoined(handler), [store, handler]);
}

/** Runs `handler` when the menu (or its shortcut) asks for something. */
export function useCommand(handler: (command: Command) => void): void {
  const store = useStore();
  useEffect(() => store.onCommand(handler), [store, handler]);
}

/** Runs `handler` when the engine asks for a screen (an OS notification was clicked). */
export function useNavigateRequests(handler: (route: Route) => void): void {
  const store = useStore();
  useEffect(() => store.onNavigate(handler), [store, handler]);
}
