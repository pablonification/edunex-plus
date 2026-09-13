import { describe, expect, it } from "vitest";
import { ensureBrowserPreviewBridge } from "./bootstrap";

describe("renderer browser bootstrap", () => {
  it("installs a usable preview bridge when Electron preload is absent", async () => {
    const target: { edunex?: Window["edunex"] } = {};

    expect(ensureBrowserPreviewBridge(target, true)).toBe(true);
    expect(target.edunex?.platform).toBe("browser");
    await expect(target.edunex?.getAuthState()).resolves.toBe("signed-in");
  });

  it("does not replace the real bridge or install outside development", () => {
    const existing = { platform: "darwin" } as Window["edunex"];
    const withExisting: { edunex?: Window["edunex"] } = { edunex: existing };
    const missing: { edunex?: Window["edunex"] } = {};

    expect(ensureBrowserPreviewBridge(withExisting, true)).toBe(false);
    expect(withExisting.edunex).toBe(existing);
    expect(ensureBrowserPreviewBridge(missing, false)).toBe(false);
    expect(missing.edunex).toBeUndefined();
  });
});
