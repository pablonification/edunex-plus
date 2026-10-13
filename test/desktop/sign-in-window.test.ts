// The sign-in windows, walking the pretend Microsoft, Edunex and SIX pages in
// a stand-in for Electron (sign-in-browser.ts). The window is the Student's
// while Microsoft asks; once Microsoft hands back it hides, and the app says
// it's finishing; a slow website brings it back. Right after an Edunex
// sign-in, SIX is tried by itself in a window nobody sees: it connects on
// Microsoft's session, or gives up silently, and never types anything.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Event } from "../../src/core/contract";
import type { SourceState } from "../../src/core/models";
import { MICROSOFT_HOST, PRETEND_SIGN_IN_COOKIE, PRETEND_SIGN_IN_TOKEN } from "../pretend/sign-in-pages";
import { browser, type FakeWindow } from "./sign-in-browser";

vi.mock("electron", async () => (await import("./sign-in-browser")).electron);

const { signInToEdunex } = await import("../../src/desktop/signin");
const { signInToSix } = await import("../../src/desktop/six-signin");
const { forgetSignInSession } = await import("../../src/desktop/signin-session");
const { authHandlers } = await import("../../src/desktop/handlers/auth");
type Context = Parameters<typeof authHandlers>[0];

const parent = { focus: vi.fn(), isDestroyed: () => false };
const options = (more: { quiet?: boolean; onStep?: (step: string | null) => void } = {}) => ({
  parent: parent as never,
  title: "Masuk",
  devTools: false,
  ...more,
});
const wait = (ms: number) => vi.advanceTimersByTimeAsync(ms);
const host = (url: string) => new URL(url).host;
/** The window on Microsoft's page: the Student types their password (or picks their account). */
const studentSignsIn = async (window: FakeWindow) => {
  expect(host(window.webContents.getURL())).toBe(MICROSOFT_HOST);
  // The page moves on as the (fake) clock runs.
  void window.webContents.submit();
};
const KEEP_MS = 5 * 60_000;

beforeEach(() => {
  vi.useFakeTimers();
  browser.reset();
  parent.focus.mockClear();
});
afterEach(async () => {
  for (const window of browser.windows) window.destroy();
  await forgetSignInSession();
  await wait(KEEP_MS);
  vi.useRealTimers();
});

describe("the Edunex sign-in window", () => {
  it("is the Student's while Microsoft asks, and hides the moment Microsoft hands back", async () => {
    const steps: (string | null)[] = [];
    const token = signInToEdunex(options({ onStep: (step) => steps.push(step) }));
    await wait(1_000);
    const [window] = browser.windows;
    expect(window!.isVisible()).toBe(true);
    expect(host(window!.webContents.getURL())).toBe(MICROSOFT_HOST);
    expect(steps).toEqual([]);

    await studentSignsIn(window!);
    await wait(300);
    // Edunex's website opened out of sight, and the app's window says it's finishing.
    expect(window!.isVisible()).toBe(false);
    expect(parent.focus).toHaveBeenCalled();
    expect(steps).toEqual(["finishing"]);
    await wait(1_500);
    expect(await token).toBe(PRETEND_SIGN_IN_TOKEN);
    expect(window!.isDestroyed()).toBe(true);

    // Every Edunex page opened hidden; Microsoft's showed.
    for (const page of window!.shown) expect(page.visible, page.url).toBe(host(page.url) === MICROSOFT_HOST);
    // Nothing was typed or read on Microsoft's pages.
    expect(window!.scripts.length).toBeGreaterThan(0);
    for (const { on } of window!.scripts) expect(host(on)).toBe("edunex.itb.ac.id");
  });

  it("shows itself again when Edunex is slow to save its session, and still finishes", async () => {
    browser.pages.edunexSavesAfterMs = 26_000;
    const steps: (string | null)[] = [];
    const token = signInToEdunex(options({ onStep: (step) => steps.push(step) }));
    await wait(1_000);
    const [window] = browser.windows;
    await studentSignsIn(window!);
    await wait(19_000);
    expect(window!.isVisible()).toBe(false);
    await wait(1_500);
    expect(window!.isVisible()).toBe(true);
    expect(steps).toEqual(["finishing", "slow"]);
    await wait(6_000);
    expect(await token).toBe(PRETEND_SIGN_IN_TOKEN);
  });

  it("shows itself again when Microsoft asks once more after handing back", async () => {
    browser.pages.ssoAsksAgain = 1;
    const steps: (string | null)[] = [];
    const token = signInToEdunex(options({ onStep: (step) => steps.push(step) }));
    await wait(1_000);
    const [window] = browser.windows;
    await studentSignsIn(window!);
    await wait(500);
    expect(host(window!.webContents.getURL())).toBe(MICROSOFT_HOST);
    expect(window!.isVisible()).toBe(true);
    expect(steps).toEqual(["finishing", null]);
    await studentSignsIn(window!);
    await wait(2_000);
    expect(await token).toBe(PRETEND_SIGN_IN_TOKEN);
    for (const page of window!.shown) expect(page.visible, page.url).toBe(host(page.url) === MICROSOFT_HOST);
  });

  it("never shows at all when Microsoft still remembers the Student", async () => {
    const first = signInToEdunex(options());
    await wait(1_000);
    await studentSignsIn(browser.windows[0]!);
    await wait(2_000);
    await first;

    const again = signInToEdunex(options());
    await wait(3_000);
    expect(await again).toBe(PRETEND_SIGN_IN_TOKEN);
    expect(browser.windows[1]!.shows).toBe(0);
  });

  it("resolves with nothing when the Student closes it", async () => {
    const token = signInToEdunex(options());
    await wait(1_000);
    browser.windows[0]!.close();
    expect(await token).toBeNull();
  });
});

describe("the SIX sign-in window", () => {
  it("hides once Microsoft hands back to SIX, then reads SIX's session", async () => {
    const steps: (string | null)[] = [];
    const session = signInToSix(options({ onStep: (step) => steps.push(step) }));
    await wait(1_000);
    const [window] = browser.windows;
    expect(window!.isVisible()).toBe(true);
    await studentSignsIn(window!);
    await wait(1_500);
    expect(await session).toBe(`khongguan=${PRETEND_SIGN_IN_COOKIE}`);
    expect(steps).toEqual(["finishing"]);
    for (const page of window!.shown) expect(page.visible, page.url).toBe(host(page.url) === MICROSOFT_HOST);
    for (const { on } of window!.scripts) expect(host(on)).toBe("six.itb.ac.id");
  });

  it("keeps SIX's own sign-in page in sight when SIX turns its shortcut away", async () => {
    browser.pages.sixRefusesShortcut = true;
    const session = signInToSix(options());
    await wait(2_000);
    const [window] = browser.windows;
    expect(window!.webContents.getURL()).toBe("https://six.itb.ac.id/login");
    expect(window!.isVisible()).toBe(true);
    window!.close();
    expect(await session).toBeNull();
  });
});

/** The real sign-in handlers, on an engine that only keeps who is signed in. */
function app(start: { six?: SourceState; sixData?: boolean; firstRun?: boolean; firstRead?: Promise<void> } = {}) {
  const states: Record<string, SourceState> = { edunex: "signed-out", six: start.six ?? "signed-out", itb: "live" };
  const signedIn: { source: string; session: unknown }[] = [];
  const events: Event[] = [];
  const engine = {
    snapshot: () => ({
      version: "test",
      statuses: Object.entries(states).map(([source, state]) => ({ source, state, updatedAt: null, detail: null })),
      datasets: start.sixData ? [{ name: "six.student", value: {}, fetchedAt: 0, hash: "" }] : [],
      settings: { firstScanDone: !(start.firstRun ?? true) },
    }),
    signIn: async (source: string, session: unknown) => {
      signedIn.push({ source, session });
      states[source] = "connecting";
      // The engine's first read of the system, before the sign-in call returns.
      if (source === "edunex") await start.firstRead;
      states[source] = "live";
    },
    signOut: async (source?: string) => {
      for (const one of source ? [source] : ["edunex", "six"]) states[one] = "signed-out";
    },
  };
  const context = {
    engine,
    window: () => parent,
    packaged: true,
    lang: () => "id",
    send: (event: Event) => events.push(event),
    fileCache: { clear: async () => undefined },
    userData: "/nowhere",
    engineSession: {},
  } as unknown as Context;
  const handlers = authHandlers(context);
  /** The Student presses "Hubungkan" for a system. */
  const connect = (source: "edunex" | "six") => handlers["auth.signIn"]({ source });
  return { handlers, connect, signedIn, events, states };
}

describe("SIX by itself, right after Edunex", () => {
  it("connects on Microsoft's session in a window nobody sees, and says so", async () => {
    const { connect, signedIn, events } = app();
    const edunex = connect("edunex");
    await wait(1_000);
    await studentSignsIn(browser.windows[0]!);
    await wait(2_000);
    expect(await edunex).toEqual({ signedIn: true });

    await wait(2_000);
    expect(signedIn).toEqual([
      { source: "edunex", session: { token: PRETEND_SIGN_IN_TOKEN } },
      { source: "six", session: { cookie: `khongguan=${PRETEND_SIGN_IN_COOKIE}` } },
    ]);
    expect(events).toContainEqual({ type: "signIn.joined", source: "six" });
    // SIX's try said nothing on the way: no step for SIX but the last "nothing going on".
    expect(events.filter((event) => event.type === "signIn" && event.source === "six")).toEqual([{ type: "signIn", source: "six", step: null }]);
    const six = browser.windows[1]!;
    expect(six.shows).toBe(0);
    expect(six.isDestroyed()).toBe(true);
    for (const { on } of six.scripts) expect(host(on)).toBe("six.itb.ac.id");
    // Both connected: Microsoft's session is gone at once.
    expect(browser.sessions.some((session) => session.wiped > 0)).toBe(true);
  });

  it("gives up silently when Microsoft wants the Student, and leaves SIX's own sign-in as it was", async () => {
    const { connect, signedIn, events } = app();
    const edunex = connect("edunex");
    await wait(1_000);
    await studentSignsIn(browser.windows[0]!);
    browser.pages.asksRemembered = "account";
    await wait(2_000);
    await edunex;

    await wait(5_000);
    const quiet = browser.windows[1]!;
    expect(quiet.isDestroyed()).toBe(true);
    expect(quiet.shows).toBe(0);
    expect(quiet.scripts).toEqual([]);
    expect(signedIn.map((one) => one.source)).toEqual(["edunex"]);
    expect(events.some((event) => event.type === "signIn.joined")).toBe(false);

    // "Hubungkan SIX" opens SIX's sign-in in sight, on Microsoft's page, as before.
    const six = connect("six");
    await wait(1_000);
    const window = browser.windows[2]!;
    expect(window.isVisible()).toBe(true);
    await studentSignsIn(window);
    await wait(1_500);
    expect(await six).toEqual({ signedIn: true });
  });

  it("hands its window to the Student who presses Hubungkan SIX meanwhile", async () => {
    const { connect, signedIn } = app();
    const edunex = connect("edunex");
    await wait(1_000);
    await studentSignsIn(browser.windows[0]!);
    browser.pages.asksRemembered = "account";
    await wait(2_000);
    await edunex;
    await wait(500);
    const quiet = browser.windows[1]!;
    expect(quiet.isVisible()).toBe(false);

    const six = connect("six");
    await wait(10);
    expect(browser.windows).toHaveLength(2);
    expect(quiet.isVisible()).toBe(true);
    // Now it's theirs: it waits for them as long as they take.
    await wait(30_000);
    expect(quiet.isDestroyed()).toBe(false);
    await studentSignsIn(quiet);
    await wait(1_500);
    expect(await six).toEqual({ signedIn: true });
    expect(signedIn.map((one) => one.source)).toEqual(["edunex", "six"]);
  });

  it("isn't tried for a SIX the Student signed out of", async () => {
    const { connect } = app({ firstRun: false });
    const edunex = connect("edunex");
    await wait(1_000);
    await studentSignsIn(browser.windows[0]!);
    await wait(2_000);
    await edunex;
    await wait(5_000);
    expect(browser.windows).toHaveLength(1);
  });

  it("is tried when SIX's session ran out too, or SIX's data is still here", async () => {
    for (const start of [
      { six: "expired" as const, firstRun: false },
      { sixData: true, firstRun: false },
    ]) {
      browser.reset();
      const { connect, signedIn } = app(start);
      const edunex = connect("edunex");
      await wait(1_000);
      await studentSignsIn(browser.windows[0]!);
      await wait(2_000);
      await edunex;
      await wait(3_000);
      expect(signedIn.map((one) => one.source)).toEqual(["edunex", "six"]);
      await forgetSignInSession();
    }
  });

  it("stops when the Student signs out meanwhile, and keeps nothing it finds", async () => {
    const { connect, handlers, signedIn } = app();
    const edunex = connect("edunex");
    await wait(1_000);
    await studentSignsIn(browser.windows[0]!);
    // Microsoft asks for the account: the quiet try waits a few seconds on that page before it gives up.
    browser.pages.asksRemembered = "account";
    await wait(2_500);
    await edunex;
    expect(browser.windows).toHaveLength(2);
    await handlers["auth.signOut"]({ source: "edunex" });
    expect(browser.windows[1]!.isDestroyed()).toBe(true);
    await wait(5_000);
    expect(signedIn.map((one) => one.source)).toEqual(["edunex"]);
  });

  it("isn't tried once the Student signs out while Edunex's first read is still going", async () => {
    let read: () => void = () => undefined;
    const { connect, handlers, signedIn } = app({ firstRead: new Promise<void>((resolve) => (read = resolve)) });
    const edunex = connect("edunex");
    await wait(1_000);
    await studentSignsIn(browser.windows[0]!);
    await wait(2_000);
    // The wrong account, say: the Student signs out of Edunex before its first read is done.
    await handlers["auth.signOut"]({ source: "edunex" });
    read();
    await edunex;
    await wait(5_000);
    expect(browser.windows).toHaveLength(1);
    expect(signedIn.map((one) => one.source)).toEqual(["edunex"]);
  });

  it("keeps Microsoft's session no longer than the Edunex sign-in alone would", async () => {
    const { connect } = app();
    const edunex = connect("edunex");
    await wait(1_000);
    await studentSignsIn(browser.windows[0]!);
    browser.pages.asksRemembered = "account";
    await wait(2_000);
    await edunex;
    // The Edunex window closed about now; the quiet SIX try takes a few seconds more.
    const closedAt = Date.now();
    await wait(6_000);
    expect(browser.windows[1]!.isDestroyed()).toBe(true);
    const session = browser.sessions.find((one) => one.jar.size > 0)!;
    expect(session.wiped).toBe(0);
    await wait(closedAt + KEEP_MS - Date.now() + 100);
    expect(session.wiped).toBe(1);
  });
});
