// Edunex's or SIX's own page over the whole screen, signed in with the app's session (W14,
// ../../host/signed-pages.ts): "Buka di Edunex", "Buka di SIX", and Tandai Hadir, where SIX's
// timetable opens on the class's month with the class's popup opened the way a click opens it, so
// the Student only has to press SIX's button (the app never presses it). The bar says where the
// page is (the host beside a lock). Only Edunex, SIX and Microsoft's sign-in open here; an official
// link elsewhere opens in the phone's browser. What the pages keep stays in the app's web views
// until the Student signs out, so the next page opens signed in too. The demo's Edunex and SIX are
// pretend: its page says what the real one shows.
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useOpenExternal } from "../../../../src/app/hooks";
import { useT } from "../../../../src/app/i18n";
import { useStatus } from "../../../../src/app/store";
import { isOfficialUrl } from "../../../../src/core/links";
import { EdunexSession } from "../../../../src/engine/sources/edunex/session";
import { openPopupScript, prepareCheckIn } from "../../host/check-in";
import { edunexAuthScript, isSixLoginPage, SIX_SIGN_IN_AGAIN, type Site, siteOf, staysInPage } from "../../host/signed-pages";
import { DEMO } from "../../host/version";
import { useNav } from "../../nav";
import { currentHost } from "../../shell/boot";
import { Web, type WebPage } from "../../shell/sign-in";
import { EmptyState } from "../../ui/display";
import { Icons } from "../../ui/icons";
import { Text } from "../../ui/text";
import { space, useTheme } from "../../ui/theme";
import { TopBar } from "../../ui/top-bar";

const hostOf = (url: string) => {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
};

const NAMES: Record<Site, string> = { edunex: "Edunex", six: "SIX" };

/**
 * `url`: the page to open (Edunex's or SIX's; ../../host/signed-pages.ts). `meeting`: SIX's class whose popup opens
 * once its timetable has loaded (Tandai Hadir). `title`: the bar's, the site's name by default.
 */
export function SignedPage({ url, meeting, title, testID }: { url: string; meeting?: string; title?: string; testID?: string }) {
  const t = useT();
  const theme = useTheme();
  const nav = useNav();
  const openElsewhere = useOpenExternal();
  const site = siteOf(url) ?? "six";
  const status = useStatus(site);
  const view = useRef<WebPage>(null);
  // The page to open, once the session is in the web views (SIX's cookie).
  const [ready, setReady] = useState<string | null>(null);
  const [host, setHost] = useState(() => hostOf(url) ?? "");
  const [loading, setLoading] = useState(true);
  const pending = useRef<string | null>(meeting && /^\d{1,20}$/.test(meeting) ? meeting : null);
  // SIX's own sign-in page is gone through once, by Microsoft, which remembers the Student; never in a loop.
  const signedInAgain = useRef(false);
  const engine = currentHost?.engine;
  const token = site === "edunex" ? (EdunexSession.safeParse(engine?.session("edunex")).data?.token ?? null) : null;

  // Prepared once per page: data read meanwhile doesn't reload the page under the Student.
  // biome-ignore lint/correctness/useExhaustiveDependencies: once per page, on purpose
  useEffect(() => {
    if (DEMO) return;
    let live = true;
    void (site === "six" && engine ? prepareCheckIn(engine) : Promise.resolve(false))
      .catch(() => false)
      .then(() => {
        if (live) setReady(url);
      });
    return () => {
      live = false;
    };
  }, [url]);

  // Signing out of this system closes its page.
  const wasIn = useRef(status.state !== "signed-out");
  useEffect(() => {
    if (status.state !== "signed-out") wasIn.current = true;
    else if (wasIn.current) nav.back();
  }, [status.state, nav]);

  return (
    <View testID={testID ?? `screen.page.${site}`} style={{ flex: 1, backgroundColor: theme.color.canvas }}>
      <TopBar
        title={title ?? NAMES[site]}
        actions={
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[1], marginRight: space[3] }}>
            <Icons.Lock size={14} color={theme.color.faint} />
            <Text size="caption" tone="faint" numberOfLines={1} ellipsizeMode="head" style={{ maxWidth: 160 }}>
              {host}
            </Text>
          </View>
        }
      />
      {DEMO ? (
        <View style={{ flex: 1, justifyContent: "center", padding: space[6] }}>
          <EmptyState icon={<Icons.Lock size={20} color={theme.color.muted} />} title={t("mobile.page.demo", { site: NAMES[site] })} />
        </View>
      ) : (
        <View style={{ flex: 1 }}>
          {ready && (
            <Web
              ref={view}
              testID={`web.${site}`}
              source={{ uri: ready }}
              injectedJavaScriptBeforeContentLoaded={edunexAuthScript(token)}
              onShouldStartLoadWithRequest={(request) => {
                // The site's frames stay where they are.
                if (request.isTopFrame === false) return true;
                if (staysInPage(request.url)) {
                  setHost(hostOf(request.url) ?? host);
                  return true;
                }
                if (isOfficialUrl(request.url)) openElsewhere(request.url);
                return false;
              }}
              onNavigationStateChange={(state) => {
                const next = hostOf(state.url);
                if (next) setHost(next);
              }}
              onLoadStart={() => setLoading(true)}
              onLoadEnd={(event) => {
                setLoading(false);
                const at = event.nativeEvent.url;
                // SIX asks to sign in (its session ended, or it wants Microsoft's word again): through Microsoft, once.
                if (isSixLoginPage(at) && !signedInAgain.current) {
                  signedInAgain.current = true;
                  view.current?.injectJavaScript(`window.location.href=${JSON.stringify(SIX_SIGN_IN_AGAIN)};true;`);
                  return;
                }
                const class_ = pending.current;
                if (!class_ || !hostOf(at) || !new URL(at).pathname.includes("/kelas/jadwal/")) return;
                pending.current = null;
                view.current?.injectJavaScript(`${openPopupScript(class_)};true;`);
              }}
              javaScriptEnabled
              domStorageEnabled
              thirdPartyCookiesEnabled
              setSupportMultipleWindows={false}
              style={{ flex: 1, backgroundColor: theme.color.canvas }}
            />
          )}
          {(loading || !ready) && (
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
              <ActivityIndicator color={theme.color.accent} size="large" accessibilityLabel={title ?? NAMES[site]} />
            </View>
          )}
        </View>
      )}
    </View>
  );
}
