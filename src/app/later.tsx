// Parts of the window the first screen doesn't need (the other screens,
// Settings, quick search, the welcome screen) load after it has drawn, so the
// window opens sooner. later() makes each a component that loads its code on
// first use. Once the first screen is up, preloadWhenIdle() loads them all, one
// at a time while the window is idle, so a click never waits; from then on each
// draws at once, with no fallback frame and no remount. Drawn before its code
// is in, it suspends: the screen behind stays up while it loads (going to it is
// then a transition, nav.tsx), and a dialog opens a moment later.
import { type ComponentType, type ReactNode, use, useSyncExternalStore } from "react";

export interface Later<P> {
  (props: P): ReactNode;
  /** Loads its code now; resolves once it draws at once. */
  preload(): Promise<void>;
  /** Whether its code is in, so it draws at once. */
  loaded(): boolean;
  /** Whether its code is in; draws again when it arrives. A closed dialog waits for this, so it never loads before the first screen. */
  useLoaded(): boolean;
}

const everything: (() => Promise<void>)[] = [];

export function later<P extends object>(load: () => Promise<ComponentType<P>>): Later<P> {
  let loaded: ComponentType<P> | null = null;
  let loading: Promise<ComponentType<P>> | null = null;
  let failure: { error: unknown } | null = null;
  const listeners = new Set<() => void>();
  const forget = () => {
    failure = null;
    loading = null;
  };
  const component = () => {
    loading ??= load().then(
      (component) => {
        loaded = component;
        for (const listener of listeners) listener();
        return component;
      },
      (error: unknown) => {
        failure = { error };
        throw error;
      },
    );
    return loading;
  };
  const read = () => {
    const pending = component();
    if (failure) {
      // Shown in the screen's crash guard. React draws once more on an error, in this same task; drawn
      // after it ("Coba lagi"), it loads again.
      const { error } = failure;
      setTimeout(forget);
      throw error;
    }
    return use(pending);
  };
  function Later(props: P) {
    const Component = loaded ?? read();
    return <Component {...props} />;
  }
  const preload = () => {
    if (failure) forget();
    return component().then(() => undefined);
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  const isLoaded = () => loaded !== null;
  const useLoaded = () => useSyncExternalStore(subscribe, isLoaded);
  everything.push(preload);
  return Object.assign(Later, { preload, loaded: isLoaded, useLoaded });
}

/** Loads every part made with later() now (tests do, before the window opens). */
export async function preloadAll(): Promise<void> {
  await Promise.all(everything.map((preload) => preload()));
}

/** Loads every part made with later(), one at a time, each when the window has nothing else to do. */
export async function preloadWhenIdle(): Promise<void> {
  for (const preload of everything) {
    await new Promise((resolve) => requestIdleCallback(resolve, { timeout: 1000 }));
    await preload().catch(() => undefined);
  }
}
