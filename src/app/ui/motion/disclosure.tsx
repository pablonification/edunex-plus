// A panel that opens and closes smoothly under its button (a material's text,
// a semester, a row's details): height and opacity in 200 ms, closing a little
// quicker, instead of jumping. While it closes nothing in it can be reached,
// and focus that was inside goes back to its button. With Reduce motion it
// opens and closes at once.
//
// After motion-primitives' Disclosure
// (github.com/ibelick/motion-primitives, MIT, © 2024 ibelick), cut down to the
// panel, and animated as T3 Code's AnimatedHeight is: the Web Animations API,
// clipped only while it moves. The screen keeps its own <button> and spreads disclosureTrigger(open,
// id) on it: the original's trigger cloned its child, replaced the child's own
// onClick with its toggle, forced role="button" and tabIndex onto whatever it
// got, and its content had no id for aria-controls to point at.
//
// Pad the content inside the panel, not the panel itself: a padded box can't
// shrink to nothing.
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { cx } from "../cx";
import { animate } from "./animate";
import { DURATION, EASE } from "./tokens";

/** What the button that opens a DisclosurePanel says to screen readers. */
export function disclosureTrigger(open: boolean, id: string) {
  return { "aria-expanded": open, "aria-controls": id } as const;
}

interface PanelProps {
  open: boolean;
  id: string;
  className?: string;
  children: ReactNode;
}

export function DisclosurePanel({ open, id, className, children }: PanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  // In the page while open and while it closes; gone once closed.
  const [shown, setShown] = useState(open);
  if (open && !shown) setShown(true);
  /** The animation playing on the panel, or a finished close holding it shut until it's taken away. */
  const moving = useRef<{ panel: HTMLElement; animation: Animation } | null>(null);
  /** Open as last animated: a panel first shown open, or a new id, doesn't animate. */
  const was = useRef(open);

  useLayoutEffect(() => {
    const panel = ref.current;
    if (was.current === open || !panel) return;
    was.current = open;
    // Turning around mid-way starts from where it is now, not from closed or open.
    const now = moving.current?.panel === panel ? { height: `${panel.offsetHeight}px`, opacity: getComputedStyle(panel).opacity } : null;
    moving.current?.animation.cancel();
    moving.current = null;
    // Clips only while it grows and shrinks (and leaves room for focus rings at its edges even then),
    // so shadows and rings inside show once it's open.
    const play = (keyframes: Keyframe[], options: KeyframeAnimationOptions, done: () => void) => {
      const animation = animate(panel, keyframes, options);
      if (!animation) return done();
      panel.style.overflow = "clip";
      moving.current = { panel, animation };
      animation.onfinish = done;
    };
    if (open) {
      panel.inert = false;
      play([now ?? { height: "0px", opacity: 0 }, { height: `${panel.scrollHeight}px`, opacity: 1 }], { duration: DURATION.base, easing: EASE.out }, () => {
        moving.current = null;
        panel.style.overflow = "";
      });
      return;
    }
    // Closing: focus inside goes back to the button, and Tab can't land in what's about to go.
    if (panel.contains(document.activeElement))
      [...document.querySelectorAll<HTMLElement>("[aria-controls]")].find((button) => button.getAttribute("aria-controls") === id)?.focus();
    panel.inert = true;
    play(
      [now ?? { height: `${panel.offsetHeight}px`, opacity: 1 }, { height: "0px", opacity: 0 }],
      // Holds closed until it's taken away, so it never flashes open for a frame.
      { duration: DURATION.quick, easing: EASE.standard, fill: "forwards" },
      () => setShown(false),
    );
  }, [open, id]);

  // Taken away mid-way (its screen went): stop, so nothing runs on a panel that's gone.
  useLayoutEffect(() => () => moving.current?.animation.cancel(), []);

  if (!shown) return null;
  return (
    <div ref={ref} id={id} className={cx("[overflow-clip-margin:4px]", className)}>
      {children}
    </div>
  );
}
