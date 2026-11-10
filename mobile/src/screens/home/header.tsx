// Beranda's top bar (round 4, the super-app layout): Edunex's blue under the status bar, a short greeting ("Malam,
// Dimas", Plus Jakarta Sans, one line, smaller than a tab's title), the data's status under it only when it says
// something to act on, then a full-width search bar with the bell beside it, as the apps students use daily put them.
// The search bar is a button that opens Cari (/search), not a field. The bell is on Beranda only, and no avatar: the
// Student's own things are the Profil tab's. The bar stays put as the page scrolls (app/(tabs)/index.tsx passes it as
// the page's header); a band of the same blue starts the page, and the now card overlaps its lower edge. A tap on the
// greeting opens the sources' sheet, as a tab's title does elsewhere. A halftone (ui/halftone.tsx) lifts the bar's
// right side: strongest in the top-right corner, gone by the greeting and by the bar's lower edge, so the band under it
// starts plain and nothing slides past a seam as the page scrolls.
import { router } from "expo-router";
import { memo, useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLang, useNow, useT } from "../../../../src/app/i18n";
import { firstName } from "../../../../src/app/names";
import { useDataset } from "../../../../src/app/store";
import { Bell, StatusLine, SyncPanel, useSyncText } from "../../shell/source-status";
import { Halftone } from "../../ui/halftone";
import { Icons } from "../../ui/icons";
import { iosPressed } from "../../ui/press";
import { Text } from "../../ui/text";
import { space, TOUCH, useTheme } from "../../ui/theme";
import { partOfDay } from "./greeting";

/** How far the now card reaches up into the blue band. */
export const OVERLAP = 40;
/** The blue between the bar's search row and the now card's top. */
export const BAND_GAP = space[3];
/** How wide the halftone reaches in from the right edge: about half a phone, so the greeting's start stays plain. */
const TEXTURE_WIDTH = 208;
/** The bar under the status bar: the greeting's row, the search row, the space under it (dp, before the status line). */
export const HEAD_HEIGHT = TOUCH + TOUCH + space[2];

export const HomeBar = memo(function HomeBar() {
  const t = useT();
  const lang = useLang();
  const now = useNow();
  const v = useTheme().v4;
  const insets = useSafeAreaInsets();
  const account = useDataset("edunex.account");
  const student = useDataset("six.student");
  const sync = useSyncText();
  const [panel, setPanel] = useState(false);
  const name = account?.name ?? student?.name;
  const part = partOfDay(new Date(now).getHours(), lang);
  const hello = name ? t(`mobile.home.hello.${part}`, { name: firstName(name) }) : t(`time.greeting.${part}`);
  const hint = t("mobile.search.placeholder");
  return (
    <View style={{ backgroundColor: v.head, paddingTop: insets.top, paddingBottom: space[2] }} testID="home.header">
      <Halftone width={TEXTURE_WIDTH} height={insets.top + HEAD_HEIGHT} color={v.headDots} />
      <Pressable
        onPress={() => setPanel(true)}
        accessibilityRole="button"
        accessibilityLabel={`${hello}. ${t("sync.title")}: ${sync}`}
        testID="action.syncStatus"
        style={{ minHeight: TOUCH, justifyContent: "center", paddingHorizontal: space[4], alignSelf: "flex-start", maxWidth: "100%" }}
      >
        <Text
          size="titleMedium"
          face="display"
          weight="bold"
          numberOfLines={1}
          accessibilityRole="header"
          style={{ color: v.onHead, fontSize: 17, letterSpacing: -0.2 }}
        >
          {hello}
        </Text>
        <StatusLine color={v.onHead} />
      </Pressable>
      <View style={{ flexDirection: "row", alignItems: "center", gap: space[1], paddingLeft: space[4], paddingRight: space[1] }}>
        <Pressable
          onPress={() => router.push("/search")}
          accessibilityRole="search"
          accessibilityLabel={hint}
          testID="home.search"
          android_ripple={{ color: v.line }}
          style={({ pressed }) => [
            {
              flex: 1,
              minWidth: 0,
              height: TOUCH,
              borderRadius: TOUCH / 2,
              backgroundColor: v.card,
              flexDirection: "row",
              alignItems: "center",
              gap: space[2],
              paddingHorizontal: space[4],
              overflow: "hidden",
            },
            iosPressed(pressed),
          ]}
        >
          <Icons.Search size={20} color={v.muted} />
          <Text size="bodyMedium" numberOfLines={1} style={{ color: v.muted, flexShrink: 1 }}>
            {hint}
          </Text>
        </Pressable>
        <Bell color={v.onHead} dot={v.bellDot} />
      </View>
      <SyncPanel open={panel} onClose={() => setPanel(false)} />
    </View>
  );
});

/** The blue the page starts with, under the bar: the now card overlaps its lower edge. Scrolls away under the bar. */
export function HomeBand() {
  const v = useTheme().v4;
  return <View style={{ backgroundColor: v.head, height: OVERLAP + BAND_GAP }} />;
}
