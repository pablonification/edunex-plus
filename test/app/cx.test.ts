// cx() lets a later class win over an earlier one of the same kind. That only
// works for the app's own tokens (shadow-card, animate-pop-in, rounded-tag…)
// when tailwind-merge knows them; otherwise both classes stay and the CSS
// order, not the component's caller, decides which one shows.
import { describe, expect, it } from "vitest";
import { cx } from "../../src/app/ui/cx";

describe("cx", () => {
  it.each([
    ["shadow-card", "shadow-lift"],
    ["shadow-raised", "shadow-pop"],
    ["shadow-button", "shadow-card"],
    ["animate-pop-in", "animate-popover-in"],
    ["animate-slide-down", "animate-fade-in"],
    ["animate-pop-in", "animate-shimmer"],
    ["ease-standard", "ease-out"],
    ["data-[state=open]:animate-pop-in", "data-[state=open]:animate-popover-in"],
    ["data-[state=closed]:animate-fade-out", "data-[state=closed]:animate-pop-out"],
    ["rounded-tag", "rounded-full"],
    ["rounded-xl", "rounded-tag"],
    ["text-small", "text-figure"],
    ["z-50", "z-(--z-dialog)"],
    ["z-(--z-popover)", "z-(--z-tooltip)"],
  ])("%s gives way to %s", (first, later) => {
    expect(cx(first, later)).toBe(later);
  });

  it("keeps a color and a size of the same family", () => {
    expect(cx("text-muted", "text-small")).toBe("text-muted text-small");
    expect(cx("shadow-card", "shadow-black/10")).toBe("shadow-card shadow-black/10");
  });

  it("drops empty parts", () => {
    expect(cx("a", false, null, undefined, "", "b")).toBe("a b");
  });
});
