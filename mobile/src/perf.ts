// What the app feels like, in numbers the QA lab reads from logcat (mobile/qa, PROGRESS.md "FAST"):
//   [sync] +<ms> <what>             a demo build's sync: its requests, changed datasets, sources' states (W2)
//   [perf] js-block <ms> <label>   the JS thread was busy that long at once (over 50 ms), and what ran then
//   [perf] screen <route> <ms>      from the navigation to the screen drawn with its data
//   [perf] tab <name> <ms>          the same for a tab
//   [perf] first-data <ms>          from the JS start to Beranda drawn with the Student's data
//   [startup] steps …               the start's steps from the JS start (shell/boot.tsx): the load asked for, the
//                                   engine loaded, the store made, the first frame shown
// Cheap enough to stay on in every build: one timer every 50 ms, and a line only when something's slow
// or a screen opens.
import { useFocusEffect, useNavigation } from "expo-router";
import { useCallback, useEffect } from "react";
import { JS_START } from "./start";

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
/** What the waiting clock times: a tab switch (started by the tab's own press) or a screen opening. */
let kind: "screen" | "tab" = "screen";

/** A navigation was dispatched (a tap on a tab, a row, Back): the clock for the next "screen" line starts. */
export function perfNavigating(as: "screen" | "tab" = "screen"): void {
  leftAt = Date.now();
  kind = as;
}

/**
 * The screen now shown (its route's name), for the lines that follow. A new route with no navigation timed yet (Expo
 * Router's own pushes don't pass through the container's actions) starts the clock here, as the state changes.
 */
export function perfShown(route: string): void {
  if (route !== screen && !leftAt) perfNavigating();
  screen = route;
}

/**
 * The screen just navigated to is drawn: one line, after the frame that shows it, "tab" or "screen" as its clock
 * started. Nothing when no navigation is waiting (data came in later on a screen already shown).
 */
export function perfDrawn(): void {
  if (!leftAt) return;
  const from = leftAt;
  const what = kind;
  leftAt = 0;
  requestAnimationFrame(() => console.log(`[perf] ${what} ${screen} ${Date.now() - from}`));
}

const jsStart = JS_START;

/**
 * A demo build's sync, step by step, from the JS start: each request it sends (the pretend Edunex and SIX), each
 * dataset that changed and each source's state ("[sync] +1234 GET six.itb.ac.id/app/... 210ms"). How much a start
 * with saved data reads, and how long until it's done (W2). Never in the real app: no addresses in Android's log.
 */
export function perfSync(text: string): void {
  console.log(`[sync] +${Date.now() - jsStart} ${text}`);
}
let firstData = false;

/** Beranda drew the Student's data for the first time in this run. */
export function perfFirstData(): void {
  if (firstData) return;
  firstData = true;
  requestAnimationFrame(() => console.log(`[perf] first-data ${Date.now() - jsStart}`));
}

/**
 * A bottom tab's line: from the tab's press reaching JS (Android's bar has already switched to the tab, mounted ahead)
 * to the frame after the tab comes into focus. Native tabs don't pass through the navigation container's actions, so
 * the tab's own tabPress starts the clock.
 */
export function usePerfFocused(name: string): void {
  const navigation = useNavigation();
  useEffect(
    () =>
      navigation.addListener("tabPress" as never, () => {
        // A tap on the tab already open scrolls it to the top: no switch to time.
        if (navigation.isFocused()) return;
        perfNavigating("tab");
        perfShown(name);
      }),
    [navigation, name],
  );
  useFocusEffect(useCallback(() => perfDrawn(), []));
}

/**
 * perfDrawn once `ready` (the screen's data is in it), after the render that shows it. Only the screen in front ends
 * the clock: a tab mounted out of sight drawing again (the one just left, say) never answers for the one opened, which
 * made Kuliah's and Akademik's switches come out as "screen" lines or not at all.
 */
export function usePerfDrawn(ready: boolean): void {
  const navigation = useNavigation();
  useEffect(() => {
    if (ready && navigation.isFocused()) perfDrawn();
  });
}
