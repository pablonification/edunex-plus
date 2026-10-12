// jsdom has no element.animate, so the kit's JS animation would always jump to
// its end there. This stands in for it, so a test can watch an animation run:
// each one is recorded with its keyframes and options, and stays running until
// the test ends it (never by waiting), as the browser would once its time is up.
import { act } from "react";
import { vi } from "vitest";
import { skipAnimations } from "../../src/app/ui/motion/animate";

export class FakeAnimation {
  playState: AnimationPlayState = "running";
  onfinish: (() => void) | null = null;
  constructor(
    readonly target: Element,
    readonly keyframes: Keyframe[],
    readonly options: KeyframeAnimationOptions,
  ) {}
  finish() {
    if (this.playState !== "running") return;
    this.playState = "finished";
    this.onfinish?.();
  }
  cancel() {
    this.playState = "idle";
  }
  /** The properties it moves. */
  get moves() {
    return [...new Set(this.keyframes.flatMap((frame) => Object.keys(frame)))].filter((key) => key !== "offset" && key !== "easing").sort();
  }
}

/** Turns JS animation on, run by the fake. Call `stop` after the test. */
export function playAnimations() {
  const started: FakeAnimation[] = [];
  Element.prototype.animate = function (this: Element, keyframes, options) {
    const animation = new FakeAnimation(this, keyframes as Keyframe[], options as KeyframeAnimationOptions);
    started.push(animation);
    return animation as unknown as Animation;
  };
  skipAnimations(false);
  return {
    started,
    running: () => started.filter((animation) => animation.playState === "running"),
    on: (element: Element) => started.filter((animation) => animation.target === element),
    /** Ends every running animation. */
    finishAll: () =>
      act(async () => {
        for (const animation of started) animation.finish();
      }),
    stop: () => {
      delete (Element.prototype as { animate?: unknown }).animate;
      skipAnimations(true);
    },
  };
}

/**
 * jsdom runs no CSS, so Radix drops a closing panel at once. Here every panel reports the
 * animation its classes give its state (data-[state=closed]:animate-pop-out → "pop-out"), as
 * Chromium does, so a closing one stays on screen until its animation ends, as in the window.
 * Undo with `vi.restoreAllMocks()`.
 */
export function playCssAnimations() {
  const real = window.getComputedStyle.bind(window);
  const animationName = (element: HTMLElement) =>
    element.getAttribute("class")?.match(new RegExp(`data-\\[state=${element.dataset.state}\\]:animate-([\\w-]+)`))?.[1] ?? "none";
  vi.spyOn(window, "getComputedStyle").mockImplementation((element, pseudo) => {
    const style = real(element, pseudo);
    if (!(element instanceof HTMLElement) || !element.dataset.state) return style;
    return new Proxy(style, {
      get: (target, key) => {
        if (key === "animationName") return animationName(element);
        const value = Reflect.get(target, key, target);
        return typeof value === "function" ? value.bind(target) : value;
      },
    });
  });
  globalThis.CSS ??= { escape: (text: string) => text } as typeof CSS;
}

/** Ends a closing panel's animation, as the browser does once its time is up. */
export const finishLeaving = (element: Element) =>
  act(async () => {
    element.dispatchEvent(Object.assign(new Event("animationend"), { animationName: "pop-out" }));
  });
