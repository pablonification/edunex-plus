// Beranda's top (`home.search`): a real search bar, the first thing to tap on the page, with the app's mark before it
// and the bell after it, all on one row. It stays put as the page scrolls (app/(tabs)/index.tsx passes it as the page's
// header). The bar opens the app's search; the Student themself is the Profil tab, so no avatar here. The class on now
// starts the page right under it (./index.tsx). The mark (`home.brand`) is where a home screen's brand goes, at the
// row's start: the mark alone, drawn as vectors, said as "Edunex Plus" by a screen reader, and not a button (it has no
// job).
import { router } from "expo-router";
import { memo } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useT } from "../../../../src/app/i18n";
import { BellButton } from "../../parts/b-header";
import { useB } from "../../ui/b";
import { BrandMark } from "../../ui/brand";
import { Icons } from "../../ui/icons";
import { PressScale } from "../../ui/press";
import { Text } from "../../ui/text";
import { space } from "../../ui/theme";

/** The search bar's height: Material's 48 dp target, whatever the font size. */
export const SEARCH_HEIGHT = 48;
/** The mark's side: a step under the bar's height, so the bar stays the row's first thing. */
export const MARK_SIZE = 32;

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
      <View style={{ marginRight: space[2] }}>
        <BrandMark size={MARK_SIZE} label={t("mobile.appName")} testID="home.brand" />
      </View>
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
        <Icons.Search size={20} color={b.fg2} />
        <Text size="bodyLarge" numberOfLines={1} style={{ color: b.muted, flex: 1 }}>
          {t("mobile.home.searchHint")}
        </Text>
      </PressScale>
      <BellButton />
    </View>
  );
});
