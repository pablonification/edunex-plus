// The window's memory: the snapshot it started with, kept current by engine
// events. Screens read it through hooks that subscribe to one dataset or one
// source each, so an update redraws only what uses it.
import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import type { AppSnapshot, DatasetPayload, Event } from "../core/contract";
import type { DatasetName, DatasetValue, Settings, SourceId, SourceStatus } from "../core/models";
import type { Bridge } from "./bridge";

type Command = Extract<Event, { type: "command" }>["command"];

export class AppStore {
  private readonly datasets = new Map<string, DatasetPayload>();
  private readonly statuses = new Map<SourceId, SourceStatus>();
  private settings: Settings;
  private readonly listeners = new Map<string, Set<() => void>>();
  private readonly commandListeners = new Set<(command: Command) => void>();
  readonly version: string;
  readonly platform: AppSnapshot["platform"];
  readonly vault: AppSnapshot["vault"];

  constructor(snapshot: AppSnapshot) {
    for (const dataset of snapshot.datasets) this.datasets.set(dataset.name, dataset);
    for (const status of snapshot.statuses) this.statuses.set(status.source, status);
    this.settings = snapshot.settings;
    this.version = snapshot.version;
    this.platform = snapshot.platform;
    this.vault = snapshot.vault;
  }

  apply(event: Event): void {
    switch (event.type) {
      case "dataset": {
        const current = this.datasets.get(event.dataset.name);
        if (current?.hash === event.dataset.hash) return;
        this.datasets.set(event.dataset.name, event.dataset);
        return this.notify(`dataset:${event.dataset.name}`);
      }
      case "dataset.removed":
        if (!this.datasets.delete(event.name)) return;
        return this.notify(`dataset:${event.name}`);
      case "status":
        this.statuses.set(event.status.source, event.status);
        return this.notify(`status:${event.status.source}`);
      case "settings":
        this.settings = event.settings;
        return this.notify("settings");
      case "command":
        for (const listener of this.commandListeners) listener(event.command);
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

  private notify(topic: string): void {
    for (const listener of this.listeners.get(topic) ?? []) listener();
  }
}

interface AppContext {
  store: AppStore;
  bridge: Bridge;
}

const Context = createContext<AppContext | null>(null);

export function StoreProvider({ store, bridge, children }: AppContext & { children: ReactNode }) {
  return <Context.Provider value={{ store, bridge }}>{children}</Context.Provider>;
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
  return useSyncExternalStore(
    (listener) => store.subscribe(`dataset:${name}`, listener),
    () => store.dataset(name),
  );
}

export function useStatus(source: SourceId): SourceStatus {
  const store = useStore();
  return useSyncExternalStore(
    (listener) => store.subscribe(`status:${source}`, listener),
    () => store.status(source),
  );
}

export function useSettings(): Settings {
  const store = useStore();
  return useSyncExternalStore(
    (listener) => store.subscribe("settings", listener),
    () => store.currentSettings(),
  );
}

/** Runs `handler` when the menu (or its shortcut) asks for something. */
export function useCommand(handler: (command: Command) => void): void {
  const store = useStore();
  useEffect(() => store.onCommand(handler), [store, handler]);
}
