// What sits below a screen's first screenful mounts a frame after it: the screen opens with what the Student sees
// first, and the rest is there by the time they scroll (Nilai's this-term what-ifs and transcript, the planner's
// rules and outlook).
import { useEffect, useState } from "react";

/** False on the first frame, true from the frame after it. */
export function useAfterFirstFrame(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (ready) return;
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setReady(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [ready]);
  return ready;
}
