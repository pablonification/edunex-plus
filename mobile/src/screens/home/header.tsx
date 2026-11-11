// Beranda's top (`home.search`): a real search bar, the first thing to tap on the page, with the app's mark before it
// and the bell after it, all on one row and all one height (BAR_ITEM): the mark's tile, the bar's pill and the bell's
// circle, the same gap between them, the page's margin at both ends. It stays put as the page scrolls (app/(tabs)/index.tsx passes it as the page's
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

/**
 * The row's one height: the mark, the search bar and the bell are three things of the same height on the same line,
 * with the same gap between them and the page's margin at both ends (the developer's iPhone, 11 Nov: a 32 dp mark, a
 * 48 dp bar and a bare 24 dp bell read as "uneven placement, inconsistent sizing"). Each is touched in 48 dp (hitSlop).
 */
export const BAR_ITEM = 44;
/** The search bar's height. */
export const SEARCH_HEIGHT = BAR_ITEM;
/** The mark's side. */
export const MARK_SIZE = BAR_ITEM;
/** What the 48 dp target adds round a 44 dp thing. */
const REACH = { top: 2, bottom: 2, left: 2, right: 2 } as const;

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
        paddingHorizontal: space[4],
        flexDirection: "row",
        alignItems: "center",
        gap: space[3],
      }}
    >
      <BrandMark size={MARK_SIZE} label={t("mobile.appName")} testID="home.brand" />
      <PressScale
        onPress={() => router.push("/search")}
        accessibilityRole="search"
        accessibilityLabel={t("search.open")}
        testID="home.search"
        hitSlop={REACH}
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
        {/* The hint whole on one line: beside the mark and the bell the bar is narrower, so the words give a little
            (down to 80%) before they would be cut. */}
        <Text size="bodyLarge" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={{ color: b.muted, flex: 1 }}>
          {t("mobile.home.searchHint")}
        </Text>
      </PressScale>
      <BellButton filled={BAR_ITEM} />
    </View>
  );
});
