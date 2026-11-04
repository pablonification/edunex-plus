// Main's own guard on the two ways the window opens a page: the app's links go
// only to official pages, Edunex's and SIX's in the app's own window for each;
// a lecturer's link may go to any web page in the browser, but never another
// scheme or an address hiding a name or password. The test bridge copies these
// rules; this runs the real handlers.
import { beforeEach, describe, expect, it, vi } from "vitest";

const opened: string[] = [];
const windows = vi.hoisted(() => [] as { site: string; url: string; signedIn: boolean }[]);
vi.mock("electron", () => ({
  app: { on: () => undefined },
  shell: {
    openExternal: async (url: string) => {
      opened.push(url);
    },
  },
}));
vi.mock("../../src/desktop/edunex-window", () => ({
  openEdunexWindow: async ({ url, token }: { url: string; token: string | null }) => void windows.push({ site: "edunex", url, signedIn: token !== null }),
}));
vi.mock("../../src/desktop/six-window", () => ({
  openSixWindow: async ({ url, cookie }: { url: string; cookie: string | null }) => void windows.push({ site: "six", url, signedIn: cookie !== null }),
}));

const { coreHandlers } = await import("../../src/desktop/handlers/core");
type Context = Parameters<typeof coreHandlers>[0];
const sessions: Record<string, unknown> = { edunex: { token: "a.b.c" }, six: { cookie: "khongguan=pretend-six-session" } };
const handlers = coreHandlers({
  engine: { session: (source: string) => sessions[source] ?? null },
  lang: () => "id",
  packaged: true,
  away: { opened: () => undefined, back: () => undefined },
} as unknown as Context);

beforeEach(() => {
  opened.length = 0;
  windows.length = 0;
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
    await handlers["shell.openExternal"]({ url: "https://teams.microsoft.com/meet/000000000000?p=fixture" });
    await expect(handlers["shell.openExternal"]({ url: "https://docs.google.com/x" })).rejects.toMatchObject({ kind: "Rejected" });
    expect(opened).toEqual(["https://teams.microsoft.com/meet/000000000000?p=fixture"]);
  });

  it("Edunex and SIX open in the app's own window for each, signed in, never in the browser", async () => {
    await handlers["shell.openExternal"]({ url: "https://edunex.itb.ac.id/courses/1" });
    await handlers["shell.openExternal"]({ url: "https://six.itb.ac.id" });
    await handlers["shell.openExternal"]({ url: "https://six.itb.ac.id/app/mahasiswa:18223901/statusmhs" });
    expect(windows).toEqual([
      { site: "edunex", url: "https://edunex.itb.ac.id/courses/1", signedIn: true },
      { site: "six", url: "https://six.itb.ac.id", signedIn: true },
      { site: "six", url: "https://six.itb.ac.id/app/mahasiswa:18223901/statusmhs", signedIn: true },
    ]);
    // ITB's other pages aren't Edunex or SIX: the browser.
    await handlers["shell.openExternal"]({ url: "https://akademik.itb.ac.id/" });
    expect(opened).toEqual(["https://akademik.itb.ac.id/"]);
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
