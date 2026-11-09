// Beranda's top bar (round 2, v4; round 3): Edunex's blue under the status bar, the greeting as the screen's one title
// ("Malam, Dimas", Plus Jakarta Sans), and the same three actions every tab ends with (Search, the bell, the avatar),
// with the data's status under the greeting only when it says something to act on. The bar stays put as the page
// scrolls (app/(tabs)/index.tsx passes it as the page's header); a band of the same blue starts the page, and the now
// card overlaps its lower edge. A tap on the greeting opens the sources' sheet, as a tab's title does elsewhere.
import { memo, useState } from "react";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLang, useNow, useT } from "../../../../src/app/i18n";
import { firstName } from "../../../../src/app/names";
import { useDataset } from "../../../../src/app/store";
import { StatusLine, SyncPanel, TabActions, useSyncText } from "../../shell/source-status";
import { Text } from "../../ui/text";
import { space, TOUCH, useTheme } from "../../ui/theme";
import { BAR_HEIGHT } from "../../ui/top-bar";
import { partOfDay } from "./greeting";

/** How far the now card reaches up into the blue band. */
export const OVERLAP = 60;

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
  return (
    <View style={{ backgroundColor: v.head, paddingTop: insets.top }} testID="home.header">
      <View style={{ flexDirection: "row", alignItems: "center", minHeight: BAR_HEIGHT, paddingLeft: space[4], paddingRight: space[1] }}>
        <Pressable
          onPress={() => setPanel(true)}
          accessibilityRole="button"
          accessibilityLabel={`${hello}. ${t("sync.title")}: ${sync}`}
          testID="action.syncStatus"
          style={{ flex: 1, minWidth: 0, minHeight: TOUCH, justifyContent: "center" }}
        >
          <Text size="titleLarge" face="display" weight="bold" numberOfLines={1} accessibilityRole="header" style={{ color: v.onHead, letterSpacing: -0.3 }}>
            {hello}
          </Text>
          <StatusLine color={v.onHead} />
        </Pressable>
        <TabActions color={v.onHead} dot={v.bellDot} />
      </View>
      <SyncPanel open={panel} onClose={() => setPanel(false)} />
    </View>
  );
});

/** The blue the page starts with, under the bar: the now card overlaps its lower edge. Scrolls away under the bar. */
export function HomeBand() {
  const v = useTheme().v4;
  return <View style={{ backgroundColor: v.head, height: OVERLAP + space[6] }} />;
}
