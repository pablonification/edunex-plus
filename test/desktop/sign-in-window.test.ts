// The sign-in windows, walking the pretend Microsoft, Edunex and SIX pages in
// a stand-in for Electron (sign-in-browser.ts). The window is the Student's
// while Microsoft asks; once Microsoft hands back it hides, and the app says
// it's finishing; a slow website brings it back.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MICROSOFT_HOST, PRETEND_SIGN_IN_COOKIE, PRETEND_SIGN_IN_TOKEN } from "../pretend/sign-in-pages";
import { browser, type FakeWindow } from "./sign-in-browser";

vi.mock("electron", async () => (await import("./sign-in-browser")).electron);

const { signInToEdunex } = await import("../../src/desktop/signin");
const { signInToSix } = await import("../../src/desktop/six-signin");
const { forgetSignInSession } = await import("../../src/desktop/signin-session");

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
