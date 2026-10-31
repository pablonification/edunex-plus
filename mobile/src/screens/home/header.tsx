// Beranda's header (round 2, v4): Edunex's blue, the greeting as the screen's one title ("Pagi, Dimas", Plus Jakarta
// Sans), search and the bell (a dot when something's new), and under the greeting, only when it says something to act
// on, the data's status. The now card overlaps its lower edge. A tap on the greeting opens the sources' sheet, as a
// tab's title does elsewhere. The status bar's own height is the page's fixed strip (app/(tabs)/index.tsx), not here.
import { router } from "expo-router";
import { memo, useState } from "react";
import { Pressable, View } from "react-native";
import { useLang, useNow, useT } from "../../../../src/app/i18n";
import { firstName } from "../../../../src/app/names";
import { useDataset } from "../../../../src/app/store";
import { StatusLine, SyncPanel, useSyncText, useUnreadAlerts } from "../../shell/source-status";
import { IconButton } from "../../ui/controls";
import { Icons } from "../../ui/icons";
import { Text } from "../../ui/text";
import { space, TOUCH, useTheme } from "../../ui/theme";

/** How far the now card reaches up into the header. */
export const OVERLAP = 60;

/** "Pagi", "Siang", "Sore", "Malam": the desktop's hours for its greetings (src/core/format.ts). */
function partOfDay(at: number, lang: "id" | "en"): "morning" | "midday" | "afternoon" | "evening" {
  const hour = new Date(at).getHours();
  if (lang === "id") return hour < 11 ? "morning" : hour < 15 ? "midday" : hour < 18 ? "afternoon" : "evening";
  return hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
}

export const HomeHeader = memo(function HomeHeader() {
  const t = useT();
  const lang = useLang();
  const now = useNow();
  const v = useTheme().v4;
  const account = useDataset("edunex.account");
  const student = useDataset("six.student");
  const unread = useUnreadAlerts();
  const sync = useSyncText();
  const [panel, setPanel] = useState(false);
  const name = account?.name ?? student?.name;
  const part = partOfDay(now, lang);
  const hello = name ? t(`mobile.home.hello.${part}`, { name: firstName(name) }) : t(`time.greeting.${part}`);
  return (
    <View style={{ backgroundColor: v.head, paddingTop: space[1], paddingBottom: OVERLAP + space[6] }} testID="home.header">
      <View style={{ flexDirection: "row", alignItems: "center", minHeight: 64, paddingLeft: space[5], paddingRight: space[2] }}>
        <Pressable
          onPress={() => setPanel(true)}
          accessibilityRole="button"
          accessibilityLabel={`${hello}. ${t("sync.title")}: ${sync}`}
          testID="action.syncStatus"
          style={{ flex: 1, minHeight: TOUCH, justifyContent: "center" }}
        >
          <Text size="titleLarge" face="display" weight="bold" accessibilityRole="header" style={{ color: v.onHead, letterSpacing: -0.3 }}>
            {hello}
          </Text>
          <StatusLine color={v.onHead} />
        </Pressable>
        <IconButton label={t("search.open")} onPress={() => router.push("/search")} testID="action.search">
          <Icons.Search size={24} color={v.onHead} />
        </IconButton>
        <View>
          <IconButton
            label={unread > 0 ? t("alerts.open", { count: unread }) : t("alerts.title")}
            onPress={() => router.push("/alerts")}
            testID="action.alerts"
          >
            <Icons.Bell size={24} color={v.onHead} />
          </IconButton>
          {unread > 0 && (
            <View
              pointerEvents="none"
              style={{
                position: "absolute",
                top: 11,
                right: 12,
                width: 10,
                height: 10,
                borderRadius: 5,
                backgroundColor: v.bellDot,
                borderWidth: 2,
                borderColor: v.head,
              }}
            />
          )}
        </View>
      </View>
      <SyncPanel open={panel} onClose={() => setPanel(false)} />
    </View>
  );
});
