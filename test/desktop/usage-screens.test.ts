// Usage data's screens on the desktop (ADR 0016): the window is made hidden and shown once its page has drawn, or stays
// in the tray after an update. A screen drawn while nobody looks counts once the window shows, not before, and once.
import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ app: { on: () => undefined }, shell: {} }));
const { coreHandlers } = await import("../../src/desktop/handlers/core");
type Context = Parameters<typeof coreHandlers>[0];

function start() {
  const counted: string[] = [];
  const window = Object.assign(new EventEmitter(), { visible: false, isVisible: () => window.visible });
  const handlers = coreHandlers({
    engine: { countUsage: (_kind: string, name: string) => void counted.push(name) },
    window: () => window,
  } as unknown as Context);
  const show = () => {
    window.visible = true;
    window.emit("show");
  };
  return { counted, window, handlers, show };
}

describe("a screen in usage data, on the desktop", () => {
  it("drawn before the window shows (every launch) counts when it shows, once", async () => {
    const { counted, handlers, show, window } = start();
    await handlers["usage.screen"]({ screen: "home" });
    expect(counted).toEqual([]);
    show();
    expect(counted).toEqual(["home"]);
    window.emit("show");
    expect(counted).toEqual(["home"]);
  });

  it("counts the last one drawn while hidden (moved in the tray), and every one drawn while shown", async () => {
    const { counted, handlers, show } = start();
    await handlers["usage.screen"]({ screen: "home" });
    await handlers["usage.screen"]({ screen: "tasks" });
    show();
    await handlers["usage.screen"]({ screen: "schedule" });
    expect(counted).toEqual(["tasks", "schedule"]);
  });

  it("counts nothing for a window that never shows (started in the tray after an update)", async () => {
    const { counted, handlers } = start();
    await handlers["usage.screen"]({ screen: "home" });
    expect(counted).toEqual([]);
  });
});
