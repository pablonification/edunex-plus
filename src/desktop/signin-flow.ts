// One sign-in window from start to finish, for Edunex and SIX alike. The
// window is the Student's while it shows Microsoft's pages (password, 2FA,
// account picker). The moment Microsoft hands back to the system's own
// website, their part is over: the window hides and the app's window says
// it's finishing, while the hidden page goes on until the session can be read.
// Should that take too long, the window shows again so nothing is stuck out
// of sight. A quiet sign-in (the app trying a system by itself, right after
// the Student signed in to the other) never shows and never types: it gives
// up on any page that waits for the Student, and after a short while.
import type { BrowserWindow, Session, WebContents } from "electron";
import type { SignInStep } from "../core/contract";
import { isEngineError } from "../engine/errors";
import { openSignInWindow } from "./signin-session";

/** How often the page is read for the session; reads never stop or reload it. */
const READ_EVERY_MS = 400;
/** A read that gets no answer this long is given up; the next one tries again. */
const READ_PATIENCE_MS = 3_000;
/** The window shows by itself after this, even if its first page hasn't drawn. */
const SHOW_ANYWAY_MS = 1_500;
/**
 * Hidden this long after Microsoft handed back with no session yet: the window
 * shows again. Edunex's website usually saves its session within a few
 * seconds of opening; this leaves room for a slow day.
 */
const SLOW_MS = 20_000;
/** A quiet sign-in gives up on a page that sits this long without moving on: it waits for the Student. */
const QUIET_STILL_MS = 4_000;
/** And gives up after this, whatever it's on. */
const QUIET_LIMIT_MS = 30_000;

export interface SignInSystem<T> {
  /** Where the sign-in starts (it goes on to Microsoft). */
  start: string;
  /** The system's own website: Microsoft handing back to one of these ends the Student's part. */
  hosts: readonly string[];
  /** The session, once the page holds one; null while it doesn't yet. Throws when it never will. */
  read(contents: WebContents, session: Session): Promise<T | null>;
  /** Anything to set up on the page before the start loads. */
  prepare?(contents: WebContents): void;
}

export interface SignInOptions {
  parent: BrowserWindow | null;
  title: string;
  devTools: boolean;
  /** The app's own try: hidden throughout, and given up on anything that needs the Student. */
  quiet?: boolean;
  /** Where the sign-in stands past the Student's part (null: back with the Student, or done). */
  onStep?(step: SignInStep | null): void;
}

export interface SignInRun<T> {
  /** The session, or null when the Student closed the window or a quiet try gave up. */
  result: Promise<T | null>;
  /** The Student asked for this sign-in: from now on it's theirs (shown when it needs them, never given up). */
  adopt(onStep?: SignInOptions["onStep"]): void;
  /** Stops it now: the window goes and the result is null. */
  cancel(): void;
  /** Whether it's still the app's own quiet try. */
  readonly quiet: boolean;
}

const hostOf = (url: string): string | null => {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
};

export function runSignIn<T>(system: SignInSystem<T>, options: SignInOptions): SignInRun<T> {
  let quiet = options.quiet ?? false;
  let onStep = options.onStep;
  const { window, session, adopt: adoptWindow } = openSignInWindow({ ...options, quiet });
  const contents = window.webContents;

  /** "student": Microsoft's pages (or the system's own before them); "finishing": handed back, hidden; "slow": shown again. */
  let phase: "student" | "finishing" | "slow" = "student";
  /** Microsoft has had the window: the system's website from now on means it handed back. */
  let leftSystem = false;
  let done = false;
  let reading = false;
  let showAnyway: ReturnType<typeof setTimeout> | null = null;
  let slow: ReturnType<typeof setTimeout> | null = null;
  let still: ReturnType<typeof setTimeout> | null = null;
  let limit: ReturnType<typeof setTimeout> | null = null;
  let settle: (outcome: { value: T | null } | { error: unknown }) => void = () => undefined;

  // A quiet try says nothing: if it gives up, nothing happened as far as the Student can tell.
  const step = (next: SignInStep | null) => !quiet && onStep?.(next);
  const clear = (timer: ReturnType<typeof setTimeout> | null) => timer && clearTimeout(timer);
  const show = () => {
    if (quiet || done || window.isDestroyed() || window.isVisible()) return;
    window.show();
  };
  const hide = () => {
    if (window.isDestroyed() || !window.isVisible()) return;
    const hadFocus = window.isFocused();
    window.hide();
    // The Student was just typing in it: the app's window, which now says what's happening, takes over.
    if (hadFocus && options.parent && !options.parent.isDestroyed()) options.parent.focus();
  };

  const finish = (outcome: { value: T | null } | { error: unknown }) => {
    if (done) return;
    done = true;
    clearInterval(poller);
    for (const timer of [showAnyway, slow, still, limit]) clear(timer);
    if (!window.isDestroyed()) window.destroy();
    settle(outcome);
  };
  const giveUp = () => finish({ value: null });

  const handedBack = () => {
    clear(showAnyway);
    clear(still);
    if (phase !== "student") return;
    phase = "finishing";
    hide();
    step("finishing");
    slow = setTimeout(() => {
      phase = "slow";
      show();
      step("slow");
    }, SLOW_MS);
  };
  const backWithStudent = () => {
    if (phase === "student") return;
    clear(slow);
    phase = "student";
    show();
    step(null);
  };
  /** Where the window is going, as it starts and at each redirect (before the page draws). */
  const going = (url: string) => {
    const host = hostOf(url);
    if (!host) return;
    clear(still);
    if (!system.hosts.includes(host)) {
      leftSystem = true;
      backWithStudent();
    } else if (leftSystem) handedBack();
  };

  const read = async () => {
    if (done || reading || window.isDestroyed()) return;
    reading = true;
    try {
      const found = await Promise.race([
        system.read(contents, session),
        new Promise<null>((resolveLater) => setTimeout(() => resolveLater(null), READ_PATIENCE_MS)),
      ]);
      if (found !== null) finish({ value: found });
    } catch (error) {
      // A page between loads can't be read; the next read tries again. A system that won't give a session, ends it.
      if (isEngineError(error)) finish(quiet ? { value: null } : { error });
    } finally {
      reading = false;
    }
  };
  const poller = setInterval(() => void read(), READ_EVERY_MS);

  const result = new Promise<T | null>((resolve, reject) => {
    settle = (outcome) => ("error" in outcome ? reject(outcome.error) : resolve(outcome.value));
  });

  contents.on("did-start-navigation", (details) => {
    if (details.isMainFrame && !details.isSameDocument) going(details.url);
  });
  contents.on("did-redirect-navigation", (details) => {
    if (details.isMainFrame) going(details.url);
  });
  contents.on("did-stop-loading", () => {
    // A quiet try on a page that doesn't move on is waiting for the Student: it isn't theirs to see.
    if (!quiet || phase !== "student") return;
    clear(still);
    still = setTimeout(giveUp, QUIET_STILL_MS);
  });
  window.on("closed", giveUp);
  if (quiet) limit = setTimeout(giveUp, QUIET_LIMIT_MS);
  else {
    showAnyway = setTimeout(() => phase === "student" && show(), SHOW_ANYWAY_MS);
    window.once("ready-to-show", () => phase === "student" && show());
  }
  system.prepare?.(contents);
  void contents.loadURL(system.start).catch(() => undefined);

  return {
    result,
    get quiet() {
      return quiet;
    },
    adopt(next) {
      if (done) return;
      if (next) onStep = next;
      if (quiet) {
        quiet = false;
        adoptWindow();
        clear(still);
        clear(limit);
        if (phase !== "finishing") show();
        if (phase !== "student") step(phase);
      }
      if (!window.isDestroyed() && window.isVisible()) window.focus();
    },
    cancel: giveUp,
  };
}
