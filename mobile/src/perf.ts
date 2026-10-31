// What the app feels like, in numbers the QA lab reads from logcat (mobile/qa, PROGRESS.md "FAST"):
//   [perf] js-block <ms> <label>   the JS thread was busy that long at once (over 50 ms), and what ran then
//   [perf] screen <route> <ms>      from the navigation to the screen drawn with its data
//   [perf] tab <name> <ms>          the same for a tab
//   [perf] first-data <ms>          from the JS start to Beranda drawn with the Student's data
// Cheap enough to stay on in every build: one timer every 50 ms, and a line only when something's slow
// or a screen opens.
import { useFocusEffect } from "expo-router";
import { useCallback, useEffect } from "react";

/** What's running, for a stall's label: the screen shown and the engine's last step. */
let screen = "start";
let doing = "";
let doingAt = 0;

/** The engine's last step ("six.status ok"), from its log: a stall right after it is likely its work. */
export function perfDoing(what: string): void {
  doing = what;
  doingAt = Date.now();
}

const STEP = 50;
let watching = false;

/** Starts watching the JS thread: a timer that should tick every 50 ms says how late it was. */
export function watchJsThread(): void {
  if (watching) return;
  watching = true;
  let last = Date.now();
  setInterval(() => {
    const now = Date.now();
    const late = now - last - STEP;
    last = now;
    if (late > STEP) {
      const recent = now - doingAt < late + 1_000 ? ` ${doing}` : "";
      console.log(`[perf] js-block ${late} ${screen}${recent}`);
    }
  }, STEP);
}

let leftAt = 0;

/** A navigation was dispatched (a tap on a tab, a row, Back): the clock for the next "screen" line starts. */
export function perfNavigating(): void {
  leftAt = Date.now();
}

/** The screen now shown (its route's name), for the lines that follow. */
export function perfShown(route: string): void {
  screen = route;
}

/**
 * The screen just navigated to is drawn with its data: one line, after the frame that shows it. `kind`: "tab" for a
 * bottom tab. Nothing when no navigation is waiting (data came in later on a screen already shown).
 */
export function perfDrawn(kind: "screen" | "tab" = "screen"): void {
  if (!leftAt) return;
  const from = leftAt;
  leftAt = 0;
  requestAnimationFrame(() => console.log(`[perf] ${kind} ${screen} ${Date.now() - from}`));
}

const jsStart = Date.now();
let firstData = false;

/** Beranda drew the Student's data for the first time in this run. */
export function perfFirstData(): void {
  if (firstData) return;
  firstData = true;
  requestAnimationFrame(() => console.log(`[perf] first-data ${Date.now() - jsStart}`));
}

/**
 * perfDrawn each time this screen comes into focus: a tab is mounted ahead and isn't drawn again on a switch, so the
 * switch's line is the frame after the tab shows.
 */
export function usePerfFocused(kind: "screen" | "tab" = "tab"): void {
  useFocusEffect(useCallback(() => perfDrawn(kind), [kind]));
}

/** perfDrawn once `ready` (the screen's data is in it), after the render that shows it. */
export function usePerfDrawn(ready: boolean, kind: "screen" | "tab" = "screen"): void {
  useEffect(() => {
    if (ready) perfDrawn(kind);
  });
}
