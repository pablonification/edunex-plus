// A highlight that glides to the picked item of a group (a segmented control,
// a tab list) instead of jumping, so the eye follows the choice.
//
// Ported from motion-primitives' Animated Background
// (github.com/ibelick/motion-primitives, MIT, © 2024 ibelick), reworked for
// this kit: it doesn't wrap or clone the items (the original replaced each
// child's own onClick with its own), so the group keeps its own buttons, roles
// and arrow keys; and instead of a shared layoutId it measures the picked item,
// sits there at once, and plays the glide from the last pick as a transform
// (the Web Animations API, 150 ms): nothing is laid out again while it moves.
//
// Use: make the group `relative`, render <SlidingHighlight active={value} />
// inside it, and mark each item `data-highlight={its value}` and `relative`
// (so it paints above the highlight).
import { useLayoutEffect, useRef } from "react";
import { cx } from "../cx";
import { animate } from "./animate";
import { DURATION, EASE } from "./tokens";

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

const same = (a: Box | null, b: Box | null) => a?.x === b?.x && a?.y === b?.y && a?.width === b?.width && a?.height === b?.height;

export function SlidingHighlight({
  active,
  shape = "fill",
  className,
}: {
  /** The picked item's data-highlight value; null hides the highlight. */
  active: string | null;
  /** fill covers the item (a segmented control); underline runs under it (tabs), its thickness from className. */
  shape?: "fill" | "underline";
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const placed = useRef<{ active: string | null; box: Box | null }>({ active: null, box: null });
  const gliding = useRef<Animation | null>(null);

  useLayoutEffect(() => {
    const highlight = ref.current;
    const group = highlight?.parentElement;
    if (!highlight || !group) return;
    const measure = (): Box | null => {
      const item = [...group.querySelectorAll<HTMLElement>("[data-highlight]")].find((el) => el.dataset.highlight === active);
      return item ? { x: item.offsetLeft, y: item.offsetTop, width: item.offsetWidth, height: item.offsetHeight } : null;
    };
    // Its size and place are set here, not by React, so a glide can start from the old ones in the same frame.
    const place = (box: Box | null) => {
      highlight.hidden = box === null;
      if (!box) return;
      highlight.style.translate = shape === "fill" ? `${box.x}px ${box.y}px` : `${box.x}px 0`;
      highlight.style.width = `${box.width}px`;
      highlight.style.height = shape === "fill" ? `${box.height}px` : "";
    };
    // Where it shows now: mid-glide if a pick came quickly after the last one.
    const shownAt = (): Box | null => {
      if (gliding.current?.playState !== "running") return placed.current.box;
      const seen = highlight.getBoundingClientRect();
      const frame = group.getBoundingClientRect();
      if (seen.width === 0) return placed.current.box;
      return {
        x: seen.left - frame.left - group.clientLeft + group.scrollLeft,
        y: seen.top - frame.top - group.clientTop + group.scrollTop,
        width: seen.width,
        height: seen.height,
      };
    };

    // Only a new pick glides; the first placement jumps into place.
    const box = measure();
    const from = placed.current.box !== null && placed.current.active !== active ? shownAt() : null;
    gliding.current?.cancel();
    gliding.current = null;
    place(box);
    placed.current = { active, box };
    if (from && box && box.width > 0 && box.height > 0) {
      const dx = from.x - box.x;
      const dy = shape === "fill" ? from.y - box.y : 0;
      const sx = from.width / box.width;
      const sy = shape === "fill" ? from.height / box.height : 1;
      gliding.current = animate(highlight, [{ transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` }, { transform: "none" }], {
        duration: DURATION.quick,
        easing: EASE.out,
      });
    }

    // A resize or another language moves the items: follow them at once, without gliding.
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const moved = measure();
      if (same(moved, placed.current.box)) return;
      gliding.current?.cancel();
      gliding.current = null;
      place(moved);
      placed.current = { active, box: moved };
    });
    observer.observe(group);
    for (const item of group.querySelectorAll("[data-highlight]")) observer.observe(item);
    return () => observer.disconnect();
  }, [active, shape]);

  // Taken away mid-glide: stop, so nothing runs on an element that's gone.
  useLayoutEffect(() => () => gliding.current?.cancel(), []);

  return (
    <span ref={ref} aria-hidden className={cx("pointer-events-none absolute left-0 origin-top-left", shape === "fill" ? "top-0" : "bottom-0", className)} />
  );
}
