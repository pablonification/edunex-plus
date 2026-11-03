// What sits below a screen's first screenful mounts after it, a part a frame: the screen opens with what the
// Student sees first, and the rest is there by the time they scroll (Nilai's chart, this term and transcript, the
// planner's rules, outlook and minors). Each part waits on its own (`Later`), so its arrival draws only itself, not
// the whole page again. The parts wait for the screen's push to finish first: mounted during it, each was a 100–190 ms
// JS chunk competing with the slide (one ~180 ms frame on Nilai, measured on v4), while the first screenful was
// already drawn at ~0.2 s.
import { NavigationContext } from "expo-router/react-navigation";
import { createElement, Fragment, type ReactNode, useContext, useEffect, useState } from "react";

/** The longest a part waits for a push to end; a screen shown without one (a tab, a reload) gets no transitionEnd. */
const SETTLE_MS = 400;

/** True once the screen's opening push has ended (or `SETTLE_MS` passed): what's below the fold may mount. */
function useScreenSettled(): boolean {
  const navigation = useContext(NavigationContext);
  const [settled, setSettled] = useState(navigation === undefined);
  useEffect(() => {
    if (settled) return;
    const settle = () => setSettled(true);
    const stop = navigation?.addListener("transitionEnd" as never, settle as never);
    const timer = setTimeout(settle, SETTLE_MS);
    return () => {
      clearTimeout(timer);
      stop?.();
    };
  }, [settled, navigation]);
  return settled;
}

/** False until the screen's push has ended and then `frames` frames have passed (1: the frame after it). */
export function useAfterFirstFrame(frames = 1): boolean {
  const settled = useScreenSettled();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (ready || !settled) return;
    let left = frames + 1;
    let id = 0;
    const step = () => {
      left -= 1;
      if (left <= 0) setReady(true);
      else id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [ready, settled, frames]);
  return ready;
}

/** `children`, mounted `frame` frames after the screen's push ends: below-the-fold parts arrive one per frame. */
export function Later({ frame = 1, children }: { frame?: number; children: ReactNode }) {
  return useAfterFirstFrame(frame) ? createElement(Fragment, null, children) : null;
}
