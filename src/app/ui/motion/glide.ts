// Something that stays on screen while what's around it changes, and so moves
// (the app's mark as the welcome screen gives way to its reading step), glides
// from where it was to where it is now instead of jumping. Measured just before
// the change, then played back as a transform after it (FLIP), 400 ms with the
// easing for moving. It keeps going while the page around it redraws, and
// stops when the element goes.
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { animate } from "./animate";
import { DURATION, EASE } from "./tokens";

/** `ref` goes on the element; call `before()` right before the change that moves it. */
export function useGlide<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const from = useRef<DOMRect | null>(null);
  const playing = useRef<Animation | null>(null);
  const before = useCallback(() => {
    from.current = ref.current?.getBoundingClientRect() ?? null;
  }, []);

  // After every render, but it only plays after a `before()`: the page around it redrawing doesn't stop it.
  useLayoutEffect(() => {
    const was = from.current;
    const element = ref.current;
    from.current = null;
    if (!was || !element) return;
    const now = element.getBoundingClientRect();
    const x = was.left - now.left;
    const y = was.top - now.top;
    if (!x && !y) return;
    playing.current?.cancel();
    playing.current = animate(element, [{ transform: `translate(${x}px, ${y}px)` }, { transform: "none" }], {
      duration: DURATION.slow,
      easing: EASE.standard,
    });
  });
  useEffect(() => () => playing.current?.cancel(), []);

  return { ref, before };
}
