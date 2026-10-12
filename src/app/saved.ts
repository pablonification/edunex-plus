// Many datasets at once, as one object (core's `Saved`), for the parts of the
// window that reason over most of them: quick search and the first-run scan.
// One subscription per dataset; the object changes only when one of them does.
import { useCallback, useRef, useSyncExternalStore } from "react";
import type { DatasetPayload } from "../core/contract";
import type { DatasetName } from "../core/models";
import type { Saved } from "../core/saved";
import { useStore } from "./store";

export function useSaved(names: readonly DatasetName[]): Saved {
  const store = useStore();
  const last = useRef<{ payloads: (DatasetPayload | undefined)[]; saved: Saved } | null>(null);
  const subscribe = useCallback(
    (listener: () => void) => {
      const stops = names.map((name) => store.subscribe(`dataset:${name}`, listener));
      return () => {
        for (const stop of stops) stop();
      };
    },
    [store, names],
  );
  const read = useCallback(() => {
    const payloads = names.map((name) => store.dataset(name));
    const previous = last.current;
    if (previous && previous.payloads.length === payloads.length && previous.payloads.every((payload, i) => payload === payloads[i])) return previous.saved;
    const saved = Object.fromEntries(names.flatMap((name, i) => (payloads[i] ? [[name, payloads[i].value]] : []))) as Saved;
    last.current = { payloads, saved };
    return saved;
  }, [store, names]);
  return useSyncExternalStore(subscribe, read);
}
