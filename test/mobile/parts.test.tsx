// @vitest-environment jsdom
// A screen's first draw in parts (mobile/src/ui/parts.tsx): a tab drawn ahead out of sight commits its top, then what's
// under it, then the rest, each in a render of its own when the JS thread is idle, so no one commit holds the thread for
// the whole tab (106–162 ms each on a mid-range phone). Beranda's first frame holds only its top; the rest comes once the
// frame is up. A tab opened while its parts are still coming draws the rest at once.
import { createRequire } from "node:module";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { markFirstFrameShown, resetFirstFrame } from "../../mobile/src/shell/first-frame";
import { Part, PartsProvider, useParts } from "../../mobile/src/ui/parts";

// The phone's own React (mobile/node_modules), the one the module under test draws with: the root's is another copy.
const phone = createRequire(path.resolve(import.meta.dirname, "../../mobile/package.json"));
const { act, createElement } = phone("react") as typeof import("react");
// The elements themselves are plain objects any copy draws (JSX here is the root's).
const { createRoot } = phone("react-dom/client") as typeof import("react-dom/client");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => resetFirstFrame());

/** An idle callback the test runs by hand. */
function idleQueue() {
  const due: (() => void)[] = [];
  const idle = (run: () => void) => {
    due.push(run);
    return () => {
      const at = due.indexOf(run);
      if (at >= 0) due.splice(at, 1);
    };
  };
  return { idle, pending: () => due.length, runNext: () => due.shift()?.() };
}

function setup() {
  const { idle, pending, runNext } = idleQueue();
  const commits: string[][] = [];
  const said: number[] = [];
  const say = (part: number) => said.push(part);
  /** What the last render drew, by name. */
  let seen: string[] = [];
  const Mark = ({ name }: { name: string }) => {
    seen.push(name);
    return null;
  };
  function Screen({ focused }: { focused: boolean }) {
    const part = useParts({ drawn: true, focused, say, idle });
    seen = [];
    queueMicrotask(() => commits.push(seen));
    return (
      <PartsProvider part={part}>
        <Mark name="header" />
        <Part at={1}>
          <Mark name="list" />
        </Part>
        <Part at={2}>
          <Mark name="rest" />
        </Part>
      </PartsProvider>
    );
  }
  const root = createRoot(document.createElement("div"));
  const render = (focused: boolean) => act(async () => root.render(createElement(Screen, { focused })));
  return { render, root, pending, runNext, said, drawn: () => commits.at(-1) ?? [], commits };
}

it("draws a tab ahead out of sight a part at a time, each when idle", async () => {
  markFirstFrameShown();
  const s = setup();
  await s.render(false);
  expect(s.drawn()).toEqual(["header"]);
  expect(s.pending()).toBe(1);
  await act(async () => s.runNext());
  expect(s.drawn()).toEqual(["header", "list"]);
  await act(async () => s.runNext());
  expect(s.drawn()).toEqual(["header", "list", "rest"]);
  expect(s.pending()).toBe(0);
  expect(s.said).toEqual([1, 2]);
  await act(async () => s.root.unmount());
});

it("draws the rest at once when the tab is opened while its parts are coming", async () => {
  markFirstFrameShown();
  const s = setup();
  await s.render(false);
  expect(s.drawn()).toEqual(["header"]);
  await s.render(true);
  expect(s.drawn()).toEqual(["header", "list", "rest"]);
  await act(async () => s.root.unmount());
});

it("draws a tab opened in front whole", async () => {
  markFirstFrameShown();
  const s = setup();
  await s.render(true);
  expect(s.commits[0]).toEqual(["header", "list", "rest"]);
  expect(s.pending()).toBe(0);
  await act(async () => s.root.unmount());
});

it("holds only Beranda's top in the first frame, the next part once it's up, the last when idle", async () => {
  const s = setup();
  await s.render(true);
  expect(s.drawn()).toEqual(["header"]);
  // Nothing more until the frame is up, however idle the thread.
  expect(s.pending()).toBe(0);
  await act(async () => markFirstFrameShown());
  expect(s.drawn()).toEqual(["header", "list"]);
  await act(async () => s.runNext());
  expect(s.drawn()).toEqual(["header", "list", "rest"]);
  await act(async () => s.root.unmount());
});
