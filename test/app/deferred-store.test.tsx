// @vitest-environment jsdom
// The phone's screens read the store through a deferred view (src/app/store.tsx deferredStore, src/app/external.ts):
// a dataset read in the background reaches them as a transition, drawn a part at a time with the thread let go in
// between, never as one redraw that holds it. The window's own store still redraws at once.
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { createBridge } from "../../src/app/bridge";
import { ClockProvider, type UiClock, useNow } from "../../src/app/i18n";
import { AppStore, deferredStore, StoreProvider, useDataset } from "../../src/app/store";
import { DEFAULT_SETTINGS } from "../../src/core/models/base";

let unmount: (() => void) | null = null;
afterEach(() => {
  unmount?.();
  unmount = null;
  document.body.replaceChildren();
});

const settled = () => new Promise((resolve) => setTimeout(resolve, 30));

function storeWith(name: string) {
  return new AppStore({
    version: "0.0.0",
    datasets: [{ name: "edunex.account", value: { nim: "18223901", name }, fetchedAt: 0, hash: name }],
    statuses: [],
    settings: DEFAULT_SETTINGS,
    platform: "darwin",
    vault: "encrypted",
    update: { blocked: null, step: "idle", version: null, progress: null, problem: null },
  });
}

const renamed = (name: string) => ({ type: "dataset", dataset: { name: "edunex.account", value: { nim: "18223901", name }, fetchedAt: 1, hash: name } }) as const;

function Name() {
  return <p>{useDataset("edunex.account")?.name}</p>;
}

function Minute() {
  return <p>{useNow()}</p>;
}

async function draw(node: React.ReactNode): Promise<HTMLElement> {
  const container = document.body.appendChild(document.createElement("div"));
  const root = createRoot(container);
  flushSync(() => root.render(node));
  unmount = () => root.unmount();
  await settled();
  return container;
}

const bridge = createBridge({ invoke: () => new Promise(() => {}), onEvent: () => () => {} });

describe("a deferred view of the store", () => {
  it("hands a new dataset over as a transition; the window's store redraws at once", async () => {
    const store = storeWith("Dimas");
    const live = await draw(
      <StoreProvider store={store} bridge={bridge}>
        <Name />
      </StoreProvider>,
    );
    const later = await draw(
      <StoreProvider store={deferredStore(store)} bridge={bridge}>
        <Name />
      </StoreProvider>,
    );
    expect(live.textContent).toBe("Dimas");
    expect(later.textContent).toBe("Dimas");
    // flushSync draws every update waiting at once; a transition isn't one of them.
    flushSync(() => store.apply(renamed("Dimas Pratama")));
    expect(live.textContent).toBe("Dimas Pratama");
    expect(later.textContent).toBe("Dimas");
    await settled();
    expect(later.textContent).toBe("Dimas Pratama");
  });

  it("takes the clock's ticks the same way, when the clock is deferred", async () => {
    let now = 60_000;
    const listeners = new Set<() => void>();
    const clock: UiClock = {
      deferred: true,
      now: () => now,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };
    const shown = await draw(
      <ClockProvider clock={clock}>
        <Minute />
      </ClockProvider>,
    );
    expect(shown.textContent).toBe("60000");
    flushSync(() => {
      now = 120_000;
      for (const listener of listeners) listener();
    });
    expect(shown.textContent).toBe("60000");
    await settled();
    expect(shown.textContent).toBe("120000");
  });

  it("hears of a change made between its first draw and its subscription", async () => {
    const store = storeWith("Dimas");
    const view = deferredStore(store);
    const container = document.body.appendChild(document.createElement("div"));
    const root = createRoot(container);
    flushSync(() =>
      root.render(
        <StoreProvider store={view} bridge={bridge}>
          <Name />
        </StoreProvider>,
      ),
    );
    unmount = () => root.unmount();
    store.apply(renamed("Dimas Pratama"));
    await settled();
    expect(container.textContent).toBe("Dimas Pratama");
  });
});
