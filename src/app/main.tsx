// Start-up, t3code-style: listen for engine events first, ask for the saved
// snapshot (never waits on the network), draw it, then tell the main process
// the first frame is on screen so it can show the window. The other screens
// load after that, while the window is idle (./later.tsx).
import { createRoot } from "react-dom/client";
import type { Event } from "../core/contract";
import { App, firstScreenLoaded } from "./app";
import { createBridge } from "./bridge";
import { systemClock } from "./i18n";
import { preloadWhenIdle } from "./later";
import { AppStore } from "./store";
import "./styles.css";

async function start(root: HTMLElement) {
  const api = window.edunexPlus;
  if (!api) {
    root.textContent = "Edunex Plus runs inside its desktop app.";
    return;
  }
  const bridge = createBridge(api);
  let store: AppStore | null = null;
  const early: Event[] = [];
  bridge.onEvent((event) => (store ? store.apply(event) : early.push(event)));

  const snapshot = await bridge.invoke("app.snapshot", {});
  store = new AppStore(snapshot);
  for (const event of early) store.apply(event);

  await firstScreenLoaded(store).catch(() => undefined);
  createRoot(root).render(<App store={store} bridge={bridge} clock={api.clockOffset ? systemClock(api.clockOffset) : undefined} />);
  // Two frames: React has committed and the browser has painted.
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      void bridge.invoke("app.ready", {}).catch(() => undefined);
      void preloadWhenIdle();
    }),
  );
}

// Light and dark switch at once: without this, every color on screen would fade over 150 ms.
const scheme = window.matchMedia?.("(prefers-color-scheme: dark)");
scheme?.addEventListener("change", () => {
  const html = document.documentElement;
  html.classList.add("no-transitions");
  requestAnimationFrame(() => requestAnimationFrame(() => html.classList.remove("no-transitions")));
});

void start(document.getElementById("root")!);
