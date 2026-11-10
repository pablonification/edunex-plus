// Beranda's top (direction B): a real search bar, the first thing on the page, with the bell beside it. It stays put as
// the page scrolls (app/(tabs)/index.tsx passes it as the page's header). The bar opens the app's search; the Student
// themself is the Profil tab, so no avatar here. The greeting, the page's one title, starts the page under it
// (./index.tsx).
import { router } from "expo-router";
import { memo } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useT } from "../../../../src/app/i18n";
import { BellButton } from "../../parts/b-header";
import { useB } from "../../ui/b";
import { Fluent } from "../../ui/fluent";
import { PressScale } from "../../ui/press";
import { Text } from "../../ui/text";
import { space } from "../../ui/theme";

/** The search bar's height: Material's 48 dp target, whatever the font size. */
export const SEARCH_HEIGHT = 48;

export const HomeBar = memo(function HomeBar() {
  const t = useT();
  const b = useB();
  const insets = useSafeAreaInsets();
  return (
    <View
      testID="home.header"
      style={{
        backgroundColor: b.page,
        paddingTop: insets.top + space[2],
        paddingBottom: space[2],
        paddingLeft: space[4],
        paddingRight: space[1],
        flexDirection: "row",
        alignItems: "center",
        gap: space[1],
      }}
    >
      <PressScale
        onPress={() => router.push("/search")}
        accessibilityRole="search"
        accessibilityLabel={t("search.open")}
        testID="home.search"
        style={{
          flex: 1,
          height: SEARCH_HEIGHT,
          borderRadius: SEARCH_HEIGHT / 2,
          backgroundColor: b.soft,
          flexDirection: "row",
          alignItems: "center",
          gap: space[3],
          paddingHorizontal: space[4],
        }}
      >
        <Fluent name="Search20Regular" color={b.fg2} />
        <Text size="bodyLarge" numberOfLines={1} style={{ color: b.muted, flex: 1 }}>
          {t("mobile.search.placeholder")}
        </Text>
      </PressScale>
      <BellButton />
    </View>
  );
});
