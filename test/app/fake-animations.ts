// jsdom has no element.animate, so the kit's JS animation would always jump to
// its end there. This stands in for it, so a test can watch an animation run:
// each one is recorded with its keyframes and options, and stays running until
// the test ends it (never by waiting), as the browser would once its time is up.
import { act } from "react";
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
