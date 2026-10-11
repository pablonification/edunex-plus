// Start-up, t3code-style: listen for engine events first, ask for the saved
// snapshot (never waits on the network), draw it, then tell the main process
// the first frame is on screen so it can show the window.
import { createRoot } from "react-dom/client";
import type { Event } from "../core/contract";
import { App } from "./app";
import { createBridge } from "./bridge";
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

  createRoot(root).render(<App store={store} bridge={bridge} />);
  // Two frames: React has committed and the browser has painted.
  requestAnimationFrame(() => requestAnimationFrame(() => void bridge.invoke("app.ready", {}).catch(() => undefined)));
}

void start(document.getElementById("root")!);
