// A stand-in for Electron's windows and sessions, enough for the sign-in
// windows: each window browses the pretend sign-in pages (test/pretend/
// sign-in-pages.ts), following redirects and firing Electron's navigation
// events in Electron's order, a short network hop apart (on the test's fake
// timers). It records what the Student could see: which pages showed while
// the window was visible, and every script the app ran on which page.
import { EventEmitter } from "node:events";
import { type CookieJar, PretendSignInPages } from "../pretend/sign-in-pages";

const HOP_MS = 60;

export const browser = {
  pages: new PretendSignInPages(),
  windows: [] as FakeWindow[],
  sessions: [] as FakeSession[],
  reset(): void {
    browser.pages = new PretendSignInPages();
    browser.windows = [];
    browser.sessions = [];
  },
};

class FakeSession {
  readonly jar: CookieJar = new Map();
  /** Times its storage was wiped. */
  wiped = 0;
  readonly cookies = {
    get: async ({ url }: { url: string }) => [...(this.jar.get(new URL(url).host) ?? new Map()).entries()].map(([name, value]) => ({ name, value })),
  };
  setUserAgent(): void {}
  setPermissionRequestHandler(): void {}
  setPermissionCheckHandler(): void {}
  setDevicePermissionHandler(): void {}
  async clearStorageData(): Promise<void> {
    this.wiped += 1;
    this.jar.clear();
  }
  async clearCache(): Promise<void> {}
  async clearAuthCache(): Promise<void> {}
}

class FakeContents extends EventEmitter {
  private url = "";
  private html = "";
  private navigation = 0;
  private painted = false;
  /** Each page's saved values, by origin. */
  private readonly storage = new Map<string, Map<string, string>>();

  constructor(
    private readonly window: FakeWindow,
    private readonly session: FakeSession,
  ) {
    super();
  }

  getURL(): string {
    return this.url;
  }

  setWindowOpenHandler(): void {}

  async loadURL(address: string): Promise<void> {
    await this.navigate(address);
  }

  async executeJavaScript(script: string): Promise<unknown> {
    this.window.scripts.push({ on: this.url, script });
    if (script.includes("localStorage.getItem('auth')")) return this.storage.get(new URL(this.url).origin)?.get("auth") ?? null;
    if (script.includes('a[href^="/logout"]')) return this.html.includes('href="/logout"');
    return undefined;
  }

  /** What the Student does on Microsoft's page: types their password (and 2FA), or picks their account. */
  async submit(): Promise<void> {
    const action = /action="([^"]+)"/.exec(this.html)?.[1];
    if (!action) throw new Error(`Nothing to submit on ${this.url}`);
    await this.navigate(action.replaceAll("&amp;", "&"));
  }

  private async navigate(first: string): Promise<void> {
    const id = ++this.navigation;
    const hop = () => new Promise((resolve) => setTimeout(resolve, HOP_MS));
    let address = first;
    this.emit("did-start-navigation", { url: address, isMainFrame: true, isSameDocument: false });
    let answer = browser.pages.answer(address, this.session.jar);
    await hop();
    while ("location" in answer) {
      if (id !== this.navigation || this.window.isDestroyed()) return;
      address = new URL(answer.location, address).toString();
      this.emit("did-redirect-navigation", { url: address, isMainFrame: true });
      answer = browser.pages.answer(address, this.session.jar);
      await hop();
    }
    if (id !== this.navigation || this.window.isDestroyed()) return;
    this.url = address;
    this.html = answer.html;
    this.emit("did-navigate", {}, address, answer.status);
    if (!this.painted) {
      this.painted = true;
      this.window.emit("ready-to-show");
    }
    this.emit("did-stop-loading");
    // What the Student saw of it, once it drew.
    this.window.shown.push({ url: address, visible: this.window.isVisible() });
    const saves = answer.saves;
    if (saves)
      setTimeout(() => {
        if (this.url !== address) return;
        const origin = new URL(address).origin;
        const values = this.storage.get(origin) ?? new Map<string, string>();
        values.set(saves.key, saves.value);
        this.storage.set(origin, values);
      }, saves.afterMs);
  }
}

class FakeWindow extends EventEmitter {
  readonly webContents: FakeContents;
  /** Each page as it opened, and whether the window was showing then. */
  readonly shown: { url: string; visible: boolean }[] = [];
  /** Every script the app ran in the window, and on which page. */
  readonly scripts: { on: string; script: string }[] = [];
  /** Times it was shown. */
  shows = 0;
  private visible = false;
  private destroyed = false;
  focused = false;

  constructor(readonly options: { title?: string; webPreferences?: { partition?: string } }) {
    super();
    const session = sessionFor(options.webPreferences?.partition ?? "");
    this.webContents = new FakeContents(this, session);
    browser.windows.push(this);
  }

  show(): void {
    this.shows += 1;
    this.visible = true;
    this.focused = true;
    this.emit("show");
  }
  hide(): void {
    this.visible = false;
    this.focused = false;
    this.emit("hide");
  }
  focus(): void {
    this.focused = true;
  }
  isVisible(): boolean {
    return this.visible;
  }
  isFocused(): boolean {
    return this.focused;
  }
  isDestroyed(): boolean {
    return this.destroyed;
  }
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.visible = false;
    this.emit("closed");
  }
  /** The Student closes it. */
  close(): void {
    this.destroy();
  }
}

const partitions = new Map<string, FakeSession>();
function sessionFor(partition: string): FakeSession {
  let found = partitions.get(partition);
  if (!found) {
    found = new FakeSession();
    partitions.set(partition, found);
    browser.sessions.push(found);
  }
  return found;
}

/** The module the app imports as "electron". */
export const electron = {
  app: { isPackaged: true, on: () => undefined },
  BrowserWindow: FakeWindow,
  session: { fromPartition: sessionFor, defaultSession: sessionFor("default") },
};

export type { FakeWindow };
