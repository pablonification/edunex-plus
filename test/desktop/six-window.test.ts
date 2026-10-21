// The SIX window for "Tandai Hadir", on a small stand-in for Electron: it
// opens SIX's timetable signed in with the engine's cookie on its own
// throwaway session, clicks the class to bring up its popup once the page has
// loaded (and never presses anything), keeps to SIX and Microsoft's sign-in,
// sends other official links to the browser, and wipes itself when it closes.
import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";

class FakeContents extends EventEmitter {
  url = "";
  readonly scripts: string[] = [];
  openHandler: ((details: { url: string }) => { action: string }) | null = null;
  async loadURL(url: string): Promise<void> {
    this.url = url;
    this.emit("did-finish-load");
  }
  getURL(): string {
    return this.url;
  }
  async executeJavaScript(script: string): Promise<boolean> {
    this.scripts.push(script);
    return true;
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
  constructor(readonly options: { webPreferences: Record<string, unknown> }) {
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

const fake = vi.hoisted(() => ({
  cookies: [] as { url: string; name: string; value: string; secure?: boolean; httpOnly?: boolean }[],
  wiped: 0,
  permissionsRefused: 0,
  external: [] as string[],
}));

vi.mock("electron", () => ({
  BrowserWindow: FakeWindow,
  shell: { openExternal: async (url: string) => void fake.external.push(url) },
  app: { on: () => undefined, isPackaged: false },
  session: {
    fromPartition: () => ({
      cookies: { set: async (cookie: (typeof fake.cookies)[number]) => void fake.cookies.push(cookie) },
      setUserAgent: () => undefined,
      setPermissionRequestHandler: () => void (fake.permissionsRefused += 1),
      setPermissionCheckHandler: () => undefined,
      clearStorageData: async () => void (fake.wiped += 1),
      clearCache: async () => undefined,
      clearAuthCache: async () => undefined,
    }),
  },
}));

const { closeSixWindow, openPopupScript, openSixCheckIn, sixCookie, staysInSixWindow } = await import("../../src/desktop/six-window");

const TIMETABLE = "https://six.itb.ac.id/app/mahasiswa:18223901+2026-1/kelas/jadwal/mahasiswa/2021000001?bulan=202610";
const options = { url: TIMETABLE, meetingId: "2194342", cookie: "khongguan=pretend-six-session", title: "SIX · Tandai Hadir", devTools: false };

beforeEach(() => {
  closeSixWindow();
  FakeWindow.windows = [];
  fake.cookies = [];
  fake.wiped = 0;
  fake.external = [];
});

describe("the SIX window", () => {
  it("opens SIX's timetable signed in, on a session of its own, and brings up the class's popup once it loaded", async () => {
    await openSixCheckIn(options);
    const [window] = FakeWindow.windows;
    expect(window.options.webPreferences).toMatchObject({ sandbox: true, contextIsolation: true, nodeIntegration: false });
    expect(window.options.webPreferences.preload).toBeUndefined();
    expect(fake.cookies).toEqual([{ url: "https://six.itb.ac.id/", name: "khongguan", value: "pretend-six-session", secure: true, httpOnly: true }]);
    expect(fake.permissionsRefused).toBeGreaterThan(0);
    expect(window.webContents.url).toBe(TIMETABLE);
    expect(window.webContents.scripts).toEqual([openPopupScript("2194342")]);

    // The Student moves around SIX: the popup isn't opened again on every page.
    await window.webContents.loadURL(TIMETABLE);
    expect(window.webContents.scripts).toHaveLength(1);
  });

  it("is one window: another class opens in it, brought forward", async () => {
    await openSixCheckIn(options);
    const [window] = FakeWindow.windows;
    window.show();
    await openSixCheckIn({ ...options, meetingId: "2153982" });
    expect(FakeWindow.windows).toHaveLength(1);
    expect(window.focused).toBe(1);
    expect(window.webContents.scripts.at(-1)).toBe(openPopupScript("2153982"));
  });

  it("wipes its session when it closes, and goes with a sign-out", async () => {
    await openSixCheckIn(options);
    closeSixWindow();
    await Promise.resolve();
    expect(FakeWindow.windows[0].isDestroyed()).toBe(true);
    expect(fake.wiped).toBe(1);
  });

  it("keeps to SIX and Microsoft's sign-in; an official link elsewhere goes to the browser, anything else nowhere", async () => {
    await openSixCheckIn(options);
    const contents = FakeWindow.windows[0].webContents;
    const navigate = (url: string) => {
      const event = { prevented: false, preventDefault: () => void (event.prevented = true) };
      contents.emit("will-navigate", event, url);
      return event.prevented;
    };
    expect(navigate("https://six.itb.ac.id/app/mahasiswa:18223901/statusmhs")).toBe(false);
    expect(navigate("https://login.microsoftonline.com/common/oauth2/authorize")).toBe(false);
    expect(navigate("https://edunex.itb.ac.id/courses/95001")).toBe(true);
    expect(navigate("https://example.com/")).toBe(true);
    expect(fake.external).toEqual(["https://edunex.itb.ac.id/courses/95001"]);
    expect(contents.openHandler?.({ url: "https://example.com/" })).toEqual({ action: "deny" });
  });

  it("opens only SIX, and only a class by its number", async () => {
    await expect(openSixCheckIn({ ...options, url: "https://example.com/" })).rejects.toThrow();
    expect(() => openPopupScript("1'); alert(1); ('")).toThrow();
    expect(staysInSixWindow("http://six.itb.ac.id/")).toBe(false);
    // A name and password inside the address (built, not written: written, it reads as an email address).
    const named = new URL("https://six.itb.ac.id/");
    named.username = "user";
    named.password = "pw";
    expect(staysInSixWindow(named.href)).toBe(false);
  });

  it("reads the engine's session as SIX's cookie, and nothing else", () => {
    expect(sixCookie("khongguan=abc%2B/=.-x")).toEqual({ name: "khongguan", value: "abc%2B/=.-x" });
    expect(sixCookie(null)).toBeNull();
    expect(sixCookie("khongguan=a; other=b")).toBeNull();
  });
});
