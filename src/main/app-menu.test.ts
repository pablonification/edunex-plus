import { describe, expect, it, vi } from "vitest";
import { buildAppMenuTemplate } from "./app-menu";
import { NAV_VIEWS } from "./nav-views";

describe("buildAppMenuTemplate", () => {
  const handlers = { gotoView: vi.fn() };
  const template = buildAppMenuTemplate("Edunex Plus", NAV_VIEWS, handlers);

  it("opens with a named app menu on macOS (not Electron's default)", () => {
    const labels = template.map((item) => ("label" in item ? item.label : undefined));
    expect(labels[0]).toBe("Edunex Plus");
    const appSubmenu = template[0].submenu as { label: string }[];
    expect(appSubmenu.some((item) => item.label === "Quit Edunex Plus")).toBe(true);
  });

  it("maps ⌘1–6 to the shell views in order", () => {
    const viewMenu = template.find((item) => "label" in item && item.label === "View");
    const submenu = viewMenu!.submenu as { label?: string; accelerator?: string }[];
    const navItems = submenu.filter((item) => item.accelerator?.startsWith("CmdOrCtrl+"));

    expect(navItems).toHaveLength(NAV_VIEWS.length);
    navItems.forEach((item, index) => {
      expect(item.label).toBe(NAV_VIEWS[index].label);
      expect(item.accelerator).toBe(`CmdOrCtrl+${index + 1}`);
    });
  });

  it("wires ⌘1–6 through gotoView", () => {
    handlers.gotoView.mockClear();
    const viewMenu = template.find((item) => "label" in item && item.label === "View");
    const submenu = viewMenu!.submenu as { click?: () => void }[];
    submenu[0].click!();

    expect(handlers.gotoView).toHaveBeenCalledWith(NAV_VIEWS[0].key);
  });

  it("keeps the standard Edit menu (copy/paste) and Window menu roles", () => {
    const roles = template.map((item) => item.role);
    expect(roles).toContain("editMenu");
    expect(roles).toContain("windowMenu");
  });
});
