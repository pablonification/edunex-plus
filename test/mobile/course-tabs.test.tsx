// @vitest-environment jsdom
// The course page's first tab (mobile/src/screens/course/tab-order.ts): Modul for every course, at risk or not (the
// header's meter carries attendance), and the order is picked once a visit, so a count arriving late never moves it.
import { createRequire } from "node:module";
import path from "node:path";
import { expect, it } from "vitest";
import { type Tab, useVisitTabs } from "../../mobile/src/screens/course/tab-order";
import type { AttendanceState } from "../../src/core/attendance";

const phone = createRequire(path.resolve(import.meta.dirname, "../../mobile/package.json"));
const { act, createElement } = phone("react") as typeof import("react");
const { createRoot } = phone("react-dom/client") as typeof import("react-dom/client");
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function visit() {
  const firsts: Tab[] = [];
  function Probe({ code, state, ready }: { code: string; state?: AttendanceState; ready: boolean }) {
    firsts.push(useVisitTabs(code, state, ready)[0]!);
    return null;
  }
  const root = createRoot(document.createElement("div"));
  const show = (code: string, state: AttendanceState | undefined, ready: boolean) => act(async () => root.render(createElement(Probe, { code, state, ready })));
  return { show, first: () => firsts.at(-1), done: () => act(async () => root.unmount()) };
}

it("leads with Modul even for a course at risk, so its material is three taps away", async () => {
  const page = await visit();
  await page.show("KU5014", undefined, false);
  await page.show("KU5014", "out", true);
  expect(page.first()).toBe("modules");
  await page.done();
});

it("keeps Modul for the visit when the count turns the course at risk after the page was drawn", async () => {
  const page = await visit();
  await page.show("DK4073", "safe", true);
  expect(page.first()).toBe("modules");
  await page.show("DK4073", "risk", true);
  expect(page.first()).toBe("modules");
  // Another course is another visit, and leads with Modul too.
  await page.show("KU5014", "out", true);
  expect(page.first()).toBe("modules");
  await page.done();
});
