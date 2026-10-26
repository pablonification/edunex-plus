// The first run's scene changes (docs/design-system.md, Motion): from the
// welcome screen's promise to connecting, and from connecting to reading.
// Each is a view transition: the browser keeps a picture of the window as it
// was, React draws the next scene at once (flushSync), and what is named in
// both (the app's mark) glides from where it was to
// where it is now while the rest changes around it (styles.css,
// html[data-scene]). The browser moves pictures, so it stays smooth while the
// window is busy reading. With Reduce motion, with animations skipped (tests)
// or without the API, the next scene is just there.
import { flushSync } from "react-dom";
import { stillMotion } from "./animate";

export type Scene = "connect" | "reading";

/** What a scene change carries over, by view-transition-name: at most one element with each name per scene. */
export const CARRIED = { mark: "app-mark" } as const;

/** Goes to the next scene, which `update` draws. Resolves once it has landed. */
export function changeScene(scene: Scene, update: () => void): Promise<void> {
  if (stillMotion() || typeof document.startViewTransition !== "function") {
    update();
    return Promise.resolve();
  }
  const root = document.documentElement;
  root.dataset.scene = scene;
  const done = () => {
    if (root.dataset.scene === scene) delete root.dataset.scene;
  };
  const transition = document.startViewTransition(() => flushSync(update));
  // Skipped (another started, the window hid): the next scene is drawn all the same.
  transition.ready.catch(() => undefined);
  return transition.finished.then(done, done);
}
