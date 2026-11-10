// @vitest-environment jsdom
// What waits for Beranda's first frame (mobile/src/shell/first-frame.ts): nothing of it is drawn or worked out in the
// render the splash waits for, all of it comes in the renders after, as a transition.

import { createRequire } from "node:module";
import path from "node:path";
import { afterEach, expect, it } from "vitest";
import { afterFirstFrame, firstFrameShown, markFirstFrameShown, resetFirstFrame, useFirstFrameShown } from "../../mobile/src/shell/first-frame";

// The phone's own React (mobile/node_modules), the one the module under test draws with: the root's is another copy.
const phone = createRequire(path.resolve(import.meta.dirname, "../../mobile/package.json"));
const { act, createElement } = phone("react") as typeof import("react");
const { createRoot } = phone("react-dom/client") as typeof import("react-dom/client");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => resetFirstFrame());

it("runs what waited, in order, once the first frame is up, and at once after", () => {
  const ran: string[] = [];
  afterFirstFrame(() => ran.push("badges"));
  const takenBack = afterFirstFrame(() => ran.push("gone"));
  afterFirstFrame(() => ran.push("home's lower parts"));
  takenBack();
  expect(ran).toEqual([]);
  expect(firstFrameShown()).toBe(false);
  markFirstFrameShown();
  markFirstFrameShown();
  expect(ran).toEqual(["badges", "home's lower parts"]);
  afterFirstFrame(() => ran.push("later"));
  expect(ran.at(-1)).toBe("later");
});

it("leaves a part out of the first frame's render and draws it in the next", async () => {
  const renders: boolean[] = [];
  function Part() {
    const up = useFirstFrameShown();
    renders.push(up);
    return up ? createElement("p", null, "below the fold") : null;
  }
  const root = createRoot(document.createElement("div"));
  await act(async () => root.render(createElement(Part)));
  expect(renders).toEqual([false]);
  await act(async () => markFirstFrameShown());
  expect(renders.at(-1)).toBe(true);
  await act(async () => root.unmount());
});
