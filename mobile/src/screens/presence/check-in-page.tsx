// "Tandai Hadir" on the phone (src/desktop/six-window.ts): SIX's own timetable over the whole
// screen, on the class's month, signed in with the session the engine keeps, and the class's popup
// opened the way a click on the class opens it, so the Student only has to press SIX's button. The
// app never presses it. The bar says where the page is (the host beside a lock). Only SIX and
// Microsoft's sign-in open here; an official link elsewhere opens in the phone's browser. Leaving
// the page wipes what its web view kept (unless a sign-in is using it), and signing out of SIX
// closes it.
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useOpenExternal } from "../../../../src/app/hooks";
import { useT } from "../../../../src/app/i18n";
import { useDataset, useStatus } from "../../../../src/app/store";
import { isOfficialUrl, SIX_WEB, sixTimetableUrl } from "../../../../src/core/links";
import { checkInUrl, openPopupScript, prepareCheckIn, staysInSixPage } from "../../host/check-in";
import { useNav } from "../../nav";
import { currentHost } from "../../shell/boot";
import { phoneSignInWindows, Web, type WebPage } from "../../shell/sign-in";
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

export function CheckInPage({ meetingId }: { meetingId: string }) {
  const t = useT();
  const theme = useTheme();
  const nav = useNav();
  const open = useOpenExternal();
  const student = useDataset("six.student");
  const six = useStatus("six");
  const view = useRef<WebPage>(null);
  // The page to open, once SIX's session is in the web views' cookie store.
  const [url, setUrl] = useState<string | null>(null);
  const [host, setHost] = useState(() => new URL(SIX_WEB).host);
  const [loading, setLoading] = useState(true);
  // The class whose popup opens once SIX's timetable has loaded (null: done, or the Student moved on).
  const pending = useRef<string | null>(/^\d{1,20}$/.test(meetingId) ? meetingId : null);

  // Prepared once per class: the timetable reread meanwhile doesn't reload the page under the Student.
  // biome-ignore lint/correctness/useExhaustiveDependencies: once per class, on purpose
  useEffect(() => {
    let live = true;
    const engine = currentHost?.engine;
    // The class gone from what the app read meanwhile: SIX's timetable all the same, without a popup.
    const page = (engine && checkInUrl(engine, meetingId)) ?? (student ? sixTimetableUrl(student) : `${SIX_WEB}/`);
    void (engine ? prepareCheckIn(engine) : Promise.resolve(false))
      .catch(() => false)
      .then(() => {
        if (!live) return;
        setHost(hostOf(page) ?? host);
        setUrl(page);
      });
    return () => {
      live = false;
    };
  }, [meetingId]);

  // Nothing of SIX's page stays once the Student leaves (the desktop's window session is wiped on close).
  useEffect(() => () => void phoneSignInWindows.forget().catch(() => undefined), []);

  // Signing out of SIX closes the page, and SIX's cookie in it goes with the page.
  const wasIn = useRef(six.state !== "signed-out");
  useEffect(() => {
    if (six.state !== "signed-out") wasIn.current = true;
    else if (wasIn.current) nav.back();
  }, [six.state, nav]);

  return (
    <View testID="screen.checkIn" style={{ flex: 1, backgroundColor: theme.color.canvas }}>
      <TopBar
        title={t("six.checkInTitle")}
        actions={
          <View style={{ flexDirection: "row", alignItems: "center", gap: space[1], marginRight: space[3] }}>
            <Icons.Lock size={14} color={theme.color.faint} />
            <Text size="caption" tone="faint" numberOfLines={1} ellipsizeMode="head" style={{ maxWidth: 160 }}>
              {host}
            </Text>
          </View>
        }
      />
      <View style={{ flex: 1 }}>
        {url && (
          <Web
            ref={view}
            testID="web.six"
            source={{ uri: url }}
            onShouldStartLoadWithRequest={(request) => {
              // SIX's frames stay where they are, as in the desktop's window.
              if (request.isTopFrame === false) return false;
              if (staysInSixPage(request.url)) {
                setHost(hostOf(request.url) ?? host);
                return true;
              }
              if (isOfficialUrl(request.url)) open(request.url);
              return false;
            }}
            onNavigationStateChange={(nav) => {
              const next = hostOf(nav.url);
              if (next) setHost(next);
            }}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={(event) => {
              setLoading(false);
              const meeting = pending.current;
              if (!meeting || !hostOf(event.nativeEvent.url) || !new URL(event.nativeEvent.url).pathname.includes("/kelas/jadwal/")) return;
              pending.current = null;
              view.current?.injectJavaScript(`${openPopupScript(meeting)};true;`);
            }}
            javaScriptEnabled
            domStorageEnabled
            thirdPartyCookiesEnabled
            cacheEnabled={false}
            setSupportMultipleWindows={false}
            style={{ flex: 1, backgroundColor: theme.color.canvas }}
          />
        )}
        {(loading || !url) && (
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, { alignItems: "center", justifyContent: "center" }]}>
            <ActivityIndicator color={theme.color.accent} size="large" accessibilityLabel={t("six.checkInTitle")} />
          </View>
        )}
      </View>
    </View>
  );
}
