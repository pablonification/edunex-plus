// The Edunex window, on a small stand-in for Electron: it opens an Edunex page
// on a throwaway session of its own, signed in by putting the engine's token
// where Edunex's website keeps its session, before the website's code runs. It
// keeps to Edunex and its sign-in, sends any other web page to the browser,
// and wipes itself when it closes or the Student signs out.
import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

class FakeContents extends EventEmitter {
  url = "";
  openHandler: ((details: { url: string }) => { action: string }) | null = null;
  readonly loaded: string[] = [];
  readonly commands: { method: string; params?: { source?: string }; on: string }[] = [];
  readonly debugger = {
    attach: () => undefined,
    // As Chromium does: no answer before the window has a page.
    sendCommand: (method: string, params?: { source?: string }) =>
      this.url ? Promise.resolve(void this.commands.push({ method, params, on: this.url })) : new Promise<void>(() => undefined),
  };
  async loadURL(url: string): Promise<void> {
    this.url = url;
    this.loaded.push(url);
  }
  getURL(): string {
    return this.url;
  }
  setWindowOpenHandler(handler: (details: { url: string }) => { action: string }): void {
    this.openHandler = handler;
  }
}

class FakeWindow extends EventEmitter {
  static windows: FakeWindow[] = [];
  readonly webContents = new FakeContents();
  destroyed = false;
  visible = false;
  focused = 0;
  constructor(readonly options: { title: string; webPreferences: Record<string, unknown> }) {
    super();
    FakeWindow.windows.push(this);
  }
  isDestroyed(): boolean {
    return this.destroyed;
  }
  isVisible(): boolean {
    return this.visible;
  }
  show(): void {
    this.visible = true;
  }
  focus(): void {
    this.focused += 1;
  }
  destroy(): void {
    this.destroyed = true;
    this.emit("closed");
  }
}

const fake = vi.hoisted(() => ({ wiped: 0, external: [] as string[] }));

vi.mock("electron", () => ({
  BrowserWindow: FakeWindow,
  shell: { openExternal: async (url: string) => void fake.external.push(url) },
  app: { on: () => undefined, isPackaged: false },
  session: {
    fromPartition: () => ({
      setUserAgent: () => undefined,
      setPermissionRequestHandler: () => undefined,
      setPermissionCheckHandler: () => undefined,
      clearStorageData: async () => void (fake.wiped += 1),
      clearCache: async () => undefined,
      clearAuthCache: async () => undefined,
    }),
  },
}));

const { closeEdunexWindow, edunexAuth, openEdunexWindow, signInScript, staysInEdunexWindow } = await import("../../src/desktop/edunex-window");

const NOW = Date.parse("2026-10-08T05:00:00.000Z");
/** A made-up token whose payload says it ends at 2026-10-09T05:00:00Z. */
const TOKEN = ["eyJhbGciOiJIUzI1NiJ9", Buffer.from(JSON.stringify({ sub: "900001", exp: NOW / 1000 + 86_400 })).toString("base64url"), "c2lnbmF0dXJl"].join(
  ".",
);
const COURSE = "https://edunex.itb.ac.id/courses/95001";
const options = { url: COURSE, token: TOKEN, now: NOW, title: "Edunex", devTools: false };

beforeEach(() => {
  closeEdunexWindow();
  FakeWindow.windows = [];
  fake.wiped = 0;
  fake.external = [];
});

describe("the Edunex window", () => {
  it("opens the page on a session of its own, signed in before Edunex's code runs", async () => {
    await openEdunexWindow(options);
    const [window] = FakeWindow.windows;
    expect(window.options.webPreferences).toMatchObject({ sandbox: true, contextIsolation: true, nodeIntegration: false });
    expect(window.options.webPreferences.preload).toBeUndefined();
    expect(window.webContents.url).toBe(COURSE);
    const script = window.webContents.commands.find((c) => c.method === "Page.addScriptToEvaluateOnNewDocument");
    expect(script?.params?.source).toBe(signInScript(edunexAuth(TOKEN, NOW)));
    // Set up on a blank page, since Chromium waits for one, before Edunex's.
    expect(window.webContents.loaded).toEqual(["about:blank", COURSE]);
    expect(script?.on).toBe("about:blank");
  });

  it("saves the session as Edunex's own sign-in does, ending when the token does", () => {
    expect(JSON.parse(edunexAuth(TOKEN, NOW))).toEqual({ accessToken: TOKEN, expirationDate: "2026-10-09T05:00:00.000Z", verified: true });
    // A token that doesn't say when it ends: Edunex is left to say so.
    expect(JSON.parse(edunexAuth("a.b.c", NOW)).expirationDate).toBe("2026-10-08T17:00:00.000Z");
  });

  it("puts the session in once, on Edunex only, and never over one already there", () => {
    const store = () => {
      const values = new Map<string, string>();
      return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => void values.set(key, value) };
    };
    const run = (origin: string, localStorage = store(), sessionStorage = store()) => {
      new Function("location", "localStorage", "sessionStorage", signInScript(edunexAuth(TOKEN, NOW)))({ origin }, localStorage, sessionStorage);
      return { localStorage, sessionStorage };
    };
    expect(run("https://edunex.itb.ac.id").localStorage.getItem("auth")).toBe(edunexAuth(TOKEN, NOW));
    expect(run("https://login.microsoftonline.com").localStorage.getItem("auth")).toBeNull();
    // The Student signed in on Edunex's page after the token ended: that session stays.
    const page = run("https://edunex.itb.ac.id");
    page.localStorage.setItem("auth", "theirs");
    run("https://edunex.itb.ac.id", page.localStorage, page.sessionStorage);
    expect(page.localStorage.getItem("auth")).toBe("theirs");
  });

  it("signed out of Edunex, opens the page as it is, for Edunex to ask for a sign-in", async () => {
    await openEdunexWindow({ ...options, token: null });
    expect(FakeWindow.windows[0].webContents.commands).toEqual([]);
    expect(FakeWindow.windows[0].webContents.url).toBe(COURSE);
  });

  it("is one window: another page opens in it, brought forward", async () => {
    await openEdunexWindow(options);
    const [window] = FakeWindow.windows;
    window.show();
    await openEdunexWindow({ ...options, url: "https://edunex.itb.ac.id/assignment/take/117764" });
    expect(FakeWindow.windows).toHaveLength(1);
    expect(window.focused).toBe(1);
    expect(window.webContents.url).toBe("https://edunex.itb.ac.id/assignment/take/117764");
  });

  it("wipes its session when it closes, says so, and goes with a sign-out", async () => {
    let closed = 0;
    await openEdunexWindow({ ...options, onClosed: () => void (closed += 1) });
    closeEdunexWindow();
    expect(FakeWindow.windows[0].isDestroyed()).toBe(true);
    expect(fake.wiped).toBe(1);
    expect(closed).toBe(1);
  });

  it("keeps to Edunex and its sign-in; any other web page goes to the browser, as Edunex opens it", async () => {
    await openEdunexWindow(options);
    const contents = FakeWindow.windows[0].webContents;
    const navigate = (url: string) => {
      const event = { prevented: false, preventDefault: () => void (event.prevented = true) };
      contents.emit("will-navigate", event, url);
      return event.prevented;
    };
    expect(navigate("https://edunex.itb.ac.id/pages/login")).toBe(false);
    expect(navigate("https://sso-edunex.itb.ac.id/")).toBe(false);
    expect(navigate("https://login.microsoftonline.com/common/oauth2/authorize")).toBe(false);
    expect(navigate("https://docs.google.com/fixture")).toBe(true);
    expect(navigate("javascript:alert(1)")).toBe(true);
    expect(contents.openHandler?.({ url: "https://forms.gle/fixture" })).toEqual({ action: "deny" });
    expect(fake.external).toEqual(["https://docs.google.com/fixture", "https://forms.gle/fixture"]);
  });

  it("opens only Edunex", async () => {
    await expect(openEdunexWindow({ ...options, url: "https://six.itb.ac.id/" })).rejects.toThrow();
    expect(staysInEdunexWindow("http://edunex.itb.ac.id/")).toBe(false);
    expect(staysInEdunexWindow("https://edunex.itb.ac.id.example.com/")).toBe(false);
  });
});
