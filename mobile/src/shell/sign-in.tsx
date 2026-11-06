// Signing in on the phone: ITB's real pages in a web view the app owns, the desktop's sign-in
// windows (src/desktop/signin-flow.ts, signin.ts, six-signin.ts) done with WebViews and the same
// rules and timings. The Student types their password and 2FA code only on Microsoft's page. Once
// Microsoft hands back, the page is covered while the app reads the session (Edunex's token from
// its website's storage, SIX's cookie from the web views' cookie store), then it closes. A quiet
// try (the other system, right after the Student signed in to one, on the same Microsoft session)
// runs out of sight and gives up on any page that waits for the Student. The desktop's
// signInToBoth (src/desktop/signin-both.ts) drives both, unchanged.

import { StatusBar } from "expo-status-bar";
import { type ComponentType, type Ref, useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ActivityIndicator, BackHandler, StyleSheet, View } from "react-native";
import Animated, { Easing, FadeIn, FadeOut, SlideInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import WebView, { type WebViewNavigation, type WebViewProps } from "react-native-webview";
import type { WebViewMessageEvent } from "react-native-webview/lib/WebViewTypes";
import { useT } from "../../../src/app/i18n";
import type { SignInStep } from "../../../src/core/contract";
import type { SignInWindows } from "../../../src/desktop/signin-both";
import { EngineError, isEngineError } from "../../../src/engine/errors";
import { EDUNEX_SIGN_IN_URL, EDUNEX_SITE_HOST, readSignInToken } from "../../../src/engine/sources/edunex/signin";
import { isSixAfterSignIn, readSixSession, SIX_LOGIN_PAGE, SIX_SIGN_IN_URL, SIX_SITE_HOST } from "../../../src/engine/sources/six/signin";
import { cookiesFor } from "../../modules/web-cookies";
import { IconButton } from "../ui/controls";
import { Icons } from "../ui/icons";
import { reduceMotion } from "../ui/motion";
import { Text } from "../ui/text";
import { motion, space, useTheme } from "../ui/theme";

type Source = "edunex" | "six";

/** react-native-webview's class, typed for TypeScript 6 (its default props parameter reads as never). */
export type WebPage = WebView<object>;
export const Web = WebView as unknown as ComponentType<WebViewProps & { ref?: Ref<WebPage> }>;

const READ_EVERY_MS = 400;
const SLOW_MS = 20_000;
const QUIET_STILL_MS = 4_000;
const QUIET_LIMIT_MS = 30_000;
/** Signed in to SIX, yet no session cookie this long: SIX keeps its session some other way now. */
const COOKIE_GRACE_MS = 10_000;

const SYSTEMS: Record<Source, { start: string; hosts: readonly string[] }> = {
  edunex: { start: EDUNEX_SIGN_IN_URL, hosts: [new URL(EDUNEX_SIGN_IN_URL).host, EDUNEX_SITE_HOST] },
  six: { start: SIX_SIGN_IN_URL, hosts: [SIX_SITE_HOST] },
};

/** What a page posts back each read: Edunex's saved auth, or whether SIX shows a signed-in page. */
const READ_SCRIPT: Record<Source, string> = {
  edunex: `(function(){try{if(location.host===${JSON.stringify(EDUNEX_SITE_HOST)})window.ReactNativeWebView.postMessage(JSON.stringify({auth:window.localStorage.getItem('auth')}));}catch(e){}})();true;`,
  six: `(function(){try{window.ReactNativeWebView.postMessage(JSON.stringify({signedIn:Boolean(document.querySelector('a[href^="/logout"]'))}));}catch(e){}})();true;`,
};

interface Run {
  id: number;
  source: Source;
  quiet: boolean;
  onStep(step: SignInStep | null): void;
  finish(value: string | null, error?: unknown): void;
}

// The sign-ins under way, for the host to draw: one per system at most, as on the desktop.
let runs: Run[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const publish = () => {
  runs = [...runs];
  for (const listener of listeners) listener();
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

/** The desktop's sign-in windows (SignInWindows), as web views drawn by <SignInHost />. */
export const phoneSignInWindows: SignInWindows = {
  open(source, { quiet, onStep }) {
    const running = runs.find((run) => run.source === source);
    if (running) {
      if (!quiet && running.quiet) {
        running.quiet = false;
        running.onStep = onStep;
        publish();
      }
      return new Promise((resolve, reject) => {
        const before = running.finish;
        running.finish = (value, error) => {
          before(value, error);
          if (error) reject(error);
          else resolve(value);
        };
      });
    }
    return new Promise<string | null>((resolve, reject) => {
      const run: Run = {
        id: nextId++,
        source,
        quiet,
        onStep,
        finish(value, error) {
          runs = runs.filter((other) => other !== run);
          publish();
          if (error) reject(error);
          else resolve(value);
        },
      };
      runs.push(run);
      publish();
    });
  },
  stopQuiet(source) {
    const run = runs.find((other) => other.source === source && other.quiet);
    run?.finish(null);
  },
  // Microsoft's session and everything the sign-in pages kept, gone once no sign-in needs them.
  // The desktop wipes Microsoft's session once both are signed in. The phone keeps it, and what Edunex's and SIX's pages
  // kept, in the app's own web views (no other app reads them) until the Student signs out: Edunex's and SIX's pages in
  // the app then open signed in, and a session that ends signs in again without a password (W14 in PROGRESS.md).
  async forget() {},
};

/** Draws every sign-in under way: quiet ones out of sight, the Student's over the whole screen. */
export function SignInHost() {
  const current = useSyncExternalStore(subscribe, () => runs);
  return (
    <>
      {current.map((run) => (
        <SignInPage key={run.id} run={run} />
      ))}
    </>
  );
}

function SignInPage({ run }: { run: Run }) {
  const t = useT();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const view = useRef<WebPage>(null);
  const system = SYSTEMS[run.source];
  const [phase, setPhase] = useState<"student" | "finishing" | "slow">("student");
  // The page actually open, beside the lock: where the Student is typing (Microsoft's, ITB's, SIX's).
  const [host, setHost] = useState(() => new URL(system.start).host);
  const state = useRef({ done: false, leftSystem: false, phase: "student" as "student" | "finishing" | "slow", url: system.start, signedInAt: 0 });
  const timers = useRef<{ slow?: ReturnType<typeof setTimeout>; still?: ReturnType<typeof setTimeout>; limit?: ReturnType<typeof setTimeout> }>({});
  const quiet = run.quiet;

  const step = useCallback((next: SignInStep | null) => !run.quiet && run.onStep(next), [run]);
  const finish = useCallback(
    (value: string | null, error?: unknown) => {
      if (state.current.done) return;
      state.current.done = true;
      for (const timer of Object.values(timers.current)) if (timer) clearTimeout(timer);
      step(null);
      run.finish(value, error);
    },
    [run, step],
  );
  const giveUp = useCallback(() => finish(null), [finish]);

  const setPhaseBoth = useCallback((next: "student" | "finishing" | "slow") => {
    state.current.phase = next;
    setPhase(next);
  }, []);

  const handedBack = useCallback(() => {
    if (state.current.phase !== "student") return;
    setPhaseBoth("finishing");
    step("finishing");
    timers.current.slow = setTimeout(() => {
      setPhaseBoth("slow");
      step("slow");
    }, SLOW_MS);
  }, [setPhaseBoth, step]);
  const backWithStudent = useCallback(() => {
    if (state.current.phase === "student") return;
    if (timers.current.slow) clearTimeout(timers.current.slow);
    setPhaseBoth("student");
    step(null);
  }, [setPhaseBoth, step]);

  /** Where the page is going, as it starts and at each redirect. */
  const going = useCallback(
    (url: string) => {
      state.current.url = url;
      let host: string;
      try {
        host = new URL(url).host;
      } catch {
        return;
      }
      setHost(host);
      if (timers.current.still) clearTimeout(timers.current.still);
      if (!system.hosts.includes(host)) {
        state.current.leftSystem = true;
        backWithStudent();
      } else if (state.current.leftSystem) handedBack();
    },
    [system, backWithStudent, handedBack],
  );

  // Reads the session every 400 ms, as the desktop does.
  useEffect(() => {
    const poller = setInterval(() => view.current?.injectJavaScript(READ_SCRIPT[run.source]), READ_EVERY_MS);
    if (run.quiet) timers.current.limit = setTimeout(giveUp, QUIET_LIMIT_MS);
    return () => clearInterval(poller);
  }, [run, giveUp]);

  // Becoming the Student's: no more quiet limits, and the page shows (unless it's being read).
  useEffect(() => {
    if (quiet) return;
    if (timers.current.still) clearTimeout(timers.current.still);
    if (timers.current.limit) clearTimeout(timers.current.limit);
    if (state.current.phase !== "student") step(state.current.phase);
  }, [quiet, step]);

  // Android's Back closes the Student's sign-in page.
  useEffect(() => {
    if (quiet) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      giveUp();
      return true;
    });
    return () => sub.remove();
  }, [quiet, giveUp]);

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      if (state.current.done) return;
      let data: { auth?: unknown; signedIn?: unknown };
      try {
        data = JSON.parse(event.nativeEvent.data);
      } catch {
        return;
      }
      try {
        if (run.source === "edunex" && "auth" in data) {
          const token = readSignInToken(data.auth);
          if (token) finish(token);
          return;
        }
        if (run.source === "six" && data.signedIn === true && isSixAfterSignIn(state.current.url)) {
          const found = readSixSession(cookiesFor("https://six.itb.ac.id/"));
          if (found) return finish(found);
          state.current.signedInAt ||= Date.now();
          if (Date.now() - state.current.signedInAt > COOKIE_GRACE_MS)
            throw new EngineError("VendorChanged", "SIX's session cookie wasn't there after sign-in");
        }
      } catch (error) {
        if (isEngineError(error)) finish(null, run.quiet ? undefined : error);
      }
    },
    [run, finish],
  );

  const hidden = quiet || phase === "finishing";
  const title = t(run.source === "edunex" ? "signIn.edunexTitle" : "signIn.sixTitle");
  const sourceName = t(run.source === "edunex" ? "source.edunex" : "source.six");

  return (
    <Animated.View
      entering={quiet ? undefined : reduceMotion() ? FadeIn.duration(motion.duration.medium) : SlideInDown.duration(motion.duration.long).easing(EMPHASIZED)}
      exiting={quiet ? undefined : FadeOut.duration(motion.duration.short)}
      pointerEvents={quiet ? "none" : "auto"}
      style={quiet ? styles.offscreen : [StyleSheet.absoluteFill, { backgroundColor: theme.color.canvas, paddingTop: insets.top, zIndex: 100 }]}
      accessibilityViewIsModal={!quiet}
      importantForAccessibility={quiet ? "no-hide-descendants" : "auto"}
    >
      {/* ITB's and Microsoft's pages are light: the status bar's icons stay readable over them. */}
      {!quiet && <StatusBar style={theme.scheme === "dark" ? "light" : "dark"} />}
      {!quiet && (
        // Material's full-screen dialog bar: close at the start, what this is, and whose page it is (the lock, the host).
        <View style={[styles.bar, { backgroundColor: theme.color.surface }]}>
          <IconButton label={t("action.close")} onPress={giveUp} testID="signin.close">
            <Icons.X size={24} color={theme.color.onSurface} />
          </IconButton>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text size="titleLarge" numberOfLines={1}>
              {title}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: space[1] }}>
              <Icons.Lock size={12} color={theme.color.onSurfaceVariant} />
              <Text size="bodySmall" tone="muted" numberOfLines={1} ellipsizeMode="head" style={{ flexShrink: 1 }}>
                {host}
              </Text>
            </View>
          </View>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Web
          ref={view}
          testID={`signin.${run.source}`}
          source={{ uri: system.start }}
          onShouldStartLoadWithRequest={(request) => {
            if (request.isTopFrame !== false) going(request.url);
            return true;
          }}
          onNavigationStateChange={(nav: WebViewNavigation) => going(nav.url)}
          onLoadEnd={() => {
            // A quiet try on a page that doesn't move on is waiting for the Student: not theirs to see.
            if (!run.quiet || state.current.phase !== "student") return;
            if (timers.current.still) clearTimeout(timers.current.still);
            timers.current.still = setTimeout(giveUp, QUIET_STILL_MS);
          }}
          onHttpError={(event) => {
            // Should SIX refuse "Login dengan ITB Account" straight away, its own sign-in page has the button.
            if (run.source === "six" && event.nativeEvent.statusCode >= 400 && event.nativeEvent.url.startsWith(SIX_SIGN_IN_URL))
              view.current?.injectJavaScript(`location.href=${JSON.stringify(SIX_LOGIN_PAGE)};true;`);
          }}
          onMessage={onMessage}
          domStorageEnabled
          javaScriptEnabled
          thirdPartyCookiesEnabled
          setSupportMultipleWindows={false}
          style={{ flex: 1, backgroundColor: theme.color.canvas }}
        />
        {!quiet && hidden && (
          <View style={[StyleSheet.absoluteFill, styles.cover, { backgroundColor: theme.color.canvas }]}>
            <ActivityIndicator color={theme.color.accent} size="large" />
            <Text size="body" weight="medium" style={{ marginTop: space[4], textAlign: "center" }}>
              {t("signIn.finishing", { source: sourceName })}
            </Text>
          </View>
        )}
        {!quiet && phase === "slow" && (
          <View style={[styles.slow, { backgroundColor: theme.color.warningBg }]}>
            <Text size="small" weight="semibold" tone="warning">
              {t("signIn.slow", { source: sourceName })}
            </Text>
            <Text size="small" tone="warning">
              {t("signIn.slowHint")}
            </Text>
          </View>
        )}
      </View>
    </Animated.View>
  );
}

/** Material's emphasized decelerate, for a screen coming in. */
const EMPHASIZED = Easing.bezier(0.05, 0.7, 0.1, 1);

const styles = StyleSheet.create({
  offscreen: { position: "absolute", left: -2000, top: 0, width: 400, height: 800, opacity: 0 },
  bar: { flexDirection: "row", alignItems: "center", gap: space[1], minHeight: 64, paddingLeft: space[1], paddingRight: space[4] },
  cover: { alignItems: "center", justifyContent: "center", padding: space[8] },
  slow: { position: "absolute", left: space[3], right: space[3], bottom: space[3], borderRadius: 12, padding: space[4], gap: 2 },
});
