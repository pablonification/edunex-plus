// @vitest-environment jsdom
// The course page's first tab (mobile/src/screens/course/tab-order.ts): a course at risk leads with Pertemuan, but the
// order is picked once a visit. Attendance read late, or a count changing while the Student reads Modul, never moves
// the page to Pertemuan under them.
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

it("leads with Pertemuan for a course at risk once its attendance is read", async () => {
  const page = await visit();
  await page.show("KU5014", undefined, false);
  await page.show("KU5014", "out", true);
  expect(page.first()).toBe("meetings");
  await page.done();
});

it("keeps Modul for the visit when the count turns the course at risk after the page was drawn", async () => {
  const page = await visit();
  await page.show("DK4073", "safe", true);
  expect(page.first()).toBe("modules");
  await page.show("DK4073", "risk", true);
  expect(page.first()).toBe("modules");
  // Another course is another visit.
  await page.show("KU5014", "out", true);
  expect(page.first()).toBe("meetings");
  await page.done();
});
