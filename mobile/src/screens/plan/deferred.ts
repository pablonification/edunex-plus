// What sits below a screen's first screenful mounts after it, a part a frame: the screen opens with what the
// Student sees first, and the rest is there by the time they scroll (Nilai's chart, this term and transcript, the
// planner's rules, outlook and minors). Each part waits on its own (`Later`), so its arrival draws only itself, not
// the whole page again.
import { createElement, Fragment, type ReactNode, useEffect, useState } from "react";

/** False until `frames` frames have passed since the first render (1: the frame after it). */
export function useAfterFirstFrame(frames = 1): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (ready) return;
    let left = frames + 1;
    let id = 0;
    const step = () => {
      left -= 1;
      if (left <= 0) setReady(true);
      else id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [ready, frames]);
  return ready;
}

/** `children`, mounted `frame` frames after the screen's first one: below-the-fold parts arrive one per frame. */
export function Later({ frame = 1, children }: { frame?: number; children: ReactNode }) {
  return useAfterFirstFrame(frame) ? createElement(Fragment, null, children) : null;
}
