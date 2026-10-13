// @vitest-environment jsdom
// Screens that load after the first one (src/app/later.tsx): going to one
// whose code is still loading keeps the screen before it up (never a blank
// frame) until it can draw; once loaded it draws at once; a failed load shows
// in the screen's guard, and "Coba lagi" there loads it again. A closed dialog
// loads nothing until it is opened or preloaded.
import { act, Component, type ReactNode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { type Later, later } from "../../src/app/later";
import { NavProvider, useNav } from "../../src/app/nav";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let unmount: (() => void) | null = null;
afterEach(() => {
  unmount?.();
  unmount = null;
  document.body.replaceChildren();
});

/** A screen's code, arriving when the test says so. */
function slowScreen(text: string) {
  let arrive = () => {};
  let fail = (_: Error) => {};
  let loads = 0;
  const Screen = later(() => {
    loads += 1;
    return new Promise<() => ReactNode>((resolve, reject) => {
      arrive = () => resolve(() => <p>{text}</p>);
      fail = reject;
    });
  });
  return { Screen, arrive: () => arrive(), fail: (error: Error) => fail(error), loads: () => loads };
}

class Guard extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <button type="button" onClick={() => this.setState({ failed: false })}>
        Coba lagi
      </button>
    );
  }
}

/** The shell's shape: a fallback that must never show, around the screen's own guard, keyed by the route. */
function Window({ later: Later }: { later: Later<object> }) {
  const { route, go } = useNav();
  return (
    <>
      <button type="button" onClick={() => go({ screen: "grades" })}>
        Nilai
      </button>
      <Suspense fallback={<p>Blank</p>}>
        <Guard key={route.screen}>{route.screen === "home" ? <p>Beranda</p> : <Later />}</Guard>
      </Suspense>
    </>
  );
}

async function mount(node: ReactNode) {
  const container = document.body.appendChild(document.createElement("div"));
  const root = createRoot(container);
  await act(async () => root.render(node));
  unmount = () => act(() => root.unmount());
  return container;
}

const press = (container: HTMLElement, name: string) =>
  act(async () => [...container.querySelectorAll("button")].find((button) => button.textContent === name)!.click());

describe("screens that load later", () => {
  it("keeps the screen before up while the next one's code loads, then shows it", async () => {
    const grades = slowScreen("Nilai kamu");
    const app = await mount(
      <NavProvider drawsAtOnce={(route) => route.screen === "home" || grades.Screen.loaded()}>
        <Window later={grades.Screen} />
      </NavProvider>,
    );
    await press(app, "Nilai");
    expect(app.textContent).toContain("Beranda");
    expect(app.textContent).not.toContain("Blank");

    await act(async () => grades.arrive());
    expect(app.textContent).toContain("Nilai kamu");
    expect(app.textContent).not.toContain("Beranda");
  });

  it("draws at once once its code is in", async () => {
    const grades = slowScreen("Nilai kamu");
    const loaded = grades.Screen.preload();
    grades.arrive();
    await loaded;
    const container = document.body.appendChild(document.createElement("div"));
    const root = createRoot(container);
    // Not awaited: nothing is left to wait for.
    act(() => root.render(<grades.Screen />));
    unmount = () => act(() => root.unmount());
    expect(container.textContent).toBe("Nilai kamu");
  });

  it("shows a failed load in the screen's guard, and loads it again on Coba lagi", async () => {
    const grades = slowScreen("Nilai kamu");
    const app = await mount(
      <NavProvider drawsAtOnce={(route) => route.screen === "home" || grades.Screen.loaded()}>
        <Window later={grades.Screen} />
      </NavProvider>,
    );
    await press(app, "Nilai");
    await act(async () => grades.fail(new Error("chunk missing")));
    expect(app.textContent).toContain("Coba lagi");
    expect(grades.loads()).toBe(1);

    await press(app, "Coba lagi");
    expect(grades.loads()).toBe(2);
    await act(async () => grades.arrive());
    expect(app.textContent).toContain("Nilai kamu");
  });

  it("loads a closed dialog only once asked, and draws it as its code arrives", async () => {
    const settings = slowScreen("Pengaturan");
    function Host() {
      const loaded = settings.Screen.useLoaded();
      return <Suspense fallback={null}>{loaded && <settings.Screen />}</Suspense>;
    }
    const app = await mount(<Host />);
    expect(settings.loads()).toBe(0);

    const loaded = settings.Screen.preload();
    await act(async () => {
      settings.arrive();
      await loaded;
    });
    expect(app.textContent).toBe("Pengaturan");
  });
});
