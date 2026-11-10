// "Semua layanan" (round 4, mobile/qa/r4-decisions.md): every service the app has, behind Beranda's "Lainnya", as the
// apps students use daily lay it out. A search bar on top that narrows the tiles by their word (Indonesian or English,
// whichever the Student types), then "Sering kamu buka" (counted on this phone, ./opens.ts), then every service under
// its heading. Tiles straight on the grey page, no row cards: the same tiles as Beranda's grid, their words on up to two
// lines. Nothing matches: one line says so and offers the app's whole search.
import { router } from "expo-router";
import { type ReactNode, useMemo, useState } from "react";
import { TextInput, View } from "react-native";
import { useT } from "../../../../src/app/i18n";
import { mobileStrings } from "../../../../src/core/strings/mobile";
import { HOME_GRID, SERVICE_GROUPS, SERVICES, ServiceGrid, type ServiceId } from "../../parts/services";
import { usePerfDrawn } from "../../perf";
import { BigButton } from "../../ui/big-button";
import { IconButton } from "../../ui/controls";
import { Heading } from "../../ui/group";
import { Icons } from "../../ui/icons";
import { Page } from "../../ui/layout";
import { Text, useFieldColors } from "../../ui/text";
import { shape, space, TOUCH, type, useTheme } from "../../ui/theme";
import { TopBar } from "../../ui/top-bar";
import { frequent } from "./frequent";
import { openCounts } from "./opens";

/** Every service the page lists ("Lainnya" is this page). */
const LISTED = SERVICE_GROUPS.flatMap((group) => group.ids);

/** A service's words in both languages, lower-cased, for the search. */
const WORDS: Record<string, string> = Object.fromEntries(
  LISTED.map((id) => {
    const entry = mobileStrings[SERVICES[id].label as keyof typeof mobileStrings] as { id: string; en: string } | undefined;
    return [id, entry ? `${entry.id} ${entry.en}`.toLowerCase() : ""];
  }),
);

/** The services whose word has every typed word in it. */
export function matching(query: string): ServiceId[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  return LISTED.filter((id) => words.every((word) => WORDS[id]?.includes(word)));
}

export function ServicesScreen() {
  usePerfDrawn(true);
  const t = useT();
  const v = useTheme().v4;
  const [query, setQuery] = useState("");
  // Read once: the row stays put while the Student is on the page, and shows the new counts next time.
  const [often] = useState(() => frequent(openCounts(), LISTED, HOME_GRID));
  const typed = query.trim();
  const found = useMemo(() => (typed ? new Set(matching(typed)) : null), [typed]);

  let body: ReactNode;
  if (!found) {
    body = (
      <>
        <Section title={t("mobile.services.frequent")} testID="services.frequent" ids={often} first />
        {SERVICE_GROUPS.map((group) => (
          <Section key={group.group} title={t(group.title)} testID={`services.group.${group.group}`} ids={group.ids} />
        ))}
      </>
    );
  } else if (found.size > 0) {
    body = SERVICE_GROUPS.map((group, at) => {
      const ids = group.ids.filter((id) => found.has(id));
      return ids.length ? <Section key={group.group} title={t(group.title)} testID={`services.group.${group.group}`} ids={ids} first={at === 0} /> : null;
    });
  } else {
    body = (
      <View testID="services.none" style={{ alignItems: "center", gap: space[4], paddingTop: space[8], paddingHorizontal: space[4] }}>
        <Text size="bodyLarge" style={{ color: v.fg2, textAlign: "center" }}>
          {t("mobile.services.none", { query: typed })}
        </Text>
        <BigButton variant="outline" onPress={() => router.push(`/search?q=${encodeURIComponent(typed)}` as never)} testID="services.searchAll">
          {t("mobile.services.searchAll", { query: typed })}
        </BigButton>
      </View>
    );
  }

  return (
    <Page testID="screen.services" background={v.page} header={<TopBar v4 title={t("mobile.services.title")} />} keyboardDismissMode="on-drag">
      <SearchField value={query} onChange={setQuery} />
      {body}
    </Page>
  );
}

function Section({ title, ids, testID, first = false }: { title: string; ids: readonly ServiceId[]; testID: string; first?: boolean }) {
  return (
    <View testID={testID}>
      <Heading first={first}>{title}</Heading>
      <ServiceGrid ids={ids} lines={2} />
    </View>
  );
}

/** Material 3's search bar: the glass, the field, and × once something's typed, in one white pill on the grey. */
function SearchField({ value, onChange }: { value: string; onChange: (query: string) => void }) {
  const t = useT();
  const v = useTheme().v4;
  const fieldColors = useFieldColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space[2],
        minHeight: 56,
        borderRadius: shape.full,
        backgroundColor: v.card,
        paddingLeft: space[4],
        paddingRight: space[1],
        marginTop: space[2],
      }}
    >
      <Icons.Search size={22} color={v.fg2} />
      <TextInput
        {...fieldColors}
        testID="services.search"
        value={value}
        onChangeText={onChange}
        placeholder={t("mobile.services.search")}
        placeholderTextColor={v.muted}
        accessibilityLabel={t("mobile.services.search")}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        style={{ flex: 1, color: v.fg, ...type.bodyLarge, paddingVertical: 0, minHeight: TOUCH }}
      />
      {value !== "" && (
        <IconButton label={t("mobile.search.clear")} onPress={() => onChange("")} testID="services.clear">
          <Icons.X size={22} color={v.fg2} />
        </IconButton>
      )}
    </View>
  );
}
