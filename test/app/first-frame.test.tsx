// @vitest-environment jsdom
// The window's first frame (src/app/main.tsx): on first run the welcome
// screen's code is in before the window draws, so the Student never sees an
// empty window while it loads. Its own file: no other test has loaded it yet.
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it } from "vitest";
import { App, firstScreenLoaded } from "../../src/app/app";
import { createBridge } from "../../src/app/bridge";
import { AppStore } from "../../src/app/store";
import { DEFAULT_SETTINGS } from "../../src/core/models/base";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let unmount: (() => void) | null = null;
afterEach(() => {
  unmount?.();
  unmount = null;
  document.body.replaceChildren();
});

it("shows the welcome screen in the first frame on first run", async () => {
  // Nobody signed in, nothing saved.
  const store = new AppStore({ version: "0.0.0", datasets: [], statuses: [], settings: DEFAULT_SETTINGS, platform: "darwin", vault: "encrypted" });
  const bridge = createBridge({ invoke: () => new Promise(() => {}), onEvent: () => () => {} });

  await firstScreenLoaded(store);
  const container = document.body.appendChild(document.createElement("div"));
  const root = createRoot(container);
  // Not awaited: the first frame, before anything else could load.
  act(() => root.render(<App store={store} bridge={bridge} />));
  unmount = () => act(() => root.unmount());
  expect(container.textContent).toContain("Selamat datang di Edunex Plus");
});
