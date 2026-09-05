import { describe, expect, it, vi } from "vitest";
import { buildTrayMenuTemplate } from "./tray-menu";

describe("buildTrayMenuTemplate", () => {
  it("carries Show and Quit around a separator, Quit last", () => {
    const handlers = { show: vi.fn(), quit: vi.fn() };
    const template = buildTrayMenuTemplate(handlers);

    expect(template).toHaveLength(3);
    expect(template[0]).toMatchObject({ label: "Show Edunex Plus" });
    expect(template[1]).toMatchObject({ type: "separator" });
    expect(template[2]).toMatchObject({ label: "Quit Edunex Plus" });
  });

  it("wires the click handlers through", () => {
    const handlers = { show: vi.fn(), quit: vi.fn() };
    const template = buildTrayMenuTemplate(handlers);

    (template[0].click as () => void)();
    (template[2].click as () => void)();

    expect(handlers.show).toHaveBeenCalledOnce();
    expect(handlers.quit).toHaveBeenCalledOnce();
  });
});
