// Main's own guard on the two ways the window opens a page in the browser:
// the app's links go only to official pages; a lecturer's link may go to any
// web page, but never another scheme or an address hiding a name or password.
// The test bridge copies these rules; this runs the real handlers.
import { beforeEach, describe, expect, it, vi } from "vitest";

const opened: string[] = [];
vi.mock("electron", () => ({
  app: {},
  shell: {
    openExternal: async (url: string) => {
      opened.push(url);
    },
  },
}));

const { coreHandlers } = await import("../../src/desktop/handlers/core");
type Context = Parameters<typeof coreHandlers>[0];
const handlers = coreHandlers({} as Context);

beforeEach(() => {
  opened.length = 0;
});

describe("opening pages in the browser", () => {
  it("a lecturer's link opens any web page, and nothing else", async () => {
    await handlers["shell.openLink"]({ url: "https://docs.google.com/spreadsheets/d/fixture/edit" });
    await handlers["shell.openLink"]({ url: "http://example.org/" });
    for (const url of [
      "javascript:alert(1)",
      "file:///etc/passwd",
      "mailto:a@example.com",
      "app://edunex-plus/index.html",
      "https://name:secret@evil.example.com/",
    ])
      await expect(handlers["shell.openLink"]({ url })).rejects.toMatchObject({ kind: "Rejected" });
    expect(opened).toEqual(["https://docs.google.com/spreadsheets/d/fixture/edit", "http://example.org/"]);
  });

  it("the app's own links open official pages only", async () => {
    await handlers["shell.openExternal"]({ url: "https://edunex.itb.ac.id/courses/1" });
    await expect(handlers["shell.openExternal"]({ url: "https://docs.google.com/x" })).rejects.toMatchObject({ kind: "Rejected" });
    expect(opened).toEqual(["https://edunex.itb.ac.id/courses/1"]);
  });

  it("a problem report opens a new issue on the app's repository, and nothing near it", async () => {
    const issue = "https://github.com/pablonification/edunex-plus/issues/new?template=six-drift.yml&title=SIX";
    await handlers["shell.openExternal"]({ url: issue });
    for (const url of [
      "https://github.com/pablonification/edunex-plus",
      "https://github.com/pablonification/edunex-plus/issues/1",
      "https://github.com/pablonification/other/issues/new",
      "https://github.com/pablonification/edunex-plus/issues/new/choose",
      // A name and password in front of the address (joined here, so the repository's privacy test doesn't read it as an email).
      ["https://name:secret", "github.com/pablonification/edunex-plus/issues/new"].join("@"),
      "https://gist.github.com/pablonification/edunex-plus/issues/new",
      "http://github.com/pablonification/edunex-plus/issues/new",
      "https://github.com/pablonification/edunex-plus/issues/new#x",
      // The maintainer's LINE is shown as a QR code, never opened.
      "https://line.me/ti/p/~arqilasp12",
    ])
      await expect(handlers["shell.openExternal"]({ url })).rejects.toMatchObject({ kind: "Rejected" });
    expect(opened).toEqual([issue]);
  });
});
